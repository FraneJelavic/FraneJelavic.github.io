#!/usr/bin/env bash

set -Eeuo pipefail

readonly EXPECTED_HUGO_VERSION="0.164.0"
readonly PRODUCTION_ORIGIN="https://franejelavic.github.io/"
readonly GOATCOUNTER_ENDPOINT="https://franejelavic.goatcounter.com/count"
readonly GOATCOUNTER_LOADER="https://gc.zgo.at/count.js"
readonly FIXED_CLOCK="2026-08-05T12:00:00+02:00"
readonly FEATURE_TITLE="Validation Fixture: Feature Article"
readonly SECONDARY_TITLE="Validation Fixture: Secondary Article"
readonly DRAFT_CONTROL_TITLE="Validation Control: Draft Must Stay Hidden"
readonly FUTURE_CONTROL_TITLE="Validation Control: Future Must Stay Hidden"
readonly EXPIRED_CONTROL_TITLE="Validation Control: Expired Must Stay Hidden"
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

assert_contains() {
  local scenario="$1"
  local output_dir="$2"
  local relative_path="$3"
  local needle="$4"
  local contract="$5"
  local file="${output_dir}/${relative_path}"

  [[ -f "${file}" ]] || fail "${scenario}: ${relative_path}: missing file required for ${contract}"
  grep -Fq -- "${needle}" "${file}" || fail "${scenario}: ${relative_path}: missing contract: ${contract}"
}

assert_not_contains() {
  local scenario="$1"
  local output_dir="$2"
  local relative_path="$3"
  local needle="$4"
  local contract="$5"
  local file="${output_dir}/${relative_path}"

  [[ -f "${file}" ]] || fail "${scenario}: ${relative_path}: missing file required for ${contract}"
  if grep -Fq -- "${needle}" "${file}"; then
    fail "${scenario}: ${relative_path}: violated contract: ${contract}"
  fi
}

assert_before() {
  local scenario="$1"
  local output_dir="$2"
  local relative_path="$3"
  local first="$4"
  local second="$5"
  local contract="$6"
  local file="${output_dir}/${relative_path}"

  [[ -f "${file}" ]] || fail "${scenario}: ${relative_path}: missing file required for ${contract}"
  awk -v first="${first}" -v second="${second}" '
    { content = content $0 "\n" }
    END {
      first_position = index(content, first)
      second_position = index(content, second)
      exit !(first_position > 0 && second_position > 0 && first_position < second_position)
    }
  ' "${file}" || fail "${scenario}: ${relative_path}: invalid ordering: ${contract}"
}

assert_output_excludes() {
  local scenario="$1"
  local output_dir="$2"
  local needle="$3"
  local contract="$4"
  local matched_file=""

  while IFS= read -r matched_file; do
    break
  done < <(grep -RIlF -- "${needle}" "${output_dir}" 2>/dev/null || true)

  if [[ -n "${matched_file}" ]]; then
    fail "${scenario}: ${matched_file#"${output_dir}/"}: violated contract: ${contract}"
  fi
}

assert_output_path_absent() {
  local scenario="$1"
  local output_dir="$2"
  local relative_path="$3"
  local contract="$4"

  [[ ! -e "${output_dir}/${relative_path}" ]] || fail "${scenario}: ${relative_path}: violated contract: ${contract}"
}

assert_core_artifacts() {
  local scenario="$1"
  local production_dir="$2"
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
    [[ -f "${production_dir}/${relative_path}" ]] || fail "${scenario}: ${relative_path}: missing generated artifact"
  done
}

