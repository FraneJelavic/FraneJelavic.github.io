# Frane Jelavic

Source for [franejelavic.github.io](https://franejelavic.github.io/), a personal technical blog built with [Hugo](https://gohugo.io/).

## What is included

- A home page, writing archive, About page, and Privacy page
- Markdown articles with syntax highlighting, tables, images, and optional Mermaid diagrams
- RSS feeds, sitemap, SEO metadata, and GoatCounter analytics
- Automatic deployment to GitHub Pages when `main` is updated

## Start locally

Install Hugo `0.164.0`, then run:

```sh
git clone https://github.com/FraneJelavic/FraneJelavic.github.io.git
cd FraneJelavic.github.io
make serve-drafts
```

Open <http://localhost:1313/>. This command includes draft articles and refreshes the browser when files change.

Use `make serve` to preview only published content. Run `make build` to create the production site in `public/`.

## Project structure

```text
content/       Pages and articles
layouts/       Hugo HTML templates
assets/        CSS and JavaScript processed by Hugo
static/        Files copied directly into the generated site
archetypes/    Front-matter template for new articles
hugo.toml      Site configuration
```

## Create and publish an article

Create a page bundle with a lowercase, hyphenated slug:

```sh
make new SLUG=understanding-replication-lag
```

Edit the generated file:

```text
content/writing/understanding-replication-lag/index.md
```

Keep images and other article files in the same directory and reference them with relative paths:

```md
![Replication flow](replication-flow.png)
```

Preview the article with `make serve-drafts`. When it is ready, set `draft = false` in its front matter and run the repository and site validations:

```sh
make check
```

Open a pull request so the same checks run in GitHub Actions. Merging to `main` validates the site again and publishes it to GitHub Pages.

## Common commands

```sh
make serve          # Preview published content
make serve-drafts   # Preview published content and drafts
make check          # Run repository and site validations
make build          # Build the production site
make build-drafts   # Build the site including drafts
make new SLUG=name  # Create a new article
```
