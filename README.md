# interpreters

## Shared gateway usage

When running behind a shared/external gateway, use the gateway configuration in `infra/Caddyfile.interpreters` (in this repo at `interpreter-marketplace/infra/Caddyfile.interpreters`) to route traffic into the interpreters app services.

### Route mapping

The gateway should route requests as follows:

- `/api/*` → `interpreters-api:4000`
- `/health` → `interpreters-api:4000`
- everything else → `interpreters-web:3000`

### Verification

After deploying with the shared gateway config, verify key routes and status codes:

```bash
# Homepage
curl -i http://<host>/
# Expected: HTTP 200

# Localized landing page
curl -i http://<host>/en
# Expected: HTTP 200

# Search page
curl -i http://<host>/en/search
# Expected: HTTP 200

# Health endpoint (API)
curl -i http://<host>/health
# Expected: HTTP 200
```

### Port exposure behind external gateway

If an external/shared gateway handles public ingress, the interpreters app stack should **not** directly expose public ports `80`/`443`. Public entry should terminate at the external gateway, which then forwards internally according to the route mapping above.
