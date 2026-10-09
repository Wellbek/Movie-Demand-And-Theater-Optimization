#!/usr/bin/env bash
# Packs exactly the three deliverables into studentID_name.zip (brief, Section 4).
# Usage: tools/make_zip.sh <studentID> <name>
set -euo pipefail
[ $# -eq 2 ] || { echo "usage: $0 <studentID> <name>" >&2; exit 2; }
cd "$(dirname "$0")/.."
out="$1_$2.zip"
rm -f "$out"
zip -q -X "$out" problem-definition.md demo.html proposal.html
unzip -l "$out"
