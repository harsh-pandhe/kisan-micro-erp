import { describe, expect, it } from 'vitest';
import { normalizeForClassification, tokenize } from '../../src/features/classification/normalize';

describe('normalizeForClassification', () => {
  it('lowercases, trims, and collapses whitespace', () => {
    expect(normalizeForClassification('  Fertilizer   Purchase  ')).toBe('fertilizer purchase');
  });

  it('strips punctuation but preserves token boundaries', () => {
    expect(normalizeForClassification('diesel, 20L')).toBe('diesel 20l');
  });

  it('resolves documented Hindi/Hinglish aliases to their English canonical term', () => {
    expect(normalizeForClassification('khaad')).toBe('fertilizer');
    expect(normalizeForClassification('beej')).toBe('seeds');
    expect(normalizeForClassification('dawai')).toBe('pesticide');
  });

  it('is deterministic for the same input', () => {
    const a = normalizeForClassification('Diesel for Tractor');
    const b = normalizeForClassification('Diesel for Tractor');
    expect(a).toBe(b);
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeForClassification('   ')).toBe('');
  });
});

describe('tokenize', () => {
  it('splits a normalized string into tokens', () => {
    expect(tokenize('diesel for tractor')).toEqual(['diesel', 'for', 'tractor']);
  });

  it('returns an empty array for an empty string', () => {
    expect(tokenize('')).toEqual([]);
  });
});
