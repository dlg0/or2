SHELL := /bin/bash

.PHONY: setup dev build lint test web server kill kill-dry

setup:
	@echo "Installing root and workspace deps"
	npm install

dev:
	npm run dev

build:
	npm run build

lint:
	npm run lint

test:
	npm run test

web:
	cd apps/web && npm run dev

server:
	cd apps/server && npm run dev

kill-dry:
	./scripts/kill-dev.sh

kill:
	./scripts/kill-dev.sh -f
