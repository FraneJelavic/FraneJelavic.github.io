#!/usr/bin/env bash

set -Eeuo pipefail

readonly EXPECTED_HUGO_VERSION="0.164.0"
readonly PRODUCTION_ORIGIN="https://franejelavic.github.io/"
readonly GOATCOUNTER_ENDPOINT="https://franejelavic.goatcounter.com/count"
readonly GOATCOUNTER_LOADER="https://gc.zgo.at/count.js"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

temporary_root=""

cleanup() {
  if [[ -n "${temporary_root}" && -d "${temporary_root}" ]]; then
    rm -rf -- "${temporary_root}"
  fi
}

trap cleanup EXIT

fail() {
  printf 'verify-build: ERROR: %s\n' "$*" >&2
  exit 1
}

note() {
  printf 'verify-build: %s\n' "$*"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

count_occurrences() {
  local file="$1"
  local needle="$2"

  awk -v needle="${needle}" '
    {
      remaining = $0
      while ((position = index(remaining, needle)) > 0) {
        count++
        remaining = substr(remaining, position + length(needle))
      }
    }
    END { print count + 0 }
  ' "${file}"
}

assert_core_artifacts() {
  local production_dir="$1"
  local relative_path
  local required_paths=(
    "index.html"
    "writing/index.html"
    "elsewhere/index.html"
    "about/index.html"
    "privacy/index.html"
    "404.html"
    "sitemap.xml"
    "index.xml"
    "robots.txt"
  )

  for relative_path in "${required_paths[@]}"; do
    [[ -f "${production_dir}/${relative_path}" ]] || fail "missing generated artifact: ${relative_path}"
  done
}

assert_elsewhere_content() {
  local production_dir="$1"
  local elsewhere_file="${production_dir}/elsewhere/index.html"

  grep -Fq 'Understanding the Database' "${elsewhere_file}" || fail "Elsewhere page is missing the DUMP Days talk"
  grep -Fq 'E7xBu7ZdP28' "${elsewhere_file}" || fail "Elsewhere page is missing the timestamped YouTube link"
  grep -Fq 'https://www.infobip.com/developers/blog/ai-developer-support-automation-claude-mcp' "${elsewhere_file}" || fail "Elsewhere page is missing the developer automation article"
  grep -Fq 'https://shiftmag.dev/database-migration-developers-open-heart-surgery-1926/' "${elsewhere_file}" || fail "Elsewhere page is missing the database migration article"
  grep -Fq 'href=/elsewhere/' "${production_dir}/index.html" || fail "primary navigation is missing the Elsewhere page"
}

assert_canonical_urls() {
  local production_dir="$1"
  local html_file

  if grep -ERiq '(https?://|//)localhost([:/]|$)' "${production_dir}"; then
    fail "generated output contains a localhost URL"
  fi

  while IFS= read -r -d '' html_file; do
    if ! grep -Fq "${PRODUCTION_ORIGIN}" "${html_file}" || \
      ! grep -Eq "rel=[\"']?canonical[\"']?[[:space:]]+href=[\"']?https://franejelavic\\.github\\.io/" "${html_file}"; then
      fail "generated HTML is missing a canonical URL on the production origin: ${html_file#"${production_dir}/"}"
    fi
  done < <(find "${production_dir}" -type f -name '*.html' -print0)
}

assert_no_private_content() {
  local production_dir="$1"

  if grep -ERIqi --include='*.html' --include='*.xml' '(/Users/|/home/[^/]+/|file://|private[[:space:]_-]*resume|curriculum[[:space:]]+vitae|r[eé]sum[eé])' "${production_dir}"; then
    fail "generated output contains a private path or resume-related content"
  fi

  if grep -ERIqi --include='*.html' --include='*.xml' '(mailto:|[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,})' "${production_dir}"; then
    fail "generated output contains an email address"
  fi

  if grep -ERIqi --include='*.html' --include='*.xml' '(employer|employment[[:space:]_-]*history|work[[:space:]_-]*experience|job[[:space:]_-]*title)' "${production_dir}"; then
    fail "generated output contains employer or employment-profile language"
  fi

  if grep -ERIqi --include='*.html' --include='*.xml' '<img[^>]+(profile|portrait|headshot)|((profile|portrait|headshot)[[:space:]_-]*(image|photo))' "${production_dir}"; then
    fail "generated output contains profile-image markup"
  fi
}

assert_empty_writing_state() {
  local production_dir="$1"

  if grep -Eqi 'recent([[:space:]_-]|&nbsp;)*writing' "${production_dir}/index.html"; then
    fail "homepage renders recent-writing content when no published posts exist"
  fi
}

assert_goatcounter() {
  local output_dir="$1"
  local expected_count="$2"
  local html_file
  local endpoint_count
  local goatcounter_count
  local loader_count

  while IFS= read -r -d '' html_file; do
    endpoint_count="$(count_occurrences "${html_file}" "${GOATCOUNTER_ENDPOINT}")"
    goatcounter_count="$(count_occurrences "${html_file}" 'goatcounter.com/count')"
    loader_count="$(count_occurrences "${html_file}" "${GOATCOUNTER_LOADER}")"

    [[ "${endpoint_count}" -eq "${expected_count}" ]] || fail "expected ${expected_count} GoatCounter endpoint(s) in ${html_file#"${output_dir}/"}; found ${endpoint_count}"
    [[ "${goatcounter_count}" -eq "${expected_count}" ]] || fail "expected ${expected_count} GoatCounter endpoint reference(s) in ${html_file#"${output_dir}/"}; found ${goatcounter_count}"
    [[ "${loader_count}" -eq "${expected_count}" ]] || fail "expected ${expected_count} GoatCounter loader(s) in ${html_file#"${output_dir}/"}; found ${loader_count}"

    if [[ "${endpoint_count}" -ne "${loader_count}" || "${endpoint_count}" -ne "${goatcounter_count}" ]]; then
      fail "found an incomplete or unexpected GoatCounter integration in ${html_file#"${output_dir}/"}"
    fi
  done < <(find "${output_dir}" -type f -name '*.html' -print0)
}

for required_command in hugo mktemp find grep awk rm; do
  require_command "${required_command}"
done

hugo_version="$(hugo version)"
if [[ ! "${hugo_version}" =~ (^|[[:space:]])hugo[[:space:]]v0\.164\.0([-+][^[:space:]]*)?([[:space:]]|$) ]]; then
  fail "Hugo ${EXPECTED_HUGO_VERSION} is required; found: ${hugo_version}"
fi

temporary_root="$(mktemp -d "${TMPDIR:-/tmp}/frane-site-verify.XXXXXX")"
readonly production_output="${temporary_root}/production"
readonly development_output="${temporary_root}/development"

cd "${PROJECT_ROOT}"

note "building production output with Hugo ${EXPECTED_HUGO_VERSION}"
hugo \
  --gc \
  --minify \
  --panicOnWarning \
  --environment production \
  --noBuildLock \
  --cacheDir "${temporary_root}/cache" \
  --destination "${production_output}" \
  || fail "production Hugo build failed"

note "rendering drafts in memory"
hugo \
  --buildDrafts \
  --renderToMemory \
  --panicOnWarning \
  --environment development \
  --noBuildLock \
  --cacheDir "${temporary_root}/cache" \
  || fail "draft-inclusive Hugo render failed"

note "building nonproduction output for analytics validation"
hugo \
  --buildDrafts \
  --panicOnWarning \
  --environment development \
  --noBuildLock \
  --cacheDir "${temporary_root}/cache" \
  --destination "${development_output}" \
  || fail "nonproduction Hugo build failed"

assert_core_artifacts "${production_output}"
assert_elsewhere_content "${production_output}"
assert_canonical_urls "${production_output}"
assert_no_private_content "${production_output}"
assert_empty_writing_state "${production_output}"
assert_goatcounter "${production_output}" 1
assert_goatcounter "${development_output}" 0

[[ ! -e "${PROJECT_ROOT}/public" ]] || fail "verification unexpectedly created a public/ directory"

note "all production and draft acceptance checks passed"
