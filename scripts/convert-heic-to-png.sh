#!/bin/sh
# Convert HEIC/HEIF photos (e.g. iPhone imports) to PNG using macOS `sips`.
# No dependencies — `sips` ships with macOS.
#
# Usage:
#   sh scripts/convert-heic-to-png.sh [--outdir DIR] [--recursive] <file|dir> [...]
#   sh scripts/convert-heic-to-png.sh photo.HEIC
#   sh scripts/convert-heic-to-png.sh photo.heic converted.png
#   sh scripts/convert-heic-to-png.sh ./photos --outdir ./png
#   sh scripts/convert-heic-to-png.sh ./photos --recursive --outdir ./png
#
# Notes:
#   - Matches *.heic / *.heif case-insensitively.
#   - Default output is alongside the source with a .png extension.
#   - `--outdir` redirects all outputs into one directory (created if needed).
#     It flattens: identical basenames from different folders collide (last wins).
#   - Exits non-zero if any file fails to convert.
set -eu

OUTDIR=""
RECURSIVE=0

usage() {
  sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
}

convert_one() {
  src="$1"
  dest="$2"
  if [ -n "$OUTDIR" ]; then
    mkdir -p "$OUTDIR"
    base="$(basename "$src")"
    base="${base%.*}"
    dest="$OUTDIR/$base.png"
  elif [ -z "$dest" ]; then
    dest="${src%.*}.png"
  elif [ -d "$dest" ]; then
    base="$(basename "$src")"
    base="${base%.*}"
    dest="$dest/$base.png"
  fi
  case "$dest" in
    *.png|*.PNG) ;;
    *) dest="$dest.png" ;;
  esac
  if [ "$src" = "$dest" ]; then
    echo "FAIL $src: source and destination are the same file" >&2
    return 1
  fi
  sips -s format png "$src" --out "$dest" >/dev/null
  echo "ok   $src -> $dest"
}

OUTDIR_SET=""
inputs_tmp="$(mktemp -t heic2png-inputs.XXXXXX)"
list_tmp="$(mktemp -t heic2png-list.XXXXXX)"
trap 'rm -f "$inputs_tmp" "$list_tmp"' EXIT INT TERM

# Flags may appear before, after, or between inputs. Inputs are spooled to
# a file so paths with spaces survive (no word-splitting on "$@" rebuild).
expect_outdir=0
end_of_flags=0
for arg in "$@"; do
  if [ "$expect_outdir" -eq 1 ]; then
    OUTDIR="$arg"; OUTDIR_SET=1; expect_outdir=0
    continue
  fi
  if [ "$end_of_flags" -eq 0 ]; then
    case "$arg" in
      -h|--help) usage; exit 0 ;;
      --outdir) expect_outdir=1 ;;
      --outdir=*) OUTDIR="${arg#--outdir=}"; OUTDIR_SET=1 ;;
      -r|--recursive) RECURSIVE=1 ;;
      --) end_of_flags=1 ;;
      -*) echo "Unknown option: $arg (see --help)" >&2; exit 1 ;;
      *) printf '%s\n' "$arg" >>"$inputs_tmp" ;;
    esac
  else
    printf '%s\n' "$arg" >>"$inputs_tmp"
  fi
done
if [ "$expect_outdir" -eq 1 ]; then
  echo "--outdir needs a directory" >&2
  exit 1
fi

if ! command -v sips >/dev/null 2>&1; then
  echo "sips not found — this script needs macOS." >&2
  exit 1
fi

if [ ! -s "$inputs_tmp" ]; then
  usage >&2
  exit 1
fi

# Single-file to single-file form: `script in.heic out.png`
# (only when --outdir is not used and exactly two args are given,
# the first is a file and the second is not an existing directory).
count="$(wc -l <"$inputs_tmp" | tr -d ' ')"
if [ -z "${OUTDIR_SET:-}" ] && [ "$count" -eq 2 ]; then
  first="$(sed -n '1p' "$inputs_tmp")"
  second="$(sed -n '2p' "$inputs_tmp")"
  if [ -f "$first" ] && [ ! -d "$second" ]; then
    convert_one "$first" "$second"
    exit 0
  fi
fi

ok=0
fail=0

while IFS= read -r input; do
  [ -n "$input" ] || continue
  if [ -f "$input" ]; then
    case "$input" in
      *.[Hh][Ee][Ii][Cc]|*.[Hh][Ee][Ii][Ff])
        if convert_one "$input" ""; then ok=$((ok+1)); else fail=$((fail+1)); fi
        ;;
      *)
        echo "SKIP $input: not a .heic/.heif file" >&2
        ;;
    esac
  elif [ -d "$input" ]; then
    if [ "$RECURSIVE" -eq 1 ]; then
      find "$input" -type f \( -iname '*.heic' -o -iname '*.heif' \) -print >"$list_tmp"
    else
      find "$input" -maxdepth 1 -type f \( -iname '*.heic' -o -iname '*.heif' \) -print >"$list_tmp"
    fi
    if [ ! -s "$list_tmp" ]; then
      echo "SKIP $input: no .heic/.heif files found" >&2
      continue
    fi
    while IFS= read -r src; do
      [ -n "$src" ] || continue
      if convert_one "$src" ""; then ok=$((ok+1)); else fail=$((fail+1)); fi
    done <"$list_tmp"
  else
    echo "FAIL $input: no such file or directory" >&2
    fail=$((fail+1))
  fi
done <"$inputs_tmp"

echo "Done: $ok converted, $fail failed."
[ "$fail" -eq 0 ]
