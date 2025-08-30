SHELL := /bin/bash

.PHONY: setup dev build lint test web server kill kill-dry sims logs-clean

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

logs-clean:
	rm -rf logs && mkdir -p logs

# Run two headless simulators against the server (requires server running)
sims:
	SERVER_URL=$${SERVER_URL:-ws://localhost:2567} NAME=sim-a node scripts/clientsim.mjs > logs/sim-a.console.log 2>&1 & echo $$! > logs/sim-a.pid
	SERVER_URL=$${SERVER_URL:-ws://localhost:2567} NAME=sim-b node scripts/clientsim.mjs > logs/sim-b.console.log 2>&1 & echo $$! > logs/sim-b.pid
	@echo "Started sims. Tail logs with: tail -f logs/client-sim-a.log logs/client-sim-b.log (or console logs in logs/sim-*.console.log)"
