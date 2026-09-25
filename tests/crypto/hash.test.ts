import { describe, expect, it } from 'vitest';
import { bytesEqual, fromHex, sha256Bytes, sha256Hex, toHex } from '../../src/features/crypto/hash';

describe('sha256Hex / sha256Bytes', () => {
  // Known-answer test vectors, NOT computed via the function under test —
  // the standard SHA-256 vectors for the empty string and "abc".
  it('matches the known SHA-256 vector for the empty byte array', () => {
    expect(sha256Hex(new Uint8Array(0))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('matches the known SHA-256 vector for "abc"', () => {
    const bytes = new TextEncoder().encode('abc');
    expect(sha256Hex(bytes)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('sha256Bytes and sha256Hex agree', () => {
    const data = new TextEncoder().encode('kisan-micro-erp');
    expect(toHex(sha256Bytes(data))).toBe(sha256Hex(data));
  });

  it('hex round-trips through fromHex/toHex', () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
    expect(toHex(fromHex(toHex(bytes)))).toBe(toHex(bytes));
  });

  it('is sensitive to a single-byte change', () => {
    const a = new TextEncoder().encode('hello world');
    const b = new TextEncoder().encode('hello worle');
    expect(sha256Hex(a)).not.toBe(sha256Hex(b));
  });
});

describe('bytesEqual', () => {
  it('true for identical content, false for any difference or length mismatch', () => {
    expect(bytesEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(bytesEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
    expect(bytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false);
  });
});
