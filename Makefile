SHELL := /bin/bash

.PHONY: setup dev build lint test web server kill kill-dry sims kill-sims logs-clean

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

# Database (Drizzle + Postgres)
.PHONY: db-generate db-migrate
db-generate:
	npm run db:generate

db-migrate:
	npm run db:migrate

# Run two headless simulators against the server (requires server running)
sims:
	SERVER_URL=$${SERVER_URL:-ws://localhost:2567} NAME=sim-a node scripts/clientsim.mjs > logs/sim-a.console.log 2>&1 & echo $$! > logs/sim-a.pid
	SERVER_URL=$${SERVER_URL:-ws://localhost:2567} NAME=sim-b node scripts/clientsim.mjs > logs/sim-b.console.log 2>&1 & echo $$! > logs/sim-b.pid
	@echo "Started sims. Tail logs with: tail -f logs/client-sim-a.log logs/client-sim-b.log (or console logs in logs/sim-*.console.log)"

kill-sims:
	@for name in sim-a sim-b; do \
	  if [ -f logs/$$name.pid ]; then \
	    pid=$$(cat logs/$$name.pid); \
	    if kill -0 $$pid 2>/dev/null; then \
	      echo "Stopping $$name (pid $$pid)"; \
	      kill -TERM $$pid 2>/dev/null || true; \
	      sleep 0.5; \
	      if kill -0 $$pid 2>/dev/null; then \
	        echo "Force killing $$name (pid $$pid)"; \
	        kill -KILL $$pid 2>/dev/null || true; \
	      fi; \
	    else \
	      echo "PID in logs/$$name.pid not running ($$pid)"; \
	    fi; \
	    rm -f logs/$$name.pid; \
	  else \
	    echo "No PID file for $$name"; \
	  fi; \
	done
