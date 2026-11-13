"""Bounded reader for the academy's single-sheet XLSX template. Never evaluates formulas."""
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
import posixpath
import re
from xml.etree import ElementTree as ET
from zipfile import ZipFile

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
MAX_BYTES = 8 * 1024 * 1024
MAX_ROWS = 5000


class WorkbookError(ValueError):
    pass


@dataclass(frozen=True)
class Cell:
    kind: str
    raw: str
    date_style: bool = False


def read_source(path: Path) -> bytes:
    if path.suffix.lower() != ".xlsx":
        raise WorkbookError("invalid_file_type")
    with path.open("rb") as handle:
        data = handle.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise WorkbookError("size_limit")
    return data


def worksheet(data: bytes):
    with ZipFile(BytesIO(data)) as archive:
        entries = archive.infolist()
        if (len(entries) > 200 or len({x.filename for x in entries}) != len(entries)
                or sum(x.file_size for x in entries) > 24 * 1024 * 1024):
            raise WorkbookError("archive_limit")

        def xml(path):
            raw = archive.read(path).decode("utf-8-sig")
            if "<!DOCTYPE" in raw.upper() or "<!ENTITY" in raw.upper():
                raise WorkbookError("unsafe_xml")
            return ET.fromstring(raw)

        book = xml("xl/workbook.xml")
        props = book.find(NS + "workbookPr")
        if props is not None and props.get("date1904", "0") not in {"0", "false"}:
            raise WorkbookError("unsupported_epoch")
        sheets = book.findall(NS + "sheets/" + NS + "sheet")
        if len(sheets) != 1 or sheets[0].get("name") != "Feuille 1" or sheets[0].get("state", "visible") != "visible":
            raise WorkbookError("unexpected_worksheet")
        relations = xml("xl/_rels/workbook.xml.rels")
        matches = [item for item in relations if item.get("Id") == sheets[0].get(REL)
                   and item.get("Type", "").endswith("/worksheet") and item.get("TargetMode") != "External"]
        if len(matches) != 1:
            raise WorkbookError("invalid_worksheet_relationship")
        target = matches[0].get("Target", "")
        target = posixpath.normpath(target.lstrip("/") if target.startswith("/") else "xl/" + target)
        if not re.fullmatch(r"xl/worksheets/[\w-]+\.xml", target):
            raise WorkbookError("invalid_worksheet_relationship")

        def string(node):
            if node is None:
                return ""
            return "".join(t.text or "" for t in [*node.findall(NS + "t"), *node.findall(NS + "r/" + NS + "t")])

        strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            strings = [string(item) for item in xml("xl/sharedStrings.xml").findall(NS + "si")]

        date_styles = set()
        if "xl/styles.xml" in archive.namelist():
            styles = xml("xl/styles.xml")
            custom = {}
            for fmt in styles.findall(NS + "numFmts/" + NS + "numFmt"):
                code = re.sub(r'"[^"]*"|\\.|[\[][^\]]*\]', "", fmt.get("formatCode", "").lower())
                custom[fmt.get("numFmtId")] = bool(re.search(r"[dy]", code))
            for i, fmt in enumerate(styles.findall(NS + "cellXfs/" + NS + "xf")):
                kind = fmt.get("numFmtId", "0")
                if kind in {"14", "15", "16", "17", "22"} or custom.get(kind, False):
                    date_styles.add(str(i))

        last_row = 0
        for row in xml(target).findall(NS + "sheetData/" + NS + "row"):
            r = int(row.get("r", "0"))
            if not last_row < r <= MAX_ROWS + 1:
                raise WorkbookError("row_limit_or_order")
            last_row = r
            values = {}
            seen = set()
            for node in row.findall(NS + "c"):
                coord = re.fullmatch(r"([A-Z]{1,3})([1-9]\d*)", node.get("r", ""))
                if not coord or int(coord[2]) != r or coord[1] in seen:
                    raise WorkbookError("invalid_cell_reference")
                column = coord[1]
                seen.add(column)
                if node.find(NS + "f") is not None:
                    raise WorkbookError("unsupported_formula")
                kind = node.get("t", "n")
                raw = node.findtext(NS + "v")
                if kind == "inlineStr":
                    raw = string(node.find(NS + "is"))
                elif kind == "s" and raw is not None:
                    if not raw.isascii() or not raw.isdecimal() or int(raw) >= len(strings):
                        raise WorkbookError("invalid_shared_string")
                    raw = strings[int(raw)]
                if raw is None or raw == "":
                    continue
                if len(raw) > 1024 or column not in "ABCDEFGHIJKLMNOPQ" or len(column) != 1:
                    raise WorkbookError("unexpected_cell")
                normalized_kind = "text" if kind in {"s", "inlineStr", "str"} else kind
                values[column] = Cell(normalized_kind, raw, node.get("s", "0") in date_styles)
            yield r, values

