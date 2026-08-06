# Site Validation and Information Architecture Improvements Implementation Plan

## Overview

Strengthen the Hugo site's validation so it remains correct after the first article is published, continuously verifies the promised technical-writing features, and runs before both pull-request acceptance and production deployment. Consolidate the small curated talks-and-articles list into About while preserving the public `/elsewhere/` URL as a compatibility redirect.

This project does not need application unit tests or a TDD workflow. The work will be implemented directly through deterministic generated-artifact checks, temporary Hugo build scenarios, workflow validation, and focused browser verification.

The work also aligns documentation and privacy claims with reality. Publisher attribution is allowed in curated links, employment-profile content remains prohibited, future commits should use a GitHub private/noreply address, and published Git history will not be rewritten.

## Current State Analysis

- The worktree is clean on local `main` at `3a23bd1`, matching the locally cached `origin/main` state at planning time.
- `scripts/verify-build.sh` builds production, draft-inclusive, and nonproduction output in temporary directories and currently passes while Writing is empty.
- `assert_empty_writing_state` at `scripts/verify-build.sh:118-124` is invoked unconditionally at line 199. It rejects the intended `Recent writing` section after an article is published, although `layouts/index.html:8-19` correctly renders that section when published writing exists.
- Technical-writing features were verified once with a temporary bundle and then removed. Current checks do not continuously prove TOC, highlighting, tables, bundle images, Mermaid, taxonomy links, reading time, link attributes, article metadata, or archetype defaults.
- `hugo.toml:13` defines a language-specific `contentDir`. A normal `--contentDir` flag does not isolate fixtures; the working override is `HUGO_LANGUAGES_EN_CONTENTDIR=<absolute-path>`.
- `.github/workflows/check.yml` runs acceptance checks, actionlint, and offline generated-link validation for pull requests and manual dispatches.
- `.github/workflows/deploy.yml` builds and deploys from `main` without first requiring the full acceptance and generated-link checks. A direct push can therefore reach deployment without the PR validation path.
- `make check` invokes only `scripts/verify-build.sh`; it does not check repository hygiene or fully describe the relationship between local, PR, and deployment validation.
- Primary navigation currently contains `Home`, `Writing`, `Elsewhere`, and `About`. The curated collection has one talk and two articles, so a primary-navigation destination gives it disproportionate prominence.
- `content/elsewhere.md` contains the curated material. `content/about.md` contains only the approved biography and profile links.
- The original plan records the launch of `/elsewhere/`, but its final handoff record predates the two latest post-launch commits.
- The absolute claim that the repository contains no employer references is no longer accurate because curated content names a publisher. Public commit metadata also contains a work-address author/committer email.
- At plan approval, the `gh` credential was invalid. Phase 1 therefore requires re-authentication before authenticated remote verification or repository administration.

## Desired End State

- `make check` passes whether the real repository has zero, one, or multiple published articles.
- Every run deterministically exercises both zero-published and synthetic published-content branches.
- Tracked fixtures live outside `content/`, cannot be published accidentally, use a fixed Hugo clock, and cover published, draft, future, and expired states.
- A rich fixture continuously proves the writing archetype and technical article features.
- Repository checks reject tracked build output, private paths, site-source email addresses, obvious credential files, and résumé/employment-profile language without rejecting approved publisher attribution.
- Pull-request and deployment workflows use the same checksum-verified validation tools and both run acceptance, workflow, and generated-link checks before production upload.
- Manual deployment is restricted to the `main` ref.
- Primary navigation is `Home`, `Writing`, and `About`.
- About retains the approved biography/profile links and presents the curated material under `Talks and articles`, `Talks`, and `Articles` headings.
- `/elsewhere/` remains valid as a redirect to `/about/`, without duplicate content.
- Documentation distinguishes historical launch facts from current state, defines exact validation coverage, permits contextual publisher attribution, and records final deployment evidence.
- Future commits use a GitHub private/noreply address; existing public history remains unchanged.

### Key Discoveries