assert_elsewhere_content() {
  local scenario="$1"
  local production_dir="$2"

  assert_contains "${scenario}" "${production_dir}" "elsewhere/index.html" "Understanding the Database" "DUMP Days talk"
  assert_contains "${scenario}" "${production_dir}" "elsewhere/index.html" "E7xBu7ZdP28" "timestamped YouTube link"
  assert_contains "${scenario}" "${production_dir}" "elsewhere/index.html" "https://www.infobip.com/developers/blog/ai-developer-support-automation-claude-mcp" "developer automation article"
  assert_contains "${scenario}" "${production_dir}" "elsewhere/index.html" "https://shiftmag.dev/database-migration-developers-open-heart-surgery-1926/" "database migration article"
  assert_contains "${scenario}" "${production_dir}" "index.html" "href=/elsewhere/" "Elsewhere primary navigation item"
}

assert_canonical_urls() {
  local scenario="$1"
  local production_dir="$2"
  local html_file

  if grep -ERiq '(https?://|//)localhost([:/]|$)' "${production_dir}"; then
    fail "${scenario}: generated output contains a localhost URL"
  fi

  while IFS= read -r -d '' html_file; do
    if ! grep -Fq "${PRODUCTION_ORIGIN}" "${html_file}" || \
      ! grep -Eq "rel=[\"']?canonical[\"']?[[:space:]]+href=[\"']?https://franejelavic\\.github\\.io/" "${html_file}"; then
      fail "${scenario}: ${html_file#"${production_dir}/"}: missing canonical URL on the production origin"
    fi
  done < <(find "${production_dir}" -type f -name '*.html' -print0)
}

assert_no_private_content() {
  local scenario="$1"
  local production_dir="$2"

  if grep -ERIqi --include='*.html' --include='*.xml' '(/Users/|/home/[^/]+/|file://|private[[:space:]_-]*resume|curriculum[[:space:]]+vitae|r[eé]sum[eé])' "${production_dir}"; then
    fail "${scenario}: generated output contains a private path or resume-related content"
  fi

  if grep -ERIqi --include='*.html' --include='*.xml' '(mailto:|[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,})' "${production_dir}"; then
    fail "${scenario}: generated output contains an email address"
  fi

  if grep -ERIqi --include='*.html' --include='*.xml' '(works[[:space:]_-]+at|worked[[:space:]_-]+at|working[[:space:]_-]+at|my[[:space:]_-]+employer|employment[[:space:]_-]*(history|timeline)|work[[:space:]_-]*experience|job[[:space:]_-]*title|career[[:space:]_-]*timeline)' "${production_dir}"; then
    fail "${scenario}: generated output contains prohibited employment-profile language"
  fi

  if grep -ERIqi --include='*.html' --include='*.xml' '<img[^>]+(profile|portrait|headshot)|((profile|portrait|headshot)[[:space:]_-]*(image|photo))' "${production_dir}"; then
    fail "${scenario}: generated output contains profile-image markup"
  fi
}

assert_zero_writing_state() {
  local scenario="$1"
  local output_dir="$2"

  assert_not_contains "${scenario}" "${output_dir}" "index.html" "class=recent-writing" "zero-post homepage must not render recent-writing structure"
  assert_not_contains "${scenario}" "${output_dir}" "index.html" "recent-writing-title" "zero-post homepage must not render the recent-writing heading"
  assert_not_contains "${scenario}" "${output_dir}" "index.html" "All writing" "zero-post homepage must not render the archive call-to-action"
  assert_not_contains "${scenario}" "${output_dir}" "writing/index.html" "class=post-groups" "zero-post archive must not render year groups"
  assert_not_contains "${scenario}" "${output_dir}" "writing/index.html" "class=post-list" "zero-post archive must not render a post list"
}

assert_published_writing_state() {
  local scenario="$1"
  local output_dir="$2"

  assert_contains "${scenario}" "${output_dir}" "index.html" "recent-writing" "published homepage section"
  assert_contains "${scenario}" "${output_dir}" "index.html" "recent-writing-title" "published homepage section ID"
  assert_contains "${scenario}" "${output_dir}" "index.html" "All writing" "published homepage archive link"
  assert_contains "${scenario}" "${output_dir}" "index.html" "post-list" "published homepage post list"
  assert_contains "${scenario}" "${output_dir}" "writing/index.html" "post-groups" "published archive year groups"
  assert_contains "${scenario}" "${output_dir}" "writing/index.html" "post-year" "published archive year section"
  assert_contains "${scenario}" "${output_dir}" "writing/index.html" "post-list" "published archive post list"
}

