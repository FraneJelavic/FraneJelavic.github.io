#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

fail() {
  printf 'verify-repository: ERROR: %s\n' "$*" >&2
  exit 1
}

note() {
  printf 'verify-repository: %s\n' "$*"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

assert_no_tracked_path() {
  local pattern="$1"
  local contract="$2"
  local tracked_path

  while IFS= read -r tracked_path; do
    if [[ "${tracked_path}" =~ ${pattern} ]]; then
      fail "${tracked_path}: tracked path violates repository contract: ${contract}"
    fi
  done < <(git ls-files)
}

first_policy_match() {
  local pattern="$1"

  git grep -nI -E -- "${pattern}" \
    . \
    ':(exclude)plans/**' \
    ':(exclude)static/vendor/**' \
    ':(exclude)scripts/verify-build.sh' \
    ':(exclude)scripts/verify-repository.sh' \
    2>/dev/null || true
}

assert_no_source_match() {
  local pattern="$1"
  local contract="$2"
  local match=""

  while IFS= read -r match; do
    break
  done < <(first_policy_match "${pattern}")

  if [[ -n "${match}" ]]; then
    fail "${match}: source violates repository contract: ${contract}"
  fi
}

for required_command in git grep; do
  require_command "${required_command}"
done

cd "${PROJECT_ROOT}"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "project root is not a Git worktree"

assert_no_tracked_path '(^|/)public(/|$)' "generated public/ output must not be tracked"
assert_no_tracked_path '(^|/)resources/_gen(/|$)' "generated resources/_gen/ output must not be tracked"
assert_no_tracked_path '(^|/)\.hugo_build\.lock$' "Hugo build locks must not be tracked"
assert_no_tracked_path '(^|/)(\.env($|\.)|\.netrc$|\.npmrc$|\.pypirc$|id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$|credentials?(\.[^/]*)?$|secrets?(\.[^/]*)?$|service[-_]?account[^/]*\.json$|[^/]+\.(key|pem|p12|pfx))' "obvious credential files must not be tracked"

assert_no_source_match '(/Users/[^/]+/|/home/[^/]+/|file://)' "private absolute paths are prohibited outside historical plans"
assert_no_source_match '(mailto:|[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,})' "site/source contact email addresses are prohibited"
assert_no_source_match '(works[[:space:]_-]+at|worked[[:space:]_-]+at|working[[:space:]_-]+at|my[[:space:]_-]+employer|employment[[:space:]_-]*(history|timeline)|work[[:space:]_-]*experience|job[[:space:]_-]*title|career[[:space:]_-]*timeline)' "employment-profile language is prohibited"

assert_no_tracked_path '^content/writing/(published-feature|published-secondary|draft-control|future-control|expired-control)(/|$)' "validation fixtures must remain outside real content/"

fixture_match=""
while IFS= read -r fixture_match; do
  break
done < <(git grep -nI -F 'VALIDATION-FIXTURE-DO-NOT-PUBLISH' -- 'content/**' 2>/dev/null || true)
if [[ -n "${fixture_match}" ]]; then
  fail "${fixture_match}: validation fixture sentinel is prohibited under real content/"
fi

note "tracked-file and site/source hygiene checks passed"
