"""Local dry run only. Raw cells and row fingerprints never go to stdout or disk."""
import argparse
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from hashlib import sha256
import json
from pathlib import Path
import re
import sys
import unicodedata
from xml.etree import ElementTree
from zipfile import BadZipFile

from xlsx_reader import Cell, WorkbookError, read_source, worksheet

YEAR = 2026
VERSION = "2.0"
COLS = "ABCDEFGHIJKLMNOPQ"
HEADER = ("", "prenom", "nom", "age", "parent", "numero", "date de naissance", "formule",
          "certificat", "extrait", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "date debut")
MONTHS = dict(zip("KLMNOP", range(6, 12)))
PRICES = {Decimal(code): code + ".000" for code in ("60", "70", "80", "90")}
STATUSES = {"P": "paid", "A": "pending", "NP": "unpaid", "-": "unknown"}
DOCS = {"I": "certificate", "J": "extract"}


def normalized(s):
    return " ".join("".join(c for c in unicodedata.normalize("NFKD", s.casefold())
                            if not unicodedata.combining(c)).split())


def digest(value):
    return sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


@dataclass
class Candidate:
    row: int
    cells: dict[str, Cell] = field(repr=False)
    fingerprint: str = field(repr=False)
    reasons: set[str] = field(default_factory=set)
    identity: tuple = field(default=(), repr=False)
    guardian: tuple = field(default=(), repr=False)
    birth_date: str | None = field(default=None, repr=False)
    starts_on: str | None = field(default=None, repr=False)
    price_tnd: str | None = None
    monthly: dict = field(default_factory=dict, repr=False)
    documents: dict = field(default_factory=dict, repr=False)
    skill_level: None = None


def raw(cells, key):
    return cells[key].raw if key in cells else None


def source_date(cell):
    if not cell:
        return None
    if cell.kind == "n" and cell.date_style:
        serial = Decimal(cell.raw)
        if not serial.is_finite() or not 1 <= serial <= 2958465 or serial % 1 or serial == 60:
            raise ValueError
        # Excel's fictitious leap day affects the serials after 59.
        day = date(1899, 12, 31) + timedelta(days=int(serial) - (serial > 60))
    elif cell.kind in {"text", "d"} and re.fullmatch(r"\d{4}-\d{2}-\d{2}", cell.raw.strip()):
        day = date.fromisoformat(cell.raw.strip())
    else:
        raise ValueError
    return day.isoformat()


def parse_phone(cell, country):
    if not cell:
        return None
    value = cell.raw
    if cell.kind == "n":
        if not re.fullmatch(r"\d+", value):
            raise ValueError
    elif cell.kind != "text" or not re.fullmatch(r"\+?[\d .()-]+", value.strip()):
        raise ValueError
    phone = re.sub(r"[ .()-]", "", value)
    if phone.startswith("00"):
        phone = "+" + phone[2:]
    if country == "TN" and re.fullmatch(r"[0-9]{8}", phone):
        phone = "+216" + phone
    if not re.fullmatch(r"\+[1-9][0-9]{7,14}", phone):
        raise ValueError
    return phone


