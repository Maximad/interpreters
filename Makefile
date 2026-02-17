PROJECT_DIR ?= /opt/interpreters
BASE_COMPOSE = infra/docker-compose.yml
VPS_COMPOSE = infra/docker-compose.vps.yml
COMPOSE = docker compose -f $(BASE_COMPOSE) -f $(VPS_COMPOSE)

.PHONY: deploy verify-compose logs restart prune-cache

deploy:
	PROJECT_DIR=$(PROJECT_DIR) ./scripts/deploy.sh

verify-compose:
	./scripts/verify-compose.sh

logs:
	$(COMPOSE) logs -f --tail=200

restart:
	$(COMPOSE) up -d --build --remove-orphans

prune-cache:
	docker builder prune -f
