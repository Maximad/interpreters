import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFilters } from './search';
import { meiliFilter } from './requests';

test('buildFilters escapes quotes and backslashes in list values', () => {
  const filter = buildFilters({
    q: undefined,
    languages: 'English "Legal", Urdu\\Hindi',
    domains: 'Health\\Care',
    cities: 'Dubai "City"',
    onsite: undefined,
    remote: undefined,
    min_rate: undefined,
    max_rate: undefined,
    min_years: undefined,
    verified_only: undefined,
    page: 1,
    page_size: 20
  });

  assert.equal(
    filter,
    '(languages = "English \\\"Legal\\\"" OR languages = "Urdu\\\\Hindi") AND (domains = "Health\\\\Care") AND (cities = "Dubai \\\"City\\\"")'
  );
});

test('meiliFilter escapes quotes and backslashes for broadcast strings', () => {
  const filter = meiliFilter({
    sourceLanguage: 'English "Primary"',
    targetLanguage: 'Urdu\\Hindi',
    domain: 'Legal "Court"',
    city: 'Abu\\Dhabi "Central"',
    onsiteRequired: true,
    remoteAllowed: false,
    scheduledFor: '2026-01-01T00:00:00.000Z'
  });

  assert.equal(
    filter,
    '(languages = "English \\\"Primary\\\"" OR languages = "Urdu\\\\Hindi") AND (domains = "Legal \\\"Court\\\"") AND (cities = "Abu\\\\Dhabi \\\"Central\\\"") AND (onsite_enabled = true) AND (remote_enabled = false)'
  );
});
