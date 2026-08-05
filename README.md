# Frane Jelavic

Source for [franejelavic.github.io](https://franejelavic.github.io/), a small personal site built with Hugo and no third-party theme.

## Requirements

- Hugo `0.164.0` (the standard edition is sufficient)
- Make and a POSIX-like shell for the convenience commands

The normal build does not require Node, Python, Docker, a package manager, or a theme submodule. The site and build timezone is `Europe/Zagreb`.

### Install the pinned Hugo version on macOS

Download the standard `hugo_0.164.0_darwin-universal.pkg` and `hugo_0.164.0_checksums.txt` files from the [official Hugo 0.164.0 release](https://github.com/gohugoio/hugo/releases/tag/v0.164.0). Verify the package before installing it:

```sh
grep '  hugo_0.164.0_darwin-universal.pkg$' hugo_0.164.0_checksums.txt | shasum -a 256 -c -
sudo installer -pkg hugo_0.164.0_darwin-universal.pkg -target /
hugo version
```

The last command must report `v0.164.0`. Other platforms can use the matching standard archive from the same release and verify it against the published checksum file.

## Local workflow

Preview only content eligible for publication:

```sh
make serve
```

Preview drafts as well:

```sh
make serve-drafts
```

Both previews are development builds, so they do not load GoatCounter. Stop either server with `Ctrl-C`.

Run the same production and draft acceptance checks used in CI:

```sh
make check
```

Build the production site into `public/` or include drafts in a local production-mode build:

```sh
make build
make build-drafts
```

Production-mode output includes GoatCounter by design. Generated files in `public/` are ignored and must not be committed.

## Create and publish a post

Create a leaf page bundle with a lowercase, hyphenated slug:

```sh
make new SLUG=understanding-replication-lag
```

This creates `content/writing/understanding-replication-lag/index.md` from `archetypes/writing.md`. Keep diagrams and other article media beside `index.md`, then reference them with relative Markdown paths such as:

```md
![Replication flow](replication-flow.png "Replication flow")
```

Complete the title, description, and date in the generated front matter. Use categories for a post's broad area and tags for specific technologies or concepts. Both should describe the finished article rather than define topics in advance.

Set `toc: true` when a longer article benefits from a table of contents. Mermaid is opt-in per diagram:

````md
```mermaid
flowchart LR
    A[Primary] --> B[Replica]
```
````

The Mermaid bundle is self-hosted and loads only on a page that contains a Mermaid fence.

New posts start with `draft: true`. Use `make serve-drafts` while writing and run `make check` before publication. To publish, set `draft: false`, commit the bundle, and push `main`. The deployment workflow builds and deploys the site through GitHub Pages.

## Analytics and deployment

GoatCounter loads only when Hugo builds with the `production` environment. Local `make serve` and `make serve-drafts` previews never send page views. Production traffic can be reviewed at [franejelavic.goatcounter.com](https://franejelavic.goatcounter.com/).

Pull requests run `.github/workflows/check.yml`, which validates the site without deployment. Pushes to `main` run `.github/workflows/deploy.yml`, which builds once and deploys the resulting Pages artifact. GitHub Pages uses the Actions source; there is no `gh-pages` branch.

### Common recovery steps

- If a check reports the wrong Hugo version, install `0.164.0` and confirm with `hugo version`.
- If Hugo reports a warning, fix the reported content or template issue; warnings intentionally fail checks and deployment.
- If a draft is missing from preview, use `make serve-drafts` and confirm its front matter contains `draft: true`.
- If generated output looks stale, stop the server, remove the ignored `public/` directory, and rerun the relevant command.
- If deployment fails, open the failed GitHub Actions run, fix the first build or deploy error, run `make check`, and push the correction.
- If GoatCounter is absent locally, no recovery is needed; analytics is intentionally production-only.

## Future changes

A custom domain requires DNS records and GitHub Pages configuration, plus the appropriate production `baseURL`; it does not require restructuring the site. Search, comments, math rendering, and code-copy controls can likewise be added later as independent enhancements.

## Licensing

Site templates, styles, scripts, and configuration are available under the [MIT License](LICENSE). Files under `content/` and original article media are excluded from that grant; see [CONTENT_LICENSE.md](CONTENT_LICENSE.md).