def classify(row, cells, phone_country, today):
    candidate = Candidate(row, cells, digest({k: asdict(v) for k, v in cells.items()}))
    issues = candidate.reasons
    issues.add("skill_level_required")
    first, last = (normalized(raw(cells, key) or "") for key in ("B", "C"))
    if not first or not last or any(cells[key].kind != "text" for key in ("B", "C") if key in cells):
        issues.add("missing_swimmer_identity")
    else:
        candidate.identity = (first, last)
    parent_name = normalized(raw(cells, "E") or "")
    try:
        phone = parse_phone(cells.get("F"), phone_country)
    except ValueError:
        phone = None
        issues.add("guardian_phone_review")
    if "E" in cells or "F" in cells:
        if not parent_name or phone is None or cells.get("E", Cell("", "")).kind != "text":
            issues.add("guardian_contact_review")
        candidate.guardian = (parent_name, phone)
    for column, attr, issue in (("G", "birth_date", "ambiguous_birth_date"), ("Q", "starts_on", "invalid_start_date")):
        try:
            day = source_date(cells.get(column))
            if column == "G" and day and day > today:
                raise ValueError
            setattr(candidate, attr, day)
        except (ValueError, InvalidOperation, OverflowError):
            issues.add(issue)
    formula = cells.get("H")
    try:
        token = formula.raw.strip() if formula else ""
        candidate.price_tnd = PRICES.get(Decimal(token)) if re.fullmatch(r"[0-9]+(?:\.[0-9]+)?", token) and formula.kind in {"n", "text"} else None
    except InvalidOperation:
        candidate.price_tnd = None
    if not candidate.price_tnd:
        issues.add("invalid_plan")
    for column, month in MONTHS.items():
        token = raw(cells, column)
        status = STATUSES.get(token.strip().upper()) if token is not None else None
        if token is not None and (status is None or cells[column].kind != "text"):
            issues.add("invalid_payment_marker")
            continue
        candidate.monthly[(YEAR, month)] = (token, status)
        if status is not None and candidate.starts_on and candidate.starts_on[:7] > f"{YEAR}-{month:02}":
            issues.add("subscription_period_review")
    for column, name in DOCS.items():
        token = raw(cells, column)
        if token is not None and (token.strip().upper() != "X" or cells[column].kind != "text"):
            issues.add("invalid_document_marker")
            continue
        candidate.documents[name] = (token, "received" if token is not None else "unknown")
    return candidate


def preview(source, phone_country=None, today=None):
    rows = iter(worksheet(source))
    header = next(rows, None)
    if not header or header[0] != 1 or tuple(normalized(raw(header[1], col) or "") for col in COLS) != HEADER:
        raise WorkbookError("unexpected_headers")
    candidates = [classify(row, cells, phone_country, today or date.today().isoformat())
                  for row, cells in rows if cells]
    identities = defaultdict(list)
    guardians = defaultdict(list)
    for candidate in candidates:
        if candidate.identity:
            identities[candidate.identity].append(candidate)
        if candidate.guardian:
            name, phone = candidate.guardian
            if name:
                guardians[("name", name)].append(candidate)
            if phone:
                guardians[("phone", phone)].append(candidate)
    for group, reason in ((identities, "duplicate_swimmer_candidate"), (guardians, "duplicate_guardian_candidate")):
        for matches in group.values():
            if len(matches) > 1:
                for candidate in matches:
                    candidate.reasons.add(reason)
    source_digest = sha256(source).hexdigest()
    preview_digest = digest([VERSION, YEAR, source_digest, phone_country,
                             [(c.row, c.fingerprint, sorted(c.reasons)) for c in candidates]])
    report = {
        "mode": "dry-run", "mappingVersion": VERSION, "billingYear": YEAR,
        "sourceDigest": source_digest, "previewDigest": preview_digest,
        "rows": len(candidates), "quarantinedRows": sum(bool(c.reasons) for c in candidates),
        "reasons": dict(sorted(Counter(r for c in candidates for r in c.reasons).items())),
        "monthlyObservations": dict(sorted(Counter(status or "blank" for c in candidates
                                                     for _, status in c.monthly.values()).items())),
        "documentObservations": dict(sorted(Counter(status for c in candidates
                                                       for _, status in c.documents.values()).items())),
        "appliedRows": 0,
    }
    return report, candidates


def main(argv=None):
    parser = argparse.ArgumentParser(description="Redacted Shark workbook dry run (no database connection)")
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--phone-country", choices=["TN"], help="Only set after confirming local numbers are Tunisian")
    args = parser.parse_args(argv)
    try:
        report, _ = preview(read_source(args.workbook), args.phone_country)
    except WorkbookError as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 2
    except (OSError, BadZipFile, KeyError, UnicodeError, ElementTree.ParseError, ValueError, RuntimeError, NotImplementedError):
        print('{"error":"workbook_unreadable_or_invalid"}', file=sys.stderr)
        return 2
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())