assert_actual_writing_state() {
  local scenario="$1"
  local output_dir="$2"
  local article_file=""

  if [[ -d "${output_dir}/writing" ]]; then
    while IFS= read -r article_file; do
      break
    done < <(find "${output_dir}/writing" -mindepth 2 -type f -name 'index.html' -print)
  fi

  if [[ -n "${article_file}" ]]; then
    note "${scenario}: detected published writing output at ${article_file#"${output_dir}/"}"
    assert_published_writing_state "${scenario}" "${output_dir}"
  else
    note "${scenario}: detected zero published writing articles"
    assert_zero_writing_state "${scenario}" "${output_dir}"
  fi
}

assert_goatcounter() {
  local scenario="$1"
  local output_dir="$2"
  local expected_count="$3"
  local html_file
  local endpoint_count
  local goatcounter_count
  local loader_count

  while IFS= read -r -d '' html_file; do
    endpoint_count="$(count_occurrences "${html_file}" "${GOATCOUNTER_ENDPOINT}")"
    goatcounter_count="$(count_occurrences "${html_file}" 'goatcounter.com/count')"
    loader_count="$(count_occurrences "${html_file}" "${GOATCOUNTER_LOADER}")"

    [[ "${endpoint_count}" -eq "${expected_count}" ]] || fail "${scenario}: ${html_file#"${output_dir}/"}: expected ${expected_count} GoatCounter endpoint(s); found ${endpoint_count}"
    [[ "${goatcounter_count}" -eq "${expected_count}" ]] || fail "${scenario}: ${html_file#"${output_dir}/"}: expected ${expected_count} GoatCounter endpoint reference(s); found ${goatcounter_count}"
    [[ "${loader_count}" -eq "${expected_count}" ]] || fail "${scenario}: ${html_file#"${output_dir}/"}: expected ${expected_count} GoatCounter loader(s); found ${loader_count}"

    if [[ "${endpoint_count}" -ne "${loader_count}" || "${endpoint_count}" -ne "${goatcounter_count}" ]]; then
      fail "${scenario}: ${html_file#"${output_dir}/"}: incomplete or unexpected GoatCounter integration"
    fi
  done < <(find "${output_dir}" -type f -name '*.html' -print0)
}

prepare_scenario_content() {
  local scenario_content="$1"

  mkdir -p "${scenario_content}/writing"
  cp "${PROJECT_ROOT}/content/_index.md" "${scenario_content}/_index.md"
  cp "${PROJECT_ROOT}/content/writing/_index.md" "${scenario_content}/writing/_index.md"
}

build_scenario() {
  local scenario="$1"
  local scenario_content="$2"
  local scenario_output="$3"

  note "building ${scenario} with fixed clock ${FIXED_CLOCK}"
  HUGO_LANGUAGES_EN_CONTENTDIR="${scenario_content}" \
    hugo \
      --clock "${FIXED_CLOCK}" \
      --environment production \
      --panicOnWarning \
      --noBuildLock \
      --cacheDir "${temporary_root}/cache/${scenario}" \
      --destination "${scenario_output}" \
    || fail "${scenario}: Hugo build failed"
}

