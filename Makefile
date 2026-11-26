ENV_FILE ?= .env
BASE_COMPOSE = infra/docker-compose.yml
VPS_COMPOSE = infra/docker-compose.vps.yml
LOCAL_COMPOSE = infra/docker-compose.local.yml
COMPOSE = docker compose --env-file "$(ENV_FILE)" -f $(BASE_COMPOSE) -f $(VPS_COMPOSE)

.PHONY: deploy verify-compose logs restart local prune-cache

deploy:
	ENV_FILE="$(ENV_FILE)" ./scripts/deploy.sh

verify-compose:
	./scripts/verify-compose.sh

logs:
	$(COMPOSE) logs -f --tail=200

restart:
	$(COMPOSE) up -d --wait --wait-timeout 240

local:
	docker compose -p interpreters-local --env-file .env.example -f $(BASE_COMPOSE) -f $(LOCAL_COMPOSE) up -d --build --wait --wait-timeout 240

prune-cache:
	docker builder prune -f
