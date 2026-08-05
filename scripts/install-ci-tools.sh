#!/usr/bin/env bash

set -Eeuo pipefail

downloads_dir=""

cleanup() {
  if [[ -n "${downloads_dir}" && -d "${downloads_dir}" ]]; then
    rm -rf -- "${downloads_dir}"
  fi
}

trap cleanup EXIT

fail() {
  printf 'install-ci-tools: ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

require_variable() {
  local variable_name="$1"
  [[ -n "${!variable_name:-}" ]] || fail "required environment variable is missing: ${variable_name}"
}

[[ "${GITHUB_ACTIONS:-}" == "true" ]] || fail "this installer is only supported in GitHub Actions"

for variable_name in RUNNER_TEMP GITHUB_PATH HUGO_VERSION ACTIONLINT_VERSION LYCHEE_VERSION; do
  require_variable "${variable_name}"
done

[[ "${RUNNER_TEMP}" == /* ]] || fail "RUNNER_TEMP must be an absolute path"
[[ "${HUGO_VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "HUGO_VERSION must be a semantic version"
[[ "${ACTIONLINT_VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "ACTIONLINT_VERSION must be a semantic version"
[[ "${LYCHEE_VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "LYCHEE_VERSION must be a semantic version"

for required_command in curl grep sha256sum tar mkdir mktemp rm chmod; do
  require_command "${required_command}"
done

readonly tools_dir="${RUNNER_TEMP%/}/site-validation-tools"
downloads_dir="$(mktemp -d "${RUNNER_TEMP%/}/site-tool-downloads.XXXXXX")"
mkdir -p "${tools_dir}"
cd "${downloads_dir}"

hugo_archive="hugo_${HUGO_VERSION}_linux-amd64.tar.gz"
curl --fail --location --silent --show-error --remote-name \
  "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/${hugo_archive}"
curl --fail --location --silent --show-error --remote-name \
  "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_${HUGO_VERSION}_checksums.txt"
grep "  ${hugo_archive}$" "hugo_${HUGO_VERSION}_checksums.txt" | sha256sum --check --strict
tar -xzf "${hugo_archive}" -C "${tools_dir}" hugo

actionlint_archive="actionlint_${ACTIONLINT_VERSION}_linux_amd64.tar.gz"
curl --fail --location --silent --show-error --remote-name \
  "https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/${actionlint_archive}"
curl --fail --location --silent --show-error --remote-name \
  "https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/actionlint_${ACTIONLINT_VERSION}_checksums.txt"
grep "  ${actionlint_archive}$" "actionlint_${ACTIONLINT_VERSION}_checksums.txt" | sha256sum --check --strict
tar -xzf "${actionlint_archive}" -C "${tools_dir}" actionlint

lychee_archive="lychee-x86_64-unknown-linux-gnu.tar.gz"
curl --fail --location --silent --show-error --remote-name \
  "https://github.com/lycheeverse/lychee/releases/download/lychee-v${LYCHEE_VERSION}/${lychee_archive}"
curl --fail --location --silent --show-error --remote-name \
  "https://github.com/lycheeverse/lychee/releases/download/lychee-v${LYCHEE_VERSION}/${lychee_archive}.sha256"
sha256sum --check --strict "${lychee_archive}.sha256"
tar -xzf "${lychee_archive}" -C "${tools_dir}" --strip-components=1 \
  "lychee-x86_64-unknown-linux-gnu/lychee"

chmod +x "${tools_dir}/hugo" "${tools_dir}/actionlint" "${tools_dir}/lychee"
printf '%s\n' "${tools_dir}" >> "${GITHUB_PATH}"

"${tools_dir}/hugo" version
"${tools_dir}/actionlint" -version
"${tools_dir}/lychee" --version
