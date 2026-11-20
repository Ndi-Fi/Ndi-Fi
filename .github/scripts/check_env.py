#!/usr/bin/env python3
"""Validate .env.example against required vars and code references.

Checks:
  1. .env.example parses: every non-comment line is KEY=value, no duplicate keys.
  2. Every variable in .github/env/required.txt is in .env.example.
  3. Every variable the code reads is in .env.example.
  4. Every variable in .env.example is read somewhere in the code
     (a warning by default, an error with --strict).

Exit code is 1 if any error was found. Errors and warnings are printed as
GitHub Actions annotations so they show up on the PR.

Usage: python3 .github/scripts/check_env.py [--strict] [--root DIR]
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ENV_EXAMPLE = ".env.example"
REQUIRED_FILE = ".github/env/required.txt"

# Directories never scanned for references (dependencies, build output, CI itself).
SKIP_DIRS = {
    ".git", ".github", "lib", "node_modules", "target", "out", "cache",
    "broadcast", "dist", "build", ".next", "docs",
}

NAME = r"([A-Z][A-Z0-9_]*)"

# File suffix -> regexes whose first group is an env var name.
PATTERNS: dict[tuple[str, ...], list[re.Pattern[str]]] = {
    # Foundry cheatcodes: vm.envUint("X"), vm.envOr("X", ...), vm.envAddress("X") ...
    (".sol",): [re.compile(r'\bvm\.env[A-Za-z0-9]*\(\s*"' + NAME + '"')],
    # Shell parameter expansion with a default: ${X:-...}, ${X-...}, ${X:?...}, ${X:=...}
    (".sh", ".bash"): [re.compile(r"\$\{" + NAME + r":?[-?=]")],
    # Node / Vite / Next
    (".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"): [
        re.compile(r"\bprocess\.env\.\s*" + NAME + r"\b"),
        re.compile(r"""\bprocess\.env\[\s*['"]""" + NAME + r"""['"]\s*\]"""),
        re.compile(r"\bimport\.meta\.env\.\s*" + NAME + r"\b"),
    ],
    # Rust
    (".rs",): [
        re.compile(r'\benv::var(?:_os)?\(\s*"' + NAME + '"'),
        re.compile(r'\b(?:option_)?env!\(\s*"' + NAME + '"'),
    ],
    # Python
    (".py",): [
        re.compile(r"""\bos\.environ\[\s*['"]""" + NAME + r"""['"]\s*\]"""),
        re.compile(r"""\bos\.(?:environ\.get|getenv)\(\s*['"]""" + NAME + r"""['"]"""),
    ],
}

# Variables provided by the runtime, never set by a user.
IGNORED = {"NODE_ENV", "CI", "HOME", "PATH", "PWD", "USER", "SHELL", "TMPDIR"}

LINE_RE = re.compile(r"^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$")


class Report:
    def __init__(self) -> None:
        self.errors = 0
        self.warnings = 0

    def error(self, msg: str, file: str | None = None, line: int | None = None) -> None:
        self.errors += 1
        print(f"::error{_loc(file, line)}::{msg}")

    def warning(self, msg: str, file: str | None = None, line: int | None = None) -> None:
        self.warnings += 1
        print(f"::warning{_loc(file, line)}::{msg}")


def _loc(file: str | None, line: int | None) -> str:
    if not file:
        return ""
    return f" file={file}" + (f",line={line}" if line else "")


def parse_env_example(path: Path, report: Report) -> dict[str, int]:
    keys: dict[str, int] = {}
    for n, raw in enumerate(path.read_text().splitlines(), start=1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        m = LINE_RE.match(line)
        if not m:
            report.error(f"Malformed line (expected KEY=value): {raw!r}", ENV_EXAMPLE, n)
            continue
        key = m.group(1)
        if key in keys:
            report.error(f"Duplicate key {key} (first defined on line {keys[key]})", ENV_EXAMPLE, n)
            continue
        keys[key] = n
    return keys


def parse_required(path: Path) -> dict[str, int]:
    req: dict[str, int] = {}
    if not path.exists():
        return req
    for n, raw in enumerate(path.read_text().splitlines(), start=1):
        line = raw.split("#", 1)[0].strip()
        if line:
            req.setdefault(line, n)
    return req


def iter_source_files(root: Path):
    suffixes = {s for group in PATTERNS for s in group}
    for path in root.rglob("*"):
        rel = path.relative_to(root)
        if any(part in SKIP_DIRS for part in rel.parts[:-1]):
            continue
        if path.is_file() and path.suffix in suffixes:
            yield path


def find_references(root: Path) -> dict[str, tuple[str, int]]:
    """Return var name -> first (file, line) where it is read."""
    refs: dict[str, tuple[str, int]] = {}
    for path in sorted(iter_source_files(root)):
        patterns = next(p for group, p in PATTERNS.items() if path.suffix in group)
        try:
            text = path.read_text(errors="replace")
        except OSError:
            continue
        rel = str(path.relative_to(root))
        for n, line in enumerate(text.splitlines(), start=1):
            for pat in patterns:
                for m in pat.finditer(line):
                    name = m.group(1)
                    if name not in IGNORED:
                        refs.setdefault(name, (rel, n))
    return refs


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--strict", action="store_true",
                    help="treat vars in .env.example that no code reads as errors")
    ap.add_argument("--root", default=".", help="repository root (default: .)")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    report = Report()

    example_path = root / ENV_EXAMPLE
    if not example_path.exists():
        report.error(f"{ENV_EXAMPLE} not found")
        return 1

    documented = parse_env_example(example_path, report)
    required = parse_required(root / REQUIRED_FILE)
    refs = find_references(root)

    for name, n in required.items():
        if name not in documented:
            report.error(f"Required variable {name} is missing from {ENV_EXAMPLE}", REQUIRED_FILE, n)

    for name, (file, n) in sorted(refs.items()):
        if name not in documented:
            report.error(f"{name} is read here but not documented in {ENV_EXAMPLE}", file, n)

    for name, n in documented.items():
        if name not in refs and name not in required:
            msg = f"{name} is in {ENV_EXAMPLE} but no code reads it (renamed or removed?)"
            (report.error if args.strict else report.warning)(msg, ENV_EXAMPLE, n)

    print(
        f"Checked {len(documented)} documented, {len(required)} required and "
        f"{len(refs)} referenced variables: {report.errors} error(s), {report.warnings} warning(s)."
    )
    return 1 if report.errors else 0


if __name__ == "__main__":
    sys.exit(main())