assert_technical_writing_features() {
  local scenario="$1"
  local output_dir="$2"
  local feature_page="writing/published-feature/index.html"
  local secondary_page="writing/published-secondary/index.html"

  assert_published_writing_state "${scenario}" "${output_dir}"

  assert_contains "${scenario}" "${output_dir}" "index.html" "${FEATURE_TITLE}" "newest fixture on homepage"
  assert_contains "${scenario}" "${output_dir}" "index.html" "${SECONDARY_TITLE}" "older fixture on homepage"
  assert_before "${scenario}" "${output_dir}" "index.html" "${FEATURE_TITLE}" "${SECONDARY_TITLE}" "reverse-chronological homepage order"

  assert_contains "${scenario}" "${output_dir}" "writing/index.html" "id=\"year-2026\"" "2026 archive group"
  assert_contains "${scenario}" "${output_dir}" "writing/index.html" "id=\"year-2025\"" "2025 archive group"
  assert_contains "${scenario}" "${output_dir}" "writing/index.html" "${FEATURE_TITLE}" "newest fixture in archive"
  assert_contains "${scenario}" "${output_dir}" "writing/index.html" "${SECONDARY_TITLE}" "older fixture in archive"
  assert_before "${scenario}" "${output_dir}" "writing/index.html" "id=\"year-2026\"" "id=\"year-2025\"" "reverse-chronological archive year order"
  assert_before "${scenario}" "${output_dir}" "writing/index.html" "${FEATURE_TITLE}" "${SECONDARY_TITLE}" "reverse-chronological archive article order"

  assert_output_excludes "${scenario}" "${output_dir}" "${DRAFT_CONTROL_TITLE}" "draft control must be absent from pages and feeds"
  assert_output_excludes "${scenario}" "${output_dir}" "${FUTURE_CONTROL_TITLE}" "future control must be absent from pages and feeds"
  assert_output_excludes "${scenario}" "${output_dir}" "${EXPIRED_CONTROL_TITLE}" "expired control must be absent from pages and feeds"
  assert_output_path_absent "${scenario}" "${output_dir}" "writing/draft-control/index.html" "draft article output must not exist"
  assert_output_path_absent "${scenario}" "${output_dir}" "writing/future-control/index.html" "future article output must not exist"
  assert_output_path_absent "${scenario}" "${output_dir}" "writing/expired-control/index.html" "expired article output must not exist"

  assert_contains "${scenario}" "${output_dir}" "${feature_page}" "datetime=\"2026-07-15\"" "publication date machine value"
  assert_contains "${scenario}" "${output_dir}" "${feature_page}" "15 July 2026" "publication date text"
  assert_contains "${scenario}" "${output_dir}" "${feature_page}" "1 min read" "estimated reading time"
  assert_contains "${scenario}" "${output_dir}" "${feature_page}" "href=\"/categories/validation-category/\"" "category taxonomy link"
  assert_contains "${scenario}" "${output_dir}" "${feature_page}" "href=\"/tags/validation-tag/\"" "tag taxonomy link"
  assert_contains "${scenario}" "${output_dir}" "${feature_page}" "href=\"/tags/deterministic-checks/\"" "second tag taxonomy link"
  assert_contains "${scenario}" "${output_dir}" "${feature_page}" "class=\"table-of-contents\"" "opt-in table of contents"
  assert_contains "${scenario}" "${output_dir}" "${feature_page}" "href=\"#fixture-architecture\"" "table-of-contents heading link"
  assert_contains "${scenario}" "${output_dir}" "${feature_page}" "id=\"fixture-architecture\"" "stable heading ID"
  assert_contains "${scenario}" "${output_dir}" "${feature_page}" "class=\"heading-anchor\" href=\"#fixture-architecture\"" "stable heading anchor"
  assert_contains "${scenario}" "${output_dir}" "${feature_page}" "class=\"chroma\"" "Chroma syntax highlighting"
  assert_contains "${scenario}" "${output_dir}" "${feature_page}" "class=\"table-scroll\" role=\"region\" aria-label=\"Scrollable table\" tabindex=\"0\"" "accessible wide-table wrapper"
  assert_contains "${scenario}" "${output_dir}" "${feature_page}" "src=\"/writing/published-feature/diagram.svg\"" "bundle-relative image URL"
  assert_contains "${scenario}" "${output_dir}" "${feature_page}" "alt=\"Synthetic validation diagram\"" "bundle image alt text"
  assert_contains "${scenario}" "${output_dir}" "${feature_page}" "loading=\"lazy\" decoding=\"async\"" "bundle image loading attributes"
  assert_contains "${scenario}" "${output_dir}" "${feature_page}" "Synthetic validation diagram caption" "bundle image caption"
  assert_contains "${scenario}" "${output_dir}" "${feature_page}" "<a href=\"/writing/\">Writing archive</a>" "internal link behavior"
  assert_contains "${scenario}" "${output_dir}" "${feature_page}" "href=\"https://example.com/validation\" title=\"External validation reference\" target=\"_blank\" rel=\"noopener noreferrer\"" "external link safety attributes"
  assert_contains "${scenario}" "${output_dir}" "${feature_page}" "<pre class=\"mermaid\">" "Mermaid code-block output"
  assert_contains "${scenario}" "${output_dir}" "${feature_page}" "src=\"/vendor/mermaid/mermaid.min.js\" defer" "conditional Mermaid loader"
  assert_contains "${scenario}" "${output_dir}" "${feature_page}" "property=\"og:type\" content=\"article\"" "Open Graph article type"
  assert_contains "${scenario}" "${output_dir}" "${feature_page}" "property=\"og:image\" content=\"https://franejelavic.github.io/writing/published-feature/diagram.svg\"" "Open Graph social image"
  assert_contains "${scenario}" "${output_dir}" "${feature_page}" "name=\"twitter:card\" content=\"summary_large_image\"" "Twitter large-image card"
  assert_contains "${scenario}" "${output_dir}" "${feature_page}" "name=\"twitter:image\" content=\"https://franejelavic.github.io/writing/published-feature/diagram.svg\"" "Twitter social image"
  assert_contains "${scenario}" "${output_dir}" "${feature_page}" '"@type":"BlogPosting"' "BlogPosting structured metadata"
  assert_contains "${scenario}" "${output_dir}" "${feature_page}" '"datePublished":"2026-07-15T09:30:00+02:00"' "structured publication date"
  assert_contains "${scenario}" "${output_dir}" "${feature_page}" '"image":"https://franejelavic.github.io/writing/published-feature/diagram.svg"' "structured social image"

  assert_not_contains "${scenario}" "${output_dir}" "${secondary_page}" "table-of-contents" "TOC must be absent when disabled"
  assert_not_contains "${scenario}" "${output_dir}" "${secondary_page}" "<pre class=\"mermaid\">" "Mermaid markup must be absent when unused"
  assert_not_contains "${scenario}" "${output_dir}" "${secondary_page}" "vendor/mermaid/mermaid.min.js" "Mermaid loader must be absent when unused"
  assert_contains "${scenario}" "${output_dir}" "${secondary_page}" "name=\"twitter:card\" content=\"summary\"" "summary card without social image"

  assert_goatcounter "${scenario}" "${output_dir}" 1
}

