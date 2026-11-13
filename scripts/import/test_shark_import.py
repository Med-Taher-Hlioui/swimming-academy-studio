"""Synthetic OOXML fixture and workbook dry-run tests."""
from io import BytesIO
import json
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest
from xml.sax.saxutils import escape
from zipfile import ZipFile, ZipInfo

from shark_import import COLS, preview
from xlsx_reader import WorkbookError

LABELS = ("", "Prénom", "Nom", "Age", "Parent", "Numéro", "Date de naissance", "Formule",
          "Certificat", "Extrait", "Juin", "Juillet", "Aout", "Septembre", "octobre", "Novembre", "Date début")
NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
RNS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def fixture(*, labels=LABELS, formulas=False, epoch=False, changed=False):
    out = BytesIO()
    rows = [dict(zip(COLS, labels)),
            dict(B="Synthetic Alpha", C="Example", E="Synthetic Guardian", F="20123456", G=42000,
                 H=60, I=" x ", K=" p ", L="-", M="A", N="NP", Q=46174),
            dict(B="synthetic alpha", C="Example", E="Another Guardian", F="+21620123456", G="01/02/2010", H="70"),
            dict(B="Synthetic Gamma", H=90 if changed else 80, K="oops", J="missing")]
    lines = []
    for i, row in enumerate(rows, 1):
        cells = []
        for col, val in row.items():
            addr = col + str(i)
            if isinstance(val, int):
                style = ' s="1"' if col in ("G", "Q") else ""
                cells.append(f'<c r="{addr}"{style}><v>{val}</v></c>')
            else:
                cells.append(f'<c r="{addr}" t="inlineStr"><is><t xml:space="preserve">{escape(val)}</t></is></c>')
        if formulas and i == 2:
            cells.append('<c r="D2"><f>1+1</f><v>2</v></c>')
        lines.append(f'<row r="{i}">{"".join(cells)}</row>')
    with ZipFile(out, "w") as book:
        parts = {
            "[Content_Types].xml": '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
            "_rels/.rels": f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="{RNS}/officeDocument" Target="xl/workbook.xml"/></Relationships>',
            "xl/workbook.xml": f'<workbook xmlns="{NS}" xmlns:r="{RNS}"><workbookPr date1904="{int(epoch)}"/><sheets><sheet name="Feuille 1" r:id="rId1"/></sheets></workbook>',
            "xl/_rels/workbook.xml.rels": f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="{RNS}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="{RNS}/styles" Target="styles.xml"/></Relationships>',
            "xl/worksheets/sheet1.xml": f'<worksheet xmlns="{NS}"><sheetData>{"".join(lines)}</sheetData></worksheet>',
            "xl/styles.xml": f'<styleSheet xmlns="{NS}"><cellXfs><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>',
        }
        for name, content in parts.items():
            book.writestr(ZipInfo(name), content)
    return out.getvalue()


class ImportTests(unittest.TestCase):
    def test_business_mapping_and_original_markers(self):
        report, candidates = preview(fixture(), "TN", "2026-11-12")
        first = candidates[0]
        self.assertEqual(first.price_tnd, "60.000")
        self.assertEqual([row.price_tnd for row in candidates], ["60.000", "70.000", "80.000"])
        self.assertEqual(preview(fixture(changed=True))[1][-1].price_tnd, "90.000")
        self.assertEqual(first.birth_date, "2014-12-27")
        self.assertEqual(first.starts_on, "2026-06-01")
        self.assertEqual(first.monthly, {(2026, 6): (" p ", "paid"), (2026, 7): ("-", "unknown"),
            (2026, 8): ("A", "pending"), (2026, 9): ("NP", "unpaid"), (2026, 10): (None, None), (2026, 11): (None, None)})
        self.assertEqual(first.documents, {"certificate": (" x ", "received"), "extract": (None, "unknown")})
        self.assertEqual(first.cells["G"].raw, "42000")
        self.assertEqual(report["appliedRows"], 0)

    def test_quarantine_and_duplicate_candidates(self):
        report, rows = preview(fixture(), "TN")
        self.assertEqual(report["quarantinedRows"], 3)
        self.assertEqual(report["reasons"]["skill_level_required"], 3)
        self.assertTrue(all(row.skill_level is None for row in rows))
        self.assertTrue({"duplicate_guardian_candidate", "duplicate_swimmer_candidate", "ambiguous_birth_date"} <= rows[1].reasons)
        self.assertTrue({"missing_swimmer_identity", "invalid_payment_marker", "invalid_document_marker"} <= rows[2].reasons)
        self.assertIn("guardian_phone_review", preview(fixture())[1][0].reasons)

    def test_snapshot_and_row_fingerprints(self):
        report, rows = preview(fixture(), "TN")
        same, same_rows = preview(fixture(), "TN")
        changed, changed_rows = preview(fixture(changed=True), "TN")
        self.assertEqual(report, same)
        self.assertEqual(rows[0].fingerprint, same_rows[0].fingerprint)
        self.assertEqual(rows[0].fingerprint, changed_rows[0].fingerprint)
        self.assertNotEqual(report["previewDigest"], changed["previewDigest"])
        self.assertNotEqual(report["previewDigest"], preview(fixture())[0]["previewDigest"])

    def test_rejects_changed_template_and_formulas(self):
        for data, reason in [(fixture(labels=LABELS[:-1]), "unexpected_headers"),
                             (fixture(formulas=True), "unsupported_formula"), (fixture(epoch=True), "unsupported_epoch")]:
            with self.subTest(reason=reason), self.assertRaisesRegex(WorkbookError, reason):
                preview(data)

    def test_cli_never_outputs_raw_records_or_accepts_apply(self):
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "synthetic.xlsx"
            path.write_bytes(fixture())
            command = [sys.executable, "-B", str(Path(__file__).with_name("shark_import.py")), str(path)]
            done = subprocess.run(command, capture_output=True, text=True, check=True)
            report = json.loads(done.stdout)
            self.assertEqual(report["mode"], "dry-run")
            for value in ("Synthetic", "20123456", "01/02/2010", "42000"):
                self.assertNotIn(value, done.stdout + done.stderr)
            invalid = subprocess.run([*command, "--apply"], capture_output=True, text=True)
            self.assertNotEqual(invalid.returncode, 0)
            print(json.dumps(report, sort_keys=True))


if __name__ == "__main__":
    unittest.main()

