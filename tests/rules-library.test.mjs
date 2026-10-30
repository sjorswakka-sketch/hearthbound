import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { RULES_LIBRARY, ruleBookPageUrl, searchRuleBook } from '../lib/rules-library.ts';

const root = new URL('../public/rules/', import.meta.url);
const books = new Map(RULES_LIBRARY.map(metadata => [metadata.id, JSON.parse(readFileSync(new URL(`${metadata.id}.json`, root), 'utf8'))]));

test('both official SRDs include every physical page and unchanged PDF integrity', () => {
  assert.equal(RULES_LIBRARY.length, 2);
  assert.equal([...books.values()].reduce((sum, book) => sum + book.pages.length, 0), 767);
  for (const metadata of RULES_LIBRARY) {
    const book = books.get(metadata.id);
    const pdf = readFileSync(new URL(`${metadata.id}.pdf`, root));
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.equal(book.pageCount, metadata.pageCount);
    assert.equal(book.pages.length, metadata.pageCount);
    assert.deepEqual(book.pages.map(page => page.page), Array.from({ length: metadata.pageCount }, (_, index) => index + 1));
    assert.ok(book.pages.every(page => typeof page.text === 'string' && page.text.trim().length > 0));
    assert.equal(createHash('sha256').update(pdf).digest('hex'), book.sha256);
    assert.equal(pdf.length, book.pdfBytes);
    assert.equal(book.textCharacters, book.pages.reduce((sum, page) => sum + page.text.length, 0));
    assert.ok(book.textCharacters > 1_300_000, 'the complete body must be present, not only a contents page');
  }
});

test('licensed attribution, source, and reference-only coverage travel with each book', () => {
  for (const [id, book] of books) {
    assert.equal(book.license, 'CC-BY-4.0');
    assert.equal(book.licenseUrl, 'https://creativecommons.org/licenses/by/4.0/legalcode');
    assert.match(book.attribution, /Wizards of the Coast LLC/);
    assert.match(book.attribution, /Creative Commons Attribution 4\.0 International License/);
    assert.ok(book.source.startsWith('https://media.dndbeyond.com/compendium-images/srd/'));
    assert.equal(book.pdf, `/rules/${id}.pdf`);
    assert.match(book.coverage, /automation is tracked separately/);
    assert.match(book.pages[0].text, /Legal Information/);
  }
});

test('search covers rules, classes, spells, equipment, and late-book creatures in both editions', () => {
  for (const book of books.values()) {
    for (const query of ['Barbarian', 'Spellcasting', 'Concentration', 'Magic Missile', 'Fireball', 'Armor', 'Tarrasque', 'Wolf']) {
      const results = searchRuleBook(book, query);
      assert.ok(results.length > 0, `${book.id} must find ${query}`);
      if (query === 'Tarrasque') assert.ok(results.some(page => page.page > 300), 'creature descriptions must exist beyond contents/indexes');
    }
    assert.deepEqual(searchRuleBook(book, 'this-nonexistent-rule-name-123456789'), []);
    assert.equal(searchRuleBook(book, '').length, book.pageCount);
  }
});

test('PDF links use exact physical page numbers and clamp navigation safely', () => {
  assert.equal(ruleBookPageUrl('srd-5.1', 403), '/rules/srd-5.1.pdf#page=403');
  assert.equal(ruleBookPageUrl('srd-5.2.1', 800), '/rules/srd-5.2.1.pdf#page=364');
  assert.equal(ruleBookPageUrl('srd-5.1', -3), '/rules/srd-5.1.pdf#page=1');
  assert.equal(ruleBookPageUrl('srd-5.1', NaN), '/rules/srd-5.1.pdf#page=1');
});
