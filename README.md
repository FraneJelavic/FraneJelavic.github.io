# Frane Jelavic

Source for [franejelavic.github.io](https://franejelavic.github.io/), a small personal site built with Hugo and no third-party theme.

## Requirements

- Hugo `0.164.0` (the standard edition is sufficient)
- Make and a POSIX-like shell for the convenience commands

The normal build does not require Node, Python, Docker, a package manager, or a theme submodule. The site and build timezone is `Europe/Zagreb`.

## Local use

Run the full production and draft acceptance checks:

```sh
make check
```

Build the production site into `public/`:

```sh
make build
```

Preview locally:

```sh
hugo server
```

Include draft content in the preview:

```sh
hugo server --buildDrafts
```

## Licensing

Site templates, styles, scripts, and configuration are available under the [MIT License](LICENSE). Files under `content/` and original article media are excluded from that grant; see [CONTENT_LICENSE.md](CONTENT_LICENSE.md).
