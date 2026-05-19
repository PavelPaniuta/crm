#!/usr/bin/env python3
"""Fix UTF-8 mojibake (UTF-8 misread as Windows-1251). Handles lines with emoji."""
from pathlib import Path
import sys


def try_fix(s: str) -> str | None:
    if not s:
        return s
    try:
        return s.encode("cp1251").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return None


def fix_mixed(s: str) -> str:
    out: list[str] = []
    i = 0
    n = len(s)
    while i < n:
        ch = s[i]
        o = ord(ch)
        # ASCII
        if o < 128:
            out.append(ch)
            i += 1
            continue
        # Collect chunk until next ASCII
        j = i
        while j < n and ord(s[j]) >= 128:
            j += 1
        chunk = s[i:j]
        fixed = try_fix(chunk)
        out.append(fixed if fixed is not None else chunk)
        i = j
    return "".join(out)


def fix_line(line: str) -> str:
    whole = try_fix(line)
    if whole is not None:
        return whole
    return fix_mixed(line)


def main() -> None:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "apps/web/src/app/app/page.tsx")
    text = path.read_text(encoding="utf-8")

    lines_out = []
    changed = 0
    for line in text.splitlines(keepends=True):
        fixed = fix_line(line)
        if fixed != line:
            changed += 1
        lines_out.append(fixed)

    path.write_text("".join(lines_out), encoding="utf-8", newline="\n")
    print(f"fixed {changed} lines in", path)

    # report remaining mojibake markers
    bad = sum(1 for l in "".join(lines_out).splitlines() if "Рџ" in l or "РЎ" in l and "Сдел" not in l)
    print(f"lines still suspicious: {bad}")


if __name__ == "__main__":
    main()
