.PHONY: all install lint typecheck test test-node test-python dev seed docker-up docker-down clean

all: install lint typecheck test

install:
	pnpm install
	cd agents && uv sync

lint:
	pnpm -r lint
	cd agents && uv run ruff check .

typecheck:
	pnpm -r typecheck
	cd agents && uv run mypy app

test: test-node test-python

test-node:
	pnpm -r test

test-python:
	cd agents && uv run pytest

dev-api:
	pnpm --filter @loompilot/api dev

dev-agents:
	cd agents && uv run uvicorn app.main:app --reload --port 8000

dev-web:
	pnpm --filter @loompilot/web dev

seed:
	pnpm --filter @loompilot/api seed

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

clean:
	pnpm clean