assert_writing_archetype() {
  local scenario="archetype scenario"
  local content_root="${temporary_root}/archetype-content"
  local generated_file="${content_root}/writing/archetype-contract/index.md"

  mkdir -p "${content_root}"
  note "generating writing archetype under the temporary root"
  HUGO_LANGUAGES_EN_CONTENTDIR="${content_root}" \
    hugo new content --clock "${FIXED_CLOCK}" writing/archetype-contract/index.md \
    || fail "${scenario}: Hugo content generation failed"

  [[ "${generated_file}" == "${temporary_root}/"* ]] || fail "${scenario}: generated file escaped the temporary root"
  [[ -f "${generated_file}" ]] || fail "${scenario}: writing/archetype-contract/index.md: generated bundle is missing"
  grep -Fq "title = 'Archetype Contract'" "${generated_file}" || fail "${scenario}: writing/archetype-contract/index.md: title default is incorrect"
  [[ "$(count_occurrences "${generated_file}" "'${FIXED_CLOCK}'")" -eq 2 ]] || fail "${scenario}: writing/archetype-contract/index.md: date and lastmod are not equal to the fixed clock"
  grep -Fq 'draft = true' "${generated_file}" || fail "${scenario}: writing/archetype-contract/index.md: draft default is not true"
  grep -Fq "description = ''" "${generated_file}" || fail "${scenario}: writing/archetype-contract/index.md: description default is not empty"
  grep -Fq 'categories = []' "${generated_file}" || fail "${scenario}: writing/archetype-contract/index.md: categories default is not empty"
  grep -Fq 'tags = []' "${generated_file}" || fail "${scenario}: writing/archetype-contract/index.md: tags default is not empty"
  grep -Fq 'toc = false' "${generated_file}" || fail "${scenario}: writing/archetype-contract/index.md: TOC default is not false"
  grep -Fq "socialImage = ''" "${generated_file}" || fail "${scenario}: writing/archetype-contract/index.md: social image default is not empty"
}

