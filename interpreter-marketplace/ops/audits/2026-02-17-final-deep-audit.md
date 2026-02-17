# Final Deep Audit — 2026-02-17

## Scope
- Repository: `interpreter-marketplace`
- Audited areas: API auth/security, request/quote workflows, search filter safety, CORS/JWT configuration, Prisma schema constraints, and web-client integration surface.

## Methodology
1. **Static code review** across critical API and web routes.
2. **Config and schema review** for auth, secrets, and data integrity assumptions.
3. **Dependency/test execution attempt** via `npm ci`, `npm run lint`, `npm run build` where possible.
4. **Risk ranking** by exploitability and impact.

## Execution Notes
- `npm ci` is currently blocked in this environment by registry access policy (`403 Forbidden`), so dependency-based checks (lint/build/test/audit) could not be completed here.
- Findings below are based on direct source inspection and architecture-level review.

## Findings

### 1) Critical: JWT secret fallback enables predictable signing key
**Severity:** Critical  
**Evidence:** API registers JWT with a hardcoded fallback secret (`dev-secret`) when `JWT_SECRET` is unset.  
**Location:** `apps/api/src/app.ts`  
**Risk:** If production is misconfigured, attackers can mint valid tokens and fully bypass authentication and RBAC.

**Recommendation**
- Fail fast at startup if `JWT_SECRET` is missing in non-test environments.
- Optionally fail in all environments except explicit local development mode.

---

### 2) High: Access tokens appear to be issued without explicit expiry
**Severity:** High  
**Evidence:** Login signs JWT payload without explicit `expiresIn`, and no global sign options are configured in the JWT plugin registration path shown.  
**Locations:** `apps/api/src/routes/auth.ts`, `apps/api/src/app.ts`  
**Risk:** Long-lived or non-expiring bearer tokens materially increase account-takeover blast radius if leaked.

**Recommendation**
- Set `sign.expiresIn` in JWT plugin config (or pass `{ expiresIn }` to `jwtSign`) using validated `JWT_EXPIRES_IN`.
- Consider short access token TTL + refresh rotation.

---

### 3) High: No brute-force/rate-limiting controls visible on auth endpoints
**Severity:** High  
**Evidence:** `/auth/signup`, `/auth/login`, `/auth/verify-email` routes have validation but no apparent rate-limiting / lockout / IP throttling middleware.  
**Location:** `apps/api/src/routes/auth.ts`  
**Risk:** Credential stuffing and token-guessing attempts are cheaper and can degrade availability.

**Recommendation**
- Add per-IP and per-account throttling for auth routes.
- Add temporary lockouts/backoff for repeated failed logins.
- Log and alert on auth abuse patterns.

---

### 4) Medium: Email verification tokens are stored in plaintext
**Severity:** Medium  
**Evidence:** Verification token is generated and persisted directly; lookup is by raw token value.  
**Location:** `apps/api/src/routes/auth.ts`, `apps/api/prisma/schema.prisma`  
**Risk:** If DB is leaked, attackers can replay still-valid verification tokens.

**Recommendation**
- Store a hash of the verification token (e.g., SHA-256), compare hashed input.
- Keep token TTL short and invalidate on regenerate.

---

### 5) Medium: Background intervals run forever without lifecycle coordination
**Severity:** Medium  
**Evidence:** Two unmanaged `setInterval` loops start after listen (`search sync`, `notification queue`) without `unref`, backpressure/locking, or graceful shutdown handling shown.  
**Location:** `apps/api/src/server.ts`  
**Risk:** Overlapping jobs under slow downstream dependencies can cause load amplification, noisy logs, and delayed shutdown behavior.

**Recommendation**
- Use a scheduler guard (single-flight mutex) per task.
- Add shutdown hooks and clear intervals.
- Consider queue-based workers for notification processing.

---

### 6) Low/Informational: Some `any` casts in request pipeline reduce type safety
**Severity:** Low  
**Evidence:** `any` casts in Meilisearch hits and notification createMany payload casting.  
**Location:** `apps/api/src/routes/requests.ts`  
**Risk:** Type blind spots may hide malformed data bugs.

**Recommendation**
- Replace `any` with narrowed DTO/interface types and runtime guards where needed.

## Positive Controls Observed
- Password hashing uses `scrypt` with per-password random salt and constant-time comparison.  
- Zod validation is consistently applied to route inputs.  
- Search filters escape quoted strings for Meilisearch filter safety.

## Priority Remediation Plan
1. **Immediate (today):** enforce required `JWT_SECRET`; enforce token expiry.
2. **Next (1–2 days):** add auth throttling + abuse telemetry.
3. **Next (2–4 days):** hash email verification tokens + rotation strategy.
4. **After:** harden scheduler/worker lifecycle and remove `any` casts.

## Suggested Verification After Fixes
- `npm ci`
- `npm run lint --workspaces --if-present`
- `npm run build`
- API integration tests for auth/login/verify flows (including rate-limit behavior).
- Security regression tests for token expiry and invalid secret boot behavior.
