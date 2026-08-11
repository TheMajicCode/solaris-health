/**
 * Spark config + adapter unit tests (Beta V1 investor-demo, spec §4).
 *
 * These assert the fail-closed configuration gate and the client-only adapter's
 * safety properties WITHOUT ever invoking a live SparkWallet.initialize():
 *   - config is disabled by default and only enables on the exact env pair;
 *   - an enabled-but-misconfigured network fails closed (no silent fallback);
 *   - mnemonic SHAPE validation, word-position picking, and address classing;
 *   - the deterministic non-secret fixture path creates/restores with NO SDK load;
 *   - shape-invalid restore rejects BEFORE any SDK call;
 *   - creation is single-flight (concurrent presses share one in-flight promise).
 *
 * No real key/mnemonic is created; only the NATO demo fixture is used.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readSparkConfig, isSparkDemoFixture, ALLOWED_NETWORKS } from '../lib/spark/config.js';
import {
  DEMO_FIXTURE_MNEMONIC,
  looksLikeMnemonic, pickWordPositions, wordAt, classifySparkAddress,
  createSparkWallet, restoreSparkWallet, isSparkBusy,
} from '../lib/spark/adapter.js';

afterEach(() => { vi.unstubAllEnvs(); });

describe('readSparkConfig — fail closed', () => {
  it('is disabled by default (no env set)', () => {
    const cfg = readSparkConfig();
    expect(cfg.enabled).toBe(false);
    expect(cfg.reason).toBeTruthy();
  });

  it('enables only with the exact env pair', () => {
    vi.stubEnv('VITE_SPARK_WALLET_ENABLED', 'true');
    vi.stubEnv('VITE_SPARK_NETWORK', 'REGTEST');
    const cfg = readSparkConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.network).toBe('REGTEST');
  });

  it('fails closed (no fallback) when enabled but the network is invalid', () => {
    vi.stubEnv('VITE_SPARK_WALLET_ENABLED', 'true');
    vi.stubEnv('VITE_SPARK_NETWORK', 'TESTNET');
    const cfg = readSparkConfig();
    expect(cfg.enabled).toBe(false);
    expect(cfg.invalid).toBe(true);
  });

  it('exposes the demo-fixture toggle and the allowed networks', () => {
    expect(isSparkDemoFixture()).toBe(false);
    vi.stubEnv('VITE_SPARK_DEMO_FIXTURE', 'true');
    expect(isSparkDemoFixture()).toBe(true);
    expect(ALLOWED_NETWORKS).toEqual(['REGTEST', 'MAINNET']);
  });
});

describe('mnemonic shape + helpers', () => {
  it('looksLikeMnemonic accepts standard lengths of lowercase words only', () => {
    expect(looksLikeMnemonic(DEMO_FIXTURE_MNEMONIC)).toBe(true); // 12 words
    expect(looksLikeMnemonic(Array(24).fill('word').join(' '))).toBe(true);
    expect(looksLikeMnemonic(Array(13).fill('word').join(' '))).toBe(false); // non-standard length
    expect(looksLikeMnemonic('alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo l1ma')).toBe(false); // digit
    expect(looksLikeMnemonic('alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo li_a')).toBe(false); // symbol
  });

  it('pickWordPositions returns n distinct 1-based positions in range', () => {
    const pos = pickWordPositions(DEMO_FIXTURE_MNEMONIC, 3);
    expect(pos).toHaveLength(3);
    expect(new Set(pos).size).toBe(3);
    pos.forEach((p) => { expect(p).toBeGreaterThanOrEqual(1); expect(p).toBeLessThanOrEqual(12); });
  });

  it('wordAt reads 1-based word positions', () => {
    expect(wordAt(DEMO_FIXTURE_MNEMONIC, 1)).toBe('alpha');
    expect(wordAt(DEMO_FIXTURE_MNEMONIC, 12)).toBe('lima');
  });

  it('classifySparkAddress maps prefixes and rejects junk', () => {
    expect(classifySparkAddress('spark1qexampleaddress')).toEqual(
      expect.objectContaining({ ok: true, chain: 'spark-mainnet' }),
    );
    expect(classifySparkAddress('sparkrt1qexampleaddress')).toEqual(
      expect.objectContaining({ ok: true, chain: 'spark-regtest' }),
    );
    expect(classifySparkAddress('not-an-address').ok).toBe(false);
  });
});

describe('adapter safety — fixture path never loads the SDK', () => {
  it('createSparkWallet with a fixture mnemonic returns it with NO wallet/live init', async () => {
    const res = await createSparkWallet({ network: 'REGTEST', fixtureMnemonic: DEMO_FIXTURE_MNEMONIC });
    expect(res).toEqual({ mnemonic: DEMO_FIXTURE_MNEMONIC, wallet: null, fixture: true });
    expect(isSparkBusy()).toBe(false);
  });

  it('restoreSparkWallet rejects shape-invalid words BEFORE any SDK call', async () => {
    await expect(restoreSparkWallet({ network: 'REGTEST', mnemonic: 'too few words' }))
      .rejects.toThrow(/recovery words/i);
  });

  it('restoreSparkWallet with fixture:true returns without live init', async () => {
    const res = await restoreSparkWallet({ network: 'REGTEST', mnemonic: DEMO_FIXTURE_MNEMONIC, fixture: true });
    expect(res).toEqual({ wallet: null, fixture: true });
  });

  it('creation is single-flight — concurrent presses share one in-flight result', async () => {
    const p1 = createSparkWallet({ network: 'REGTEST', fixtureMnemonic: DEMO_FIXTURE_MNEMONIC });
    const p2 = createSparkWallet({ network: 'REGTEST', fixtureMnemonic: DEMO_FIXTURE_MNEMONIC });
    expect(isSparkBusy()).toBe(true);
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual(r2);
    expect(isSparkBusy()).toBe(false);
  });
});
