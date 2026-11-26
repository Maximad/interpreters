# Interpreter Marketplace

The Next.js web app and Fastify API support interpreter onboarding, profile review, public search, and client requests with quotes. PostgreSQL stores marketplace data and Meilisearch indexes approved profiles.

## Run locally

Use Docker Compose v2 and run `make local` from the repository root. The marketplace is at [localhost:8080](http://localhost:8080) and Mailpit captures its verification and request emails at [localhost:8025](http://localhost:8025). Set `HTTP_PORT` or `MAILPIT_PORT` to change those ports.

```sh
npm ci
npm run prisma:generate -w @im/api
npm run lint:ci
npm test -w @im/api
node scripts/smoke-test.mjs
```

The smoke test creates synthetic users and requests in the local Compose project. It checks email verification, review, matching, and quote acceptance.

## Release and hosting

GitHub Actions verifies the Docker stack and publishes images for `main` and version tags. The same workflow can check the VPS with the existing SSH credentials or deploy a verified `main` revision by image digest.

Keep production configuration outside the repository. Set `PUBLIC_BASE_URL` to the current HTTPS address and configure `SMTP_URL` and `SMTP_FROM` to enable registration and email notifications. A temporary hostname can be configured through the gateway and environment file without rebuilding the web application. [Operations runbook](docs/ops/runbook.md)
