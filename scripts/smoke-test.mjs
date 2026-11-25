import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

const port = Number(process.env.HTTP_PORT || 8080);
const mailPort = Number(process.env.MAILPIT_PORT || 8025);
const web = `http://localhost:${port}`;
const mail = `http://localhost:${mailPort}`;
const password = 'local-smoke-password';
const run = Date.now();
const domainName = `Smoke test ${run}`;

async function apiResponse(path, { method = 'GET', payload, token } = {}) {
  return fetch(`${web}/api${path}`, {
    method,
    headers: {
      ...(payload ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: payload ? JSON.stringify(payload) : undefined,
    signal: AbortSignal.timeout(15000)
  });
}

async function api(path, options = {}) {
  const response = await apiResponse(path, options);
  assert.equal(response.status, options.expected ?? 200, `${options.method ?? 'GET'} ${path}`);
  return response.json();
}

function localSql(sql) {
  return execFileSync('docker', [
    'compose', '-p', 'interpreters-local', '--env-file', '.env.example',
    '-f', 'infra/docker-compose.yml', '-f', 'infra/docker-compose.local.yml',
    'exec', '-T', 'postgres', 'sh', '-c',
    'exec psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At'
  ], { input: sql, encoding: 'utf8' }).trim();
}

async function waitForMail(email, subject, count = 1) {
  const query = encodeURIComponent(`to:${email}`);
  for (let attempt = 0; attempt < 80; attempt++) {
    const response = await fetch(`${mail}/api/v1/search?query=${query}`);
    assert.equal(response.status, 200, 'Mailpit inbox search');
    const { messages } = await response.json();
    const matches = messages?.filter((message) => message.Subject === subject) ?? [];
    if (matches.length >= count) {
      const detail = await fetch(`${mail}/api/v1/message/${matches[0].ID}`);
      assert.equal(detail.status, 200, 'Mailpit message');
      return detail.json();
    }
    await setTimeout(250);
  }
  throw new Error(`Mailpit did not receive ${subject}`);
}

async function login(email) {
  const { token } = await api('/auth/login', { method: 'POST', payload: { email, password } });
  assert.ok(token);
  return token;
}

async function signup(name, role, resend = false) {
  const email = `${name.toLowerCase().replaceAll(' ', '-')}-${run}@example.test`;
  const result = await api('/auth/signup', {
    method: 'POST', payload: { email, password, role, fullName: name }
  });
  assert.equal(Object.hasOwn(result, 'token'), false);
  if (resend) {
    await api('/auth/login', { method: 'POST', payload: { email, password }, expected: 403 });
    await api('/auth/resend-verification', { method: 'POST', payload: { email } });
  }
  const message = await waitForMail(email, 'Verify your Interpreter Marketplace email', resend ? 2 : 1);
  const link = new URL(message.Text.match(/https?:\/\/\S+/u)[0]);
  assert.equal(link.origin, web);
  assert.equal(link.pathname, '/en/auth/verify-email');
  const token = new URLSearchParams(link.hash.slice(1)).get('token');
  assert.ok(token);
  await api('/auth/verify-email', { method: 'POST', payload: { token } });
  if (resend) await api('/auth/verify-email', { method: 'POST', payload: { token }, expected: 400 });
  return { name, email };
}

const health = await fetch(`${web}/health`);
assert.equal(health.status, 200, 'Gateway health');
const verificationPage = await fetch(`${web}/auth/verify-email`);
assert.equal(verificationPage.status, 200);
assert.equal(new URL(verificationPage.url).pathname, '/en/auth/verify-email');
for (const [path, heading] of [
  ['/en', 'Interpreter Marketplace'],
  ['/ar/auth/verify-email', 'إعادة إرسال رسالة التحقق'],
  ['/en/admin/profiles', 'Interpreter profiles awaiting review'],
  ['/en/interpreter/profile-wizard', 'Interpreter Marketplace'],
  ['/en/client/broadcast', 'Request an interpreter'],
  ['/en/client/dashboard', 'Your requests']
]) {
  const page = await fetch(`${web}${path}`);
  assert.equal(page.status, 200, path);
  assert.ok((await page.text()).includes(heading), path);
}

const options = await api('/profile/options');
const arabic = options.languages.find((language) => language.name === 'Arabic');
const english = options.languages.find((language) => language.name === 'English');
const dubai = options.cities.find((city) => city.name === 'Dubai');
const abuDhabi = options.cities.find((city) => city.name === 'Abu Dhabi');
assert.ok(arabic && english && dubai && abuDhabi);

const domainId = Number(localSql(`INSERT INTO "Domain" (name) VALUES ('${domainName}') RETURNING id;`).split('\n')[0]);
assert.ok(domainId > 0);

const client = await signup('Test Client', 'CLIENT', true);
const admin = await signup('Test Reviewer', 'CLIENT');
localSql(`UPDATE "User" SET role = 'ADMIN' WHERE email = '${admin.email}';`);
const clientToken = await login(client.email);
const adminToken = await login(admin.email);

async function createProfile(name, source, target) {
  const account = await signup(name, 'INTERPRETER');
  const token = await login(account.email);
  const steps = [
    { fullName: name, headline: 'Conference interpreter', cityId: dubai.id },
    { languages: [{ languageId: source.id, direction: `${source.name} → ${target.name}` }] },
    { domainIds: [domainId], coveredCityIds: [dubai.id], onsiteEnabled: true, remoteEnabled: true },
    { hourlyRateAed: 150, yearsExperience: 5, availabilityNotes: 'Available by appointment' },
    { certifications: [{ name: 'Test certificate', fileUrl: 'https://example.test/certificate.pdf' }] }
  ];
  for (const [index, payload] of steps.entries()) {
    await api(`/profile/wizard/step${index + 1}`, { method: 'PUT', token, payload });
  }
  const profile = await api('/profile/submit', { method: 'POST', token });
  assert.equal(profile.status, 'PENDING');
  return { ...account, token, profileId: profile.id };
}

const first = await createProfile('Test Interpreter One', arabic, english);
const second = await createProfile('Test Interpreter Two', arabic, english);
const reversed = await createProfile('Test Reverse Pair', english, arabic);
const pending = await api('/admin/profiles/pending', { token: adminToken });
for (const { profileId } of [first, second, reversed]) {
  assert.ok(pending.some((profile) => profile.id === profileId));
  await api(`/admin/profiles/${profileId}/review`, {
    method: 'POST', token: adminToken, payload: { status: 'APPROVED' }
  });
}

const requestDetails = {
  sourceLanguage: arabic.name, targetLanguage: english.name, domain: domainName,
  scheduledFor: new Date(run + 86400000).toISOString()
};
await api('/requests/broadcast', {
  method: 'POST', token: clientToken, expected: 400,
  payload: { ...requestDetails, onsiteRequired: true, remoteAllowed: false }
});
const result = await api('/requests/broadcast', {
  method: 'POST', token: clientToken,
  payload: { ...requestDetails, onsiteRequired: false, remoteAllowed: true }
});
assert.equal(result.matchedCount, 2);
const id = result.request.id;
const sessionPath = `/requests/${id}/session`;
const meetingLink = 'https://meet.example.test/private-session';
await api(sessionPath, { method: 'PUT', token: clientToken, payload: { details: meetingLink }, expected: 404 });
const invitations = await api('/dashboard/interpreter/requests', { token: first.token });
assert.ok(invitations.some(({ request }) => request.id === id));
const excluded = await api('/dashboard/interpreter/requests', { token: reversed.token });
assert.ok(excluded.every(({ request }) => request.id !== id));
await waitForMail(first.email, 'New broadcast interpreting request');

const quotePath = `/requests/${id}/quotes`;
const firstQuote = await api(quotePath, { method: 'POST', token: first.token, payload: { amountAed: 200 } });
const repeatedQuote = await api(quotePath, { method: 'POST', token: first.token, payload: { amountAed: 200 } });
assert.equal(repeatedQuote.id, firstQuote.id);
const secondQuote = await api(quotePath, { method: 'POST', token: second.token, payload: { amountAed: 220 } });
await api(`${quotePath}/${firstQuote.id}/accept`, {
  method: 'POST', token: clientToken, payload: { expectedAmountAed: 199 }, expected: 409
});

const decisions = await Promise.all([firstQuote, secondQuote].map((quote) =>
  apiResponse(`${quotePath}/${quote.id}/accept`, {
    method: 'POST', token: clientToken, payload: { expectedAmountAed: Number(quote.amount_aed) }
  })));
assert.deepEqual(decisions.map((response) => response.status).sort(), [200, 409]);
const accepted = await decisions.find((response) => response.ok).json();
const dashboard = await api('/dashboard/client/requests', { token: clientToken });
const filled = dashboard.find((request) => request.id === id);
assert.equal(filled.status, 'FILLED');
assert.equal(filled.quotes.filter((quote) => quote.status === 'ACCEPTED').length, 1);
assert.equal(filled.filled_quote_id, accepted.acceptedQuoteId);
await api(`${quotePath}/${accepted.acceptedQuoteId}/accept`, { method: 'POST', token: clientToken });
await api(quotePath, { method: 'POST', token: first.token, payload: { amountAed: 300 }, expected: 409 });

const [booked, declined] = accepted.acceptedQuoteId === firstQuote.id ? [first, second] : [second, first];
await api(sessionPath, { method: 'PUT', token: clientToken, payload: { details: 'http://meet.example.test/' }, expected: 400 });
const saved = await api(sessionPath, { method: 'PUT', token: clientToken, payload: { details: meetingLink } });
assert.deepEqual(saved, { details: meetingLink, completed_at: null });
const readSession = async (token) => {
  const rows = await api('/dashboard/interpreter/requests', { token });
  return rows.find(({ request }) => request.id === id).request.session;
};
assert.deepEqual(await readSession(booked.token), saved);
assert.equal(await readSession(declined.token), null);
const clientRequests = await api('/dashboard/client/requests', { token: clientToken });
assert.deepEqual(clientRequests.find((request) => request.id === id).session, saved);
await api(sessionPath, { method: 'PUT', token: booked.token, payload: { details: meetingLink }, expected: 403 });
await api(`${sessionPath}/complete`, { method: 'POST', token: declined.token, expected: 404 });
await api(`${sessionPath}/complete`, { method: 'POST', token: booked.token, expected: 409 });

localSql(`UPDATE "Request" SET scheduled_for = NOW() - INTERVAL '2 hours' WHERE id = '${id}';`);
const [clientComplete, interpreterComplete] = await Promise.all([clientToken, booked.token].map((token) =>
  api(`${sessionPath}/complete`, { method: 'POST', token })));
assert.ok(clientComplete.completed_at);
assert.equal(clientComplete.details, meetingLink);
assert.deepEqual(interpreterComplete, clientComplete);
assert.deepEqual(await readSession(booked.token), clientComplete);
await api(sessionPath, { method: 'PUT', token: clientToken, payload: { details: meetingLink }, expected: 409 });

const onsite = await api('/requests/broadcast', {
  method: 'POST', token: clientToken,
  payload: { ...requestDetails, city: dubai.name, onsiteRequired: true, remoteAllowed: false }
});
const onsitePath = `/requests/${onsite.request.id}`;
const onsiteQuote = await api(`${onsitePath}/quotes`, { method: 'POST', token: first.token, payload: { amountAed: 250 } });
await api(`${onsitePath}/quotes/${onsiteQuote.id}/accept`, { method: 'POST', token: clientToken });
const address = 'Conference Centre, Level 2';
const onsiteSession = await api(`${onsitePath}/session`, { method: 'PUT', token: clientToken, payload: { details: address } });
assert.equal(onsiteSession.details, address);

console.log('Verified signup, profile review, exact matching, quote acceptance, private meeting details and completion.');
