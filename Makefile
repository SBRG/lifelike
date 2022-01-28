## -------------------------------------------------------
## See usage by running `make help`
## -------------------------------------------------------

# Include Docker Makefile
include ./docker/Makefile

# Include Helm Makefile
include ./helm/Makefile


.PHONY: githooks

githooks: ##@development Set up Git commit hooks for linting and code formatting
	git config --local core.hooksPath .githooks/


# Help -------------------------------------------------------------------------
.PHONY: help

help: ##@other Show this help.
	@perl -e '$(HELP_FUN)' $(MAKEFILE_LIST)

GREEN  := $(shell tput -Txterm setaf 2)
WHITE  := $(shell tput -Txterm setaf 7)
YELLOW := $(shell tput -Txterm setaf 3)
RED := $(shell tput -Txterm setaf 1)
RESET  := $(shell tput -Txterm sgr0)
HELP_FUN = \
    %help; \
    while(<>) { push @{$$help{$$2 // 'options'}}, [$$1, $$3] if /^([a-zA-Z\-]+)\s*:.*\#\#(?:@([a-zA-Z\-]+))?\s(.*)$$/ }; \
    print "usage: make [target]\n\n"; \
    for (sort keys %help) { \
    print "${WHITE}$$_:${RESET}\n"; \
    for (@{$$help{$$_}}) { \
    $$sep = " " x (32 - length $$_->[0]); \
    print "  ${YELLOW}$$_->[0]${RESET}$$sep${GREEN}$$_->[1]${RESET}\n"; \
    }; \
    print "\n"; }

.DEFAULT_GOAL := help
# -----------------------------------------------------------------------------
