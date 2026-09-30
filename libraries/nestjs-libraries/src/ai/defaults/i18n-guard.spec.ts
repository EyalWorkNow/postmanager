import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { LANGUAGE_CODES } from '@postmill-ai/provider-kernel';

// G2 (i18n regression guard): belt-and-suspenders on top of languages.sync.spec.
// Locks in the Hebrew/Bengali/Georgian removal and enforces locale key parity so a
// half-translated batch (missing or empty locale keys) fails CI, not production.

const LOCALES_DIR = path.resolve(
  __dirname,
  '../../../../react-shared-libraries/src/translation/locales'
);
const UI_LOCALES = ['ar', 'de', 'es', 'fr', 'id', 'it', 'ja', 'ko', 'nl', 'pl', 'pt', 'ru', 'tr', 'vi', 'zh'];

const load = (locale: string): Record<string, string> =>
  JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, locale, 'translation.json'), 'utf8'));

describe('i18n guard', () => {
  it('has removed the Hebrew, Bengali and Georgian locale directories', () => {
    for (const dead of ['he', 'bn', 'ka_ge']) {
      expect(fs.existsSync(path.join(LOCALES_DIR, dead))).toBe(false);
    }
  });

  it('does not list Hebrew or Bengali as a supported UI language', () => {
    expect(LANGUAGE_CODES).not.toContain('he');
    expect(LANGUAGE_CODES).not.toContain('bn');
  });

  it('ships exactly en + 15 UI locale files, all valid JSON', () => {
    const dirs = fs
      .readdirSync(LOCALES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    expect(dirs).toEqual(['en', ...UI_LOCALES].sort());
    // valid JSON + non-empty
    for (const d of dirs) expect(Object.keys(load(d)).length).toBeGreaterThan(0);
  });

  it('every UI locale has full key parity with en and no empty values', () => {
    const en = load('en');
    const enKeys = Object.keys(en);
    for (const locale of UI_LOCALES) {
      const o = load(locale);
      const missingOrEmpty = enKeys.filter((k) => !(k in o) || o[k] === '');
      expect(
        missingOrEmpty,
        `${locale}: ${missingOrEmpty.length} keys missing/empty (e.g. ${missingOrEmpty
          .slice(0, 5)
          .join(', ')})`
      ).toEqual([]);
    }
  });

  it('keeps dayjs date-format values made of dayjs tokens, not translated letters', () => {
    // A translator once localized the tokens themselves (JJJJ, AAAA, ГГГГ) and left
    // literal words unescaped ("D de MMMM" — dayjs reads the d as a weekday).
    const en = load('en');
    const formatKeys = Object.keys(en).filter(
      (k) => k.endsWith('_format') && /^[YMDdHhmsA ,:/.-]+$/.test(en[k])
    );
    expect(formatKeys.length).toBeGreaterThan(0);
    const leftover = (v: string) =>
      v
        .replace(/\[[^\]]*\]/g, '')
        .replace(/Y{2,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|m{1,2}|s{1,2}|a|A/g, '');
    for (const locale of UI_LOCALES) {
      const o = load(locale);
      const bad = formatKeys.filter((k) => /[A-Za-zЀ-ӿ]/.test(leftover(o[k])));
      expect(bad.map((k) => `${k}=${o[k]}`), locale).toEqual([]);
    }
  });
});
