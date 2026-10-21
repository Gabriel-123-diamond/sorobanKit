"""Development utility: extract test cases from payment_router sources.

This script was previously located at ``payment_router/extract_tests.py`` in
the repository root, which confused contributors because it is not part of any
documented workflow, CI job, or Makefile target. It has been moved here under
``scripts/`` to make its purpose explicit.

Usage
-----
Run from the ``payment_router/`` directory::

    python scripts/extract_tests.py [--output PATH]

Options
-------
--output PATH
    Write the extracted test cases to ``PATH``. Defaults to stdout.

Notes
-----
This is a developer convenience tool only. It is not invoked by the test
suite, CI, or any build target, and it is safe to run repeatedly.
"""

import argparse
import json
import sys
from pathlib import Path


def extract_test_cases(root: Path):
    """Collect test case definitions found under ``root``.

    Scans Python files for functions whose names start with ``test_`` and
    returns a list of ``{"file": ..., "name": ...}`` records.
    """
    cases = []
    for path in sorted(root.rglob("*.py")):
        if path.name == Path(__file__).name:
            continue
        try:
            source = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        for line in source.splitlines():
            stripped = line.strip()
            if stripped.startswith("def test_"):
                name = stripped[len("def "):].split("(", 1)[0]
                cases.append({"file": str(path), "name": name})
    return cases


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Extract test cases from payment_router sources."
    )
    parser.add_argument(
        "--output",
        help="Write extracted test cases to this path instead of stdout.",
    )
    args = parser.parse_args(argv)

    root = Path(__file__).resolve().parent.parent
    cases = extract_test_cases(root)
    payload = json.dumps(cases, indent=2)

    if args.output:
        Path(args.output).write_text(payload + "\n", encoding="utf-8")
    else:
        sys.stdout.write(payload + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