for required_command in hugo mktemp find grep awk rm cp mkdir; do
  require_command "${required_command}"
done

hugo_version="$(hugo version)"
if [[ ! "${hugo_version}" =~ (^|[[:space:]])hugo[[:space:]]v0\.164\.0([-+][^[:space:]]*)?([[:space:]]|$) ]]; then
  fail "Hugo ${EXPECTED_HUGO_VERSION} is required; found: ${hugo_version}"
fi

temporary_root="$(mktemp -d "${TMPDIR:-/tmp}/frane-site-verify.XXXXXX")"
readonly production_output="${temporary_root}/production"
readonly development_output="${temporary_root}/development"
readonly zero_content="${temporary_root}/scenarios/zero/content"
readonly zero_output="${temporary_root}/scenarios/zero/output"
readonly populated_content="${temporary_root}/scenarios/populated/content"
readonly populated_output="${temporary_root}/scenarios/populated/output"

cd "${PROJECT_ROOT}"

note "building production output with Hugo ${EXPECTED_HUGO_VERSION}"
hugo \
  --gc \
  --minify \
  --panicOnWarning \
  --environment production \
  --noBuildLock \
  --cacheDir "${temporary_root}/cache/real-production" \
  --destination "${production_output}" \
  || fail "real production: Hugo build failed"

note "rendering drafts in memory"
hugo \
  --buildDrafts \
  --renderToMemory \
  --panicOnWarning \
  --environment development \
  --noBuildLock \
  --cacheDir "${temporary_root}/cache/real-drafts" \
  || fail "real draft-inclusive: Hugo render failed"

note "building nonproduction output for analytics validation"
hugo \
  --buildDrafts \
  --panicOnWarning \
  --environment development \
  --noBuildLock \
  --cacheDir "${temporary_root}/cache/real-development" \
  --destination "${development_output}" \
  || fail "real development: Hugo build failed"

assert_core_artifacts "real production" "${production_output}"
assert_elsewhere_content "real production" "${production_output}"
assert_canonical_urls "real production" "${production_output}"
assert_no_private_content "real production" "${production_output}"
assert_actual_writing_state "real production" "${production_output}"
assert_goatcounter "real production" "${production_output}" 1
assert_goatcounter "real development" "${development_output}" 0

prepare_scenario_content "${zero_content}"
build_scenario "zero-post scenario" "${zero_content}" "${zero_output}"
assert_zero_writing_state "zero-post scenario" "${zero_output}"
assert_canonical_urls "zero-post scenario" "${zero_output}"
assert_goatcounter "zero-post scenario" "${zero_output}" 1

prepare_scenario_content "${populated_content}"
cp -R "${PROJECT_ROOT}/testdata/verify-build/." "${populated_content}/writing/"
build_scenario "populated scenario" "${populated_content}" "${populated_output}"
assert_canonical_urls "populated scenario" "${populated_output}"
assert_no_private_content "populated scenario" "${populated_output}"
assert_technical_writing_features "populated scenario" "${populated_output}"

assert_writing_archetype

[[ ! -e "${PROJECT_ROOT}/public" ]] || fail "verification unexpectedly created a public/ directory"

note "all real-build, deterministic-scenario, archetype, and analytics checks passed"
