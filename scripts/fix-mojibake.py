#!/usr/bin/env python3
"""Fix UTF-8 mojibake (UTF-8 misread as Windows-1251, saved as UTF-8)."""
from pathlib import Path
import sys


def fix_line(line: str) -> str:
    try:
        return line.encode("cp1251").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return line


def main() -> None:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "apps/web/src/app/app/page.tsx")
    text = path.read_text(encoding="utf-8")

    # Mojibake marker: Cyrillic capital Er (U+0420) at start of corrupted words
    if "\u0414\u0430\u0448\u0431\u043e\u0440\u0434" in text:
        print("already ok:", path)
        return

    lines_out = []
    changed = 0
    for line in text.splitlines(keepends=True):
        fixed = fix_line(line)
        if fixed != line:
            changed += 1
        lines_out.append(fixed)

    path.write_text("".join(lines_out), encoding="utf-8", newline="\n")
    print(f"fixed {changed} lines in", path)


if __name__ == "__main__":
    main()