- Homepage behavior is correct; the defect is the unconditional assertion, not `layouts/index.html`.
- Isolated fixtures must override `HUGO_LANGUAGES_EN_CONTENTDIR`; `hugo --contentDir` alone would silently test the real content tree.
- `hugo --clock` makes future and expired fixtures deterministic.
- The default single-page template already supports the proposed About hierarchy and profile navigation; no layout or CSS change is required.
- Hugo aliases can preserve `/elsewhere/` without duplicate source content.
- `Infobip Developers Hub` is publisher attribution, not employment biography. Validation should prohibit relationship/profile language instead of maintaining an incomplete employer-name denylist.
- Commit metadata is outside site/source checks. Removing historical email metadata would require a destructive history rewrite and force push.
- Normal builds should continue to require only Hugo, Make, and a POSIX-like shell. actionlint and lychee remain checksum-verified CI tools.

## What We're NOT Doing

- No application unit-test framework or TDD/red-green workflow.
- No history rewrite, rebase, filter-repo operation, or force push.
- No removal of legitimate publisher attribution or curated destination URLs.
- No résumé, employer biography, career timeline, skills inventory, projects section, or exhaustive publications catalogue.
- No visual redesign, new layout, CSS rework, embedded video, or third-party media request on About.
- No real article publication or placeholder under `content/writing/`.
- No CI dependency on external-site availability; link validation remains offline and structural.
- No uptime monitor, analytics redesign, or legal/GDPR guarantee.
- No Hugo/Mermaid upgrade, custom domain, search, comments, math rendering, or copy-code controls.
- No published GitHub branch/environment policy mutation without a separate explicit request.

## Implementation Approach

Keep validation shell-based and centered on generated Hugo output. Extend the existing temporary-build design instead of adding another language runtime or package manager.

The build verifier will validate real production/development output and then create isolated scenario content trees under its temporary root. One scenario contains no writing; another contains tracked fixtures copied from `testdata/`. A fixed clock and language-specific content override make results independent of current repository content, date, and machine.

Separate source hygiene from rendered behavior:

- `scripts/verify-repository.sh` checks tracked-file and source policies.
- `scripts/verify-build.sh` checks Hugo builds and rendered contracts.
- `make check` runs both.

Factor checksum-verified CI tool installation out of `check.yml` into a shell helper used by both workflows. Add a read-only validation job before Pages build/deploy and fail closed when manual dispatch does not target `main`.

Move curated Markdown into About, generate `/elsewhere/` through an alias, remove Elsewhere from the menu, and update rendered-artifact assertions in the same change. Keep the existing templates and styles.

Before any implementation commit, configure this repository to use the user's GitHub private/noreply email. This is a manual privacy prerequisite, not a history rewrite.

## Phase 1: Confirm Baseline and Privacy Policy

### Overview

Establish a current remote baseline and the policies that validation will enforce. This phase is read-only for the site and repository history.

### Changes Required

#### 1. Restore authenticated repository access

**Scope**: Local `gh` authentication

**Changes**:

- Re-authenticate `gh` as `FraneJelavic`.
- Verify repository visibility, default branch, Pages workflow source, remote `main` SHA, latest validation run, and latest successful deployment.
- Record observed SHAs/run URLs for the final handoff rather than treating plan-time values as final evidence.

#### 2. Configure future commit-email privacy

**Scope**: Repository-local Git configuration and GitHub email settings

**Changes**:

- Obtain the GitHub private/noreply address from the authenticated account.
- Set it through repository-local `git config user.email`, leaving global configuration and historical commits unchanged.
- Verify the next commit's author identity before committing without adding the address to documentation.
- Do not amend, rewrite, or force-push existing commits.

#### 3. Define the content privacy boundary

**Files**:

- `plans/2026-08-hugo-personal-tech-site.md`
- `plans/2026-08-site-validation-improvements.md`

**Changes**:

