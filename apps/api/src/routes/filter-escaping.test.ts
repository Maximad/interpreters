import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFilters } from './search';
import { parseLanguagePair } from '../utils/language-pair';

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

test('parses ordered interpreting pairs from saved profile directions', () => {
  assert.equal(parseLanguagePair(' Arabic → ENGLISH '), 'arabic->english');
  assert.equal(parseLanguagePair('English->Arabic'), 'english->arabic');
  assert.equal(parseLanguagePair('English'), undefined);
  assert.equal(parseLanguagePair('English → English'), undefined);
});
