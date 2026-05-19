#!/usr/bin/env python3
"""Restore corrupted string literals in page.tsx from git blob (ae3ccda)."""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

COMMIT = "ae3ccda"
FILE = "apps/web/src/app/app/page.tsx"
TARGET = Path("apps/web/src/app/app/page.tsx")


def git_show(commit: str, path: str) -> str:
    r = subprocess.run(
        ["git", "show", f"{commit}:{path}"],
        capture_output=True,
        check=True,
    )
    return r.stdout.decode("utf-8")


def extract_strings(line: str) -> list[str]:
    return re.findall(r'"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`', line)


def skeleton(line: str) -> str:
    s = re.sub(r'"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`', '""', line)
    return re.sub(r"\s+", " ", s.strip())


def is_corrupted(s: str) -> bool:
    if "\u0098" in s:
        return True
    if "╨" in s or "╤" in s:
        return True
    if re.search(r"Р[\u0080-\u00ff\u0400-\u045f]{1,3}[\u0400-\u045f]", s):
        return True
    # mixed: ASCII + Р style
    if "Р\u008f" in s or "РЎ" in s or "вЂ" in s:
        return True
    return False


def line_corrupted(line: str) -> bool:
    for s in extract_strings(line):
        inner = s[1:-1] if len(s) >= 2 else s
        if is_corrupted(inner):
            return True
    return is_corrupted(line)


def main() -> None:
    good_lines = git_show(COMMIT, FILE).splitlines()
    bad_text = TARGET.read_text(encoding="utf-8")
    bad_lines = bad_text.splitlines()

    index: dict[str, list[str]] = {}
    for line in good_lines:
        if '"' not in line and "`" not in line:
            continue
        sk = skeleton(line)
        strs = extract_strings(line)
        if strs and sk not in index:
            index[sk] = strs

    out: list[str] = []
    fixed = 0
    missed = 0
    for line in bad_lines:
        if not line_corrupted(line):
            out.append(line)
            continue
        sk = skeleton(line)
        good_strs = index.get(sk)
        if not good_strs:
            missed += 1
            out.append(line)
            continue
        idx = 0

        def sub(m: re.Match[str]) -> str:
            nonlocal idx
            if idx < len(good_strs):
                s = good_strs[idx]
                idx += 1
                return s
            return m.group(0)

        new_line = re.sub(r'"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`', sub, line)
        if new_line != line:
            fixed += 1
        out.append(new_line)

    TARGET.write_text("\n".join(out) + "\n", encoding="utf-8", newline="\n")
    remaining = sum(1 for l in out if line_corrupted(l))
    print(f"fixed {fixed} lines, missed {missed}, still corrupted {remaining}")


if __name__ == "__main__":
    main()
