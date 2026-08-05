HUGO := hugo
PRODUCTION_FLAGS := --gc --minify --panicOnWarning --environment production --noBuildLock
SERVER_FLAGS := --panicOnWarning --disableFastRender

.PHONY: check build build-drafts serve serve-drafts new

check:
	./scripts/verify-repository.sh
	./scripts/verify-build.sh

build:
	$(HUGO) $(PRODUCTION_FLAGS)

build-drafts:
	$(HUGO) $(PRODUCTION_FLAGS) --buildDrafts

serve:
	$(HUGO) server $(SERVER_FLAGS)

serve-drafts:
	$(HUGO) server $(SERVER_FLAGS) --buildDrafts

new:
	@test -n "$(SLUG)" || (printf 'Usage: make new SLUG=my-post\n' >&2; exit 2)
	$(HUGO) new content "writing/$(SLUG)/index.md"