- Treat `Infobip Developers Hub` as approved publisher attribution.
- Continue prohibiting `works at`, `worked at`, `working at`, `my employer`, job titles, work-experience sections, employment timelines, résumé content, contact email addresses, private paths, and profile images.
- State that generated-site/source validation does not prove historical Git metadata is email-free.
- Preserve historical launch statements but label the original opening state as a pre-implementation baseline.

#### Implementation Notes (August 5, 2026)

- Before Phase 1 changes, local `main` was at `3a23bd19778144009e45e29a9d6270d44ffe4ca3` with no unrelated worktree changes; the only untracked file was this approved implementation plan.
- GitHub CLI authentication was restored for `FraneJelavic`. The repository is public, its default branch is `main`, and Pages uses a GitHub Actions workflow sourced from `main` at `/` with HTTPS enforced.
- Local `HEAD`, remote `main`, the latest successful Pages deployment, and the deployed `github-pages` record all resolve to `3a23bd19778144009e45e29a9d6270d44ffe4ca3`.
- The latest validation evidence is [run 31006850894](https://github.com/FraneJelavic/FraneJelavic.github.io/actions/runs/31006850894); the latest successful deployment evidence is [run 31006826802](https://github.com/FraneJelavic/FraneJelavic.github.io/actions/runs/31006826802).
- The repository-local author email now uses the authenticated account's GitHub private/noreply identity. Global configuration and published history are unchanged, and the address is intentionally not recorded in site documentation.
- `Infobip Developers Hub` is treated as contextual publisher attribution. Employment-profile content remains prohibited, and site/source validation does not make claims about historical Git metadata.

### Success Criteria

#### Automated Verification

- [x] `git status --short --branch` showed no unrelated changes before implementation; only this approved plan was untracked.
- [x] `gh auth status` succeeds for the intended account.
- [x] Read-only API checks confirm default branch and Pages workflow source.
- [x] Local `HEAD`, remote `main`, and deployed Pages commit are recorded.
- [x] Repository-local author configuration resolves to the approved private/noreply address without changing existing commits.

#### Manual Verification

- [x] Frane confirms publisher attribution is allowed while employment-profile content remains prohibited.
- [x] Frane confirms historical metadata will not be rewritten.
- [x] Frane confirms the private/noreply address for future commits.

## Phase 2: Implement Deterministic Local Validation

### Overview

Make `make check` resilient to published content and continuously validate authoring features through isolated, non-publishable fixtures.

### Changes Required

#### 1. Add non-publishable fixtures

**Files**:

- `testdata/verify-build/published-feature/index.md`
- `testdata/verify-build/published-feature/diagram.svg`
- `testdata/verify-build/published-secondary/index.md`
- `testdata/verify-build/draft-control/index.md`
- `testdata/verify-build/future-control/index.md`
- `testdata/verify-build/expired-control/index.md`

**Changes**:

- Keep every fixture outside `content/` and use unique sentinel titles/text.
- Make `published-feature` a leaf bundle with complete front matter, categories, tags, `toc = true`, social image, multiple headings, highlighted code, a wide table, bundle image/caption, internal/external links, and Mermaid.
- Give `published-secondary` a different date/year so ordering and year grouping can be asserted without expanding scope to the five-post homepage cap.
- Mark the draft control as draft and place future/expired controls around the fixed validation clock using `publishDate`/`expiryDate`.

#### 2. Make real writing-state assertions data-driven

**File**: `scripts/verify-build.sh`

**Changes**:

- Replace `assert_empty_writing_state` with `assert_zero_writing_state`, `assert_published_writing_state`, `assert_actual_writing_state`, `assert_technical_writing_features`, and `assert_writing_archetype`.
- Determine actual state from generated writing article pages.
- With zero real posts, require structural absence of `recent-writing` and an empty archive.
- With published posts, require the homepage section, `All writing`, and populated archive.
- Assert stable classes, IDs, URLs, and sentinel text rather than relying only on visible headings.

#### 3. Build isolated zero and populated scenarios

**File**: `scripts/verify-build.sh`

**Changes**:

- Create scenario content/output below the existing `mktemp` root.
- Copy only the real home and Writing section indexes into the baseline scenario.
- Build one zero-post scenario and one populated scenario after copying fixtures.
- Use a fixed invocation equivalent to:

```sh
HUGO_LANGUAGES_EN_CONTENTDIR="${scenario_content}" \
  hugo \
  --clock 2026-08-05T12:00:00+02:00 \
  --environment production \
  --panicOnWarning \
  --noBuildLock \
  --cacheDir "${temporary_root}/cache" \
  --destination "${scenario_output}"
```

- Require `cp` and `mkdir` alongside existing commands.
- Keep copied content/output under the temporary root and retain cleanup traps.
- Continue validating real production/nonproduction analytics separately.

#### 4. Assert technical-writing output

**File**: `scripts/verify-build.sh`

**Changes**:

- Require published fixtures on the homepage/archive in reverse order and grouped by year.
- Require draft/future/expired controls to be absent from homepage, archive, feeds, and article output.
- Assert publication date, reading time, categories, tags, TOC, heading anchors, Chroma markup, accessible table wrapper, bundle image/alt/caption/lazy attributes, internal/external link behavior, conditional Mermaid loading, Open Graph/Twitter/BlogPosting metadata, and one production GoatCounter integration.
- Assert TOC and Mermaid absence where not enabled.

#### 5. Verify the writing archetype

**Files**:

- `scripts/verify-build.sh`
- `archetypes/writing.md` (protected contract)

**Changes**:

- Generate a bundle inside temporary content using the fixed clock.
- Assert title, equal deterministic `date`/`lastmod`, `draft = true`, empty description/categories/tags/social image, and `toc = false`.
- Remove it through temporary-root cleanup without touching real content.

#### 6. Add repository/source hygiene checks

**Files**:

- `scripts/verify-repository.sh`
- `Makefile`

**Changes**:

- Reject tracked `public/`, `resources/_gen/`, Hugo locks, obvious credential filenames, private absolute paths, site-source email addresses/`mailto:` links, prohibited employment-profile phrases, and validation fixtures under real `content/`.
- Scope checks to avoid false positives in vendored Mermaid and approved publisher attribution.
- Do not inspect or rewrite historical Git metadata.
- Make `make check` run repository verification before build verification.

#### Implementation Notes (August 5, 2026)

- Added six synthetic fixtures under `testdata/verify-build/`, including a rich published leaf bundle, a second published year, and draft/future/expired controls. The fixture sentinel and location make them explicitly non-publishable.
- `scripts/verify-build.sh` now detects the real generated writing state, builds isolated zero-post and populated scenarios with the fixed clock and language-specific content override, and validates ordering, year grouping, visibility controls, authoring features, metadata, analytics, and archetype defaults.
- The populated scenario continuously proves TOC and heading anchors, Chroma, accessible tables, bundle images, link behavior, conditional Mermaid loading, taxonomies, reading time, Open Graph, Twitter cards, and `BlogPosting` data.
- Added `scripts/verify-repository.sh` for tracked generated output, lock files, credential filenames, private paths, source email addresses, employment-profile language, and fixture-placement policy. Historical plans and vendored Mermaid are deliberately outside content-policy scanning, and the verifier scripts are excluded from self-matching the policies they encode.
- `make check` runs repository hygiene before build verification and completes locally in approximately three seconds.
- A temporary published leaf bundle under the real `content/writing/` tree exercised the published-state branch successfully, then was removed. Final verification left no `public/`, temporary content, or cache residue.

### Success Criteria

#### Automated Verification

- [x] `bash -n scripts/verify-repository.sh scripts/verify-build.sh` passes.
- [x] `make check` passes with zero real published posts and exercises both isolated branches.
- [x] The populated scenario proves all technical features and excludes draft/future/expired controls.
- [x] Archetype generation/inspection occurs only under the temporary root.
- [x] A disposable real published article no longer causes the empty-state assertion to fail.
- [x] Production analytics appear once per page and development analytics remain absent.
- [x] `test ! -e public` passes and `git status --short` shows no residue beyond the expected implementation changes.

#### Manual Verification

- [x] Fixture content is clearly synthetic and cannot be mistaken for publishable content.
- [x] Failure messages identify the scenario, page, and violated contract.
- [x] Runtime remains proportionate for local author use.

## Phase 3: Require Shared Validation Before Deployment

### Overview

Remove workflow drift and require the same acceptance/link checks before any Pages artifact upload.

### Changes Required

#### 1. Factor checksum-verified CI tool installation

**Files**:

- `scripts/install-ci-tools.sh`
- `.github/workflows/check.yml`
- `.github/workflows/deploy.yml`

**Changes**:

- Move existing Hugo, actionlint, and lychee download/checksum logic into a strict helper.
- Read pinned versions from workflow environment variables and fail on missing variables.
- Install only under `RUNNER_TEMP` and append the tool directory to `GITHUB_PATH`.
- Preserve checksum verification and keep the helper CI-only.

#### 2. Align pull-request validation

**File**: `.github/workflows/check.yml`

**Changes**:

- Use the shared installer and run `make check`.
- Continue actionlint and temporary production output with offline lychee fragment checks.
- Preserve `contents: read` and the absence of deploy steps/Pages permissions.

#### 3. Add read-only deployment validation

**File**: `.github/workflows/deploy.yml`

**Changes**:

- Add a `validate` job before Pages build with only `contents: read`.
- Fail closed unless `github.ref == 'refs/heads/main'`, including manual dispatch.
- Use the shared installer; run `make check`, actionlint, a temporary production build, and the same offline lychee command.
- Make Pages build depend on validation.
- Keep the Pages-specific build separate because it uses `actions/configure-pages` base URL.
- Scope Pages/OIDC permissions to jobs that need them; preserve non-cancelling concurrency and the `github-pages` environment.

#### 4. Document coverage

**File**: `README.md`

**Changes**:

- Explain `make check` coverage and the additional actionlint/offline-link CI layer.
- Recommend PR-first publishing while noting direct `main` pushes still receive deployment validation.
- Document accepted official Hugo version suffixes and recovery for fixture/repository-policy failures.

#### Implementation Notes (August 5, 2026)

- Added the CI-only `scripts/install-ci-tools.sh`, which requires all three pinned version variables plus GitHub runner paths, validates semantic-version inputs, installs only below `RUNNER_TEMP`, verifies every downloaded archive against its published checksum, and appends the tool directory to `GITHUB_PATH`.
- Pull-request validation now uses the shared installer, runs `make check`, lints both workflows, and performs the existing offline fragment-aware link check. It retains only `contents: read` and contains no Pages permission or deploy action.
- Deployment now begins with an explicitly read-only `validate` job. Its first step fails when the selected ref is not `refs/heads/main`; it then runs the same installer, acceptance checks, workflow lint, temporary production build, and offline link validation as the pull-request workflow.
- The Pages build depends on validation and retains its separate Pages-aware base URL. Pages and OIDC permissions are job-scoped, artifact upload cannot start before validation, deployment remains a separate job, and non-cancelling `pages` concurrency is unchanged.
- README guidance now describes local and CI coverage, exact accepted Hugo suffixes, PR-first publishing, validation of direct `main` pushes, and recovery for repository-policy, fixture, workflow, and link failures.
- Pinned actionlint `1.7.12` passed both workflows. Pinned lychee `0.24.2` ran the workflow's offline command against temporary production output with 110 links checked and zero errors.

### Success Criteria

#### Automated Verification

- [x] `bash -n scripts/install-ci-tools.sh` passes.
- [x] `actionlint .github/workflows/check.yml .github/workflows/deploy.yml` passes.
- [x] PR validation remains read-only and non-deploying.
- [x] Deployment cannot upload until validation succeeds.
- [x] Non-`main` manual deployment fails before build/upload.
- [x] Both workflows use the same installer/pins.
- [x] Deployment validation runs `make check`, actionlint, and offline generated-link validation.

#### Manual Verification

- [x] A PR shows validation without deployment.
- [x] A successful `main` run validates before Pages build/deploy.
- [x] A controlled validation failure prevents artifact upload.
- [x] Logs clearly distinguish validation, build, and deployment failures.

## Phase 4: Consolidate Curated Material into About

### Overview

Restore three-item navigation while preserving the curated links and public legacy URL.

### Changes Required

#### 1. Move curated content into About

**File**: `content/about.md`

**Changes**:

- Preserve the biography verbatim and `showProfileLinks = true`.
- Add `aliases = ["/elsewhere/"]`.
- Append H2 `Talks and articles`, the existing introduction, and H3 `Talks`/`Articles` sections.
- Preserve all titles, URLs, dates, descriptions, and YouTube timestamp.
- Keep publisher attribution contextual and add no employment language.

#### 2. Remove duplicate source and simplify navigation

**Files**:

- `content/elsewhere.md`
- `hugo.toml`

**Changes**:

- Delete `content/elsewhere.md` after the alias exists.
- Remove the Elsewhere menu item and change About's weight from 40 to 30.
- Preserve Home/Writing ordering; add no replacement footer link or embed.

#### 3. Update information-architecture validation

**Files**:

- `scripts/verify-build.sh`
- `scripts/verify-repository.sh`

**Changes**:

- Continue requiring both `about/index.html` and `elsewhere/index.html`, with Elsewhere now proving compatibility routing.
- Replace the Elsewhere-content assertion with checks for the biography/profile links, all curated data on About, H1→H2→H3 hierarchy, exact three-item primary navigation, redirect/canonical target to About, no duplicate list, and no tracked `content/elsewhere.md`.
- Continue using normal Markdown links and the existing render hook.

#### 4. Record the post-launch change

**File**: `plans/2026-08-hugo-personal-tech-site.md`

**Changes**:

- Preserve the historical Elsewhere launch note.
- Append a dated follow-up recording consolidation, reduced navigation, and compatibility redirect.
- Replace absolute privacy/employer claims with the scoped Phase 1 policy without rewriting accurate historical run results.

#### Implementation Notes (August 5, 2026)

- Moved the complete curated list into About below the unchanged biography, using the planned H2/H3 hierarchy while preserving every title, destination, date, description, publisher attribution, and the precise YouTube timestamp.
- Replaced the standalone source page with Hugo's `/elsewhere/` alias on About. The generated compatibility page canonicalizes and immediately redirects to `/about/` without duplicating the curated content or loading analytics before the redirect.
- Restored the exact `Home`, `Writing`, and `About` primary navigation and retained the existing templates, styling, profile links, and external-link render hook.
- Extended generated-artifact checks to require the biography, profile links, heading hierarchy, exact navigation, curated data, single canonical list, and compatibility redirect. Repository checks now reject restoration of `content/elsewhere.md`.
- `make check` passes across the real, zero-post, populated, archetype, privacy, analytics, and repository-policy scenarios. Pinned lychee `0.24.2` checked 93 generated links with zero errors.

### Success Criteria

#### Automated Verification

- [x] Production output contains one canonical curated list on About.
- [x] `/elsewhere/` redirects/canonicalizes to About and contains no duplicate list.
- [x] Primary navigation is exactly Home, Writing, About.
- [x] All three destinations and precise YouTube timestamp remain.
- [x] Biography/profile links remain unchanged and heading levels are correct.
- [x] `make check` and offline link validation pass.

#### Manual Verification

- [x] About remains concise and does not read like a résumé/catalogue.
- [x] About and the legacy URL work at 360, 768, and 1440 px.
- [x] Themes, keyboard navigation, focus, and skip navigation remain correct.
- [x] The redirect has no loop and publisher attribution remains contextual.

## Phase 5: Final Verification and Handoff

### Overview

Verify the complete change locally, through Actions, and on production; then record evidence from the actual final commit.

### Changes Required

#### 1. Validate from a clean checkout

**Scope**: Final proposed commit

**Changes**:

- Run repository, build, workflow, and link checks from a clean checkout.
- Confirm fixtures remain outside published content and leave no output.
- Follow the README article flow in a disposable checkout and confirm a published fixture no longer conflicts with validation.

#### 2. Verify production behavior

**URLs**:

- `https://franejelavic.github.io/`
- `https://franejelavic.github.io/about/`
- `https://franejelavic.github.io/elsewhere/`
- `https://franejelavic.github.io/writing/`

**Changes**:

- Verify core routes, feeds, sitemap, robots, assets, and unknown-route handling.
- Verify three-item navigation and About content in server-rendered HTML.
- Verify Elsewhere reaches About and production analytics remain correctly configured.

#### 3. Complete handoff records

**Files**:

- `plans/2026-08-site-validation-improvements.md`
- `plans/2026-08-hugo-personal-tech-site.md`

**Changes**:

- Record final commit SHA, validation/deployment runs, and URL only after evidence exists.
- Mark checklist items complete only when verified.
- Do not claim historical metadata is email-free; state only the final/future commit policy.

### Success Criteria

#### Automated Verification

- [ ] `bash -n scripts/*.sh` passes.
- [ ] `make check` passes from a clean checkout.
- [ ] actionlint and offline lychee pass.
- [ ] No generated output, fixture residue, cache, private path, contact email, or credential file is tracked.
- [ ] Final validation/deployment runs succeed on the same commit.
- [ ] Deployed commit matches remote `main` and Pages artifact.

#### Manual Verification

- [ ] About/redirect are accepted at mobile, tablet, and desktop widths.
- [ ] Theme persistence, focus, no-JavaScript content, and reduced motion remain correct.
- [ ] GoatCounter records production and no development view.
- [ ] Frane accepts validation workflow, About organization, privacy policy, and handoff.

## Testing Strategy

This project continues to use generated-artifact validation rather than application unit tests or TDD.

### Automated Verification

1. **Repository policy**: check tracked source for generated output, private paths, email/contact data, credential filenames, and prohibited profile language.
2. **Real builds**: production with analytics, draft-inclusive in memory, and inspectable development output without analytics.
3. **Deterministic scenarios**: fixed-clock isolated zero/published states, excluding draft/future/expired controls.
4. **Authoring features**: archetype defaults, article metadata, reading time, taxonomies, TOC, highlighting, tables, images, links, Mermaid, feeds, and structured/social metadata.
5. **Workflow integrity**: actionlint plus shared validation before Pages upload.
6. **Static links**: pinned offline lychee with fragments for internal pages/assets/feeds/headings/redirects, without external availability as a release dependency.

### Manual Verification

1. Re-authenticate GitHub and verify repository-local private/noreply identity.
2. Review About at 360, 768, and 1440 px in light/dark/system modes.
3. Test keyboard navigation, focus, skip navigation, and heading order.
4. Confirm `/elsewhere/` reaches About without duplication/loop.
5. Follow README from a clean checkout to create, preview, check, and remove a disposable draft.
6. Confirm workflow ordering, deployed commit, and analytics ingestion.

### Verification Commands

```sh
bash -n scripts/*.sh
make check
actionlint .github/workflows/check.yml .github/workflows/deploy.yml
git diff --check
git status --short
test ! -e public
```

CI additionally runs pinned offline lychee against runner-temporary generated output.

## References

- Existing implementation plan: `plans/2026-08-hugo-personal-tech-site.md`
- Build verifier: `scripts/verify-build.sh`
- Local entry point: `Makefile`
- Pull-request validation: `.github/workflows/check.yml`
- Pages deployment: `.github/workflows/deploy.yml`
- Hugo configuration: `hugo.toml`
- Homepage writing state: `layouts/index.html`
- Writing archetype/template: `archetypes/writing.md`, `layouts/writing/single.html`
- Render hooks: `layouts/_default/_markup/`
- About and curated content: `content/about.md`, `content/elsewhere.md`
- Brendan Gregg's curated overview: https://www.brendangregg.com/overview.html
- Hugo aliases: https://gohugo.io/content-management/urls/#aliases
- Hugo command options: https://gohugo.io/commands/hugo/
