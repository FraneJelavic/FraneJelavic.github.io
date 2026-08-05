HUGO := hugo
PRODUCTION_FLAGS := --gc --minify --panicOnWarning --environment production --noBuildLock

.PHONY: check build build-drafts

check:
	./scripts/verify-build.sh

build:
	$(HUGO) $(PRODUCTION_FLAGS)

build-drafts:
	$(HUGO) $(PRODUCTION_FLAGS) --buildDrafts
