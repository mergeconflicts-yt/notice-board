#!/bin/sh
# Convert HEIC/HEIF photos (e.g. iPhone imports) to PNG in place, recursively.
# No dependencies — `sips` ships with macOS.
#
# With no arguments it walks ./convert-to-md (and every folder inside it),
# turns each photo into a PNG with the same name in the same folder, and
# removes the original .heic:
#
#   convert-to-md/DESIGN/IMG_6054.HEIC -> convert-to-md/DESIGN/IMG_6054.png
#
# Usage:
#   sh scripts/convert-heic-to-png.sh                  # convert-to-md/, recursive, in place
#   sh scripts/convert-heic-to-png.sh <dir|file> [...] # other folders/files, same rules
#   sh scripts/convert-heic-to-png.sh --keep           # leave the .heic originals in place
#   sh scripts/convert-heic-to-png.sh --dry-run        # print what would happen, touch nothing
#   sh scripts/convert-heic-to-png.sh --no-recursive   # only the top level of each folder
#
# Notes:
#   - Matches *.heic / *.heif case-insensitively.
#   - An existing .png with the same name is never overwritten; that photo is
#     skipped and the .heic is left alone.
#   - The .heic is deleted only after a successful, non-empty PNG write.
#   - Exits non-zero if any file failed to convert.
set -eu

KEEP=0
DRY_RUN=0
RECURSIVE=1
OUTDIR=""

usage() {
  sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'
}

script_dir="$(cd "$(dirname "$0")" && pwd)"
default_dir="$(cd "$script_dir/.." && pwd)/convert-to-md"

inputs_tmp="$(mktemp -t heic2png-inputs.XXXXXX)"
list_tmp="$(mktemp -t heic2png-list.XXXXXX)"
trap 'rm -f "$inputs_tmp" "$list_tmp"' EXIT INT TERM

# Flags may appear before, after, or between inputs. Inputs are spooled to a
# file so paths with spaces survive (no word-splitting on "$@" rebuild).
expect_outdir=0
end_of_flags=0
for arg in "$@"; do
  if [ "$expect_outdir" -eq 1 ]; then
    OUTDIR="$arg"; expect_outdir=0
    continue
  fi
  if [ "$end_of_flags" -eq 0 ]; then
    case "$arg" in
      -h|--help) usage; exit 0 ;;
      -d|--dir|--outdir) expect_outdir=1 ;;
      --dir=*|--outdir=*) OUTDIR="${arg#*=}" ;;
      -r|--recursive) RECURSIVE=1 ;;
      --no-recursive) RECURSIVE=0 ;;
      -k|--keep) KEEP=1 ;;
      -n|--dry-run) DRY_RUN=1 ;;
      --) end_of_flags=1 ;;
      -*) echo "Unknown option: $arg (see --help)" >&2; exit 1 ;;
      *) printf '%s\n' "$arg" >>"$inputs_tmp" ;;
    esac
  else
    printf '%s\n' "$arg" >>"$inputs_tmp"
  fi
done
if [ "$expect_outdir" -eq 1 ]; then
  echo "--dir needs a directory" >&2
  exit 1
fi

if ! command -v sips >/dev/null 2>&1; then
  echo "sips not found — this script needs macOS." >&2
  exit 1
fi

# No explicit inputs: convert the convert-to-md folder next to scripts/.
if [ -s "$inputs_tmp" ]; then
  target_count="$(wc -l <"$inputs_tmp" | tr -d ' ')"
else
  target_count=0
fi
if [ -n "$OUTDIR" ]; then
  printf '%s\n' "$OUTDIR" >>"$inputs_tmp"
  target_count=$((target_count + 1))
fi
if [ "$target_count" -eq 0 ]; then
  if [ ! -d "$default_dir" ]; then
    echo "No input given and $default_dir does not exist." >&2
    exit 1
  fi
  printf '%s\n' "$default_dir" >>"$inputs_tmp"
fi

# 0 = converted, 1 = failed, 2 = skipped.
convert_one() {
  src="$1"
  dest="${src%.*}.png"
  if [ "$src" = "$dest" ]; then
    echo "FAIL $src: source and destination are the same file" >&2
    return 1
  fi
  if [ -e "$dest" ]; then
    echo "SKIP $src: ${dest##*/} already exists" >&2
    return 2
  fi
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "plan $src -> $dest"
    if [ "$KEEP" -eq 1 ]; then :; else echo "plan rm $src"; fi
    return 0
  fi
  if ! sips -s format png "$src" --out "$dest" >/dev/null; then
    rm -f "$dest"
    echo "FAIL $src: sips could not convert it" >&2
    return 1
  fi
  if [ ! -s "$dest" ]; then
    rm -f "$dest"
    echo "FAIL $src: sips produced an empty file" >&2
    return 1
  fi
  if [ "$KEEP" -eq 1 ]; then
    echo "ok   $src -> $dest"
  else
    rm -f "$src"
    echo "ok   $src -> $dest (original removed)"
  fi
  return 0
}

ok=0
fail=0
skip=0

while IFS= read -r input; do
  [ -n "$input" ] || continue
  if [ -f "$input" ]; then
    case "$input" in
      *.[Hh][Ee][Ii][Cc]|*.[Hh][Ee][Ii][Ff])
        st=0; convert_one "$input" || st=$?
        ;;
      *)
        echo "SKIP $input: not a .heic/.heif file" >&2
        skip=$((skip+1)); continue
        ;;
    esac
    case "$st" in
      0) ok=$((ok+1)) ;;
      2) skip=$((skip+1)) ;;
      *) fail=$((fail+1)) ;;
    esac
  elif [ -d "$input" ]; then
    if [ "$RECURSIVE" -eq 1 ]; then
      find "$input" -type f \( -iname '*.heic' -o -iname '*.heif' \) -print >"$list_tmp"
    else
      find "$input" -maxdepth 1 -type f \( -iname '*.heic' -o -iname '*.heif' \) -print >"$list_tmp"
    fi
    if [ ! -s "$list_tmp" ]; then
      echo "SKIP $input: no .heic/.heif files found" >&2
      skip=$((skip+1)); continue
    fi
    while IFS= read -r src; do
      [ -n "$src" ] || continue
      st=0; convert_one "$src" || st=$?
      case "$st" in
        0) ok=$((ok+1)) ;;
        2) skip=$((skip+1)) ;;
        *) fail=$((fail+1)) ;;
      esac
    done <"$list_tmp"
  else
    echo "FAIL $input: no such file or directory" >&2
    fail=$((fail+1))
  fi
done <"$inputs_tmp"

if [ "$DRY_RUN" -eq 1 ]; then
  echo "Dry run: $ok convertible, $skip skipped, $fail failed. Nothing was written."
else
  echo "Done: $ok converted, $skip skipped, $fail failed."
fi
[ "$fail" -eq 0 ]
