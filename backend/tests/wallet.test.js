/**
 * Wallet / web3 tests.
 *
 * Focuses on the pure, offline-verifiable parts of the web3 layer: chain
 * registry, address validation/normalization across EVM/Solana/Bitcoin,
 * SIWE message construction, and EVM signature verification (using ethers to
 * produce a real signature). Also smoke-tests the wallet HTTP routes that do
 * not require external RPC.
 */
const { ethers } = require('ethers');
const request = require('supertest');
const app = require('../src/server');
const web3 = require('../src/lib/web3');

describe('web3 chain registry', () => {
  it('exposes the supported chains', () => {
    expect(Array.isArray(web3.SUPPORTED_CHAINS)).toBe(true);
    expect(web3.SUPPORTED_CHAINS).toEqual(
      expect.arrayContaining(['ethereum', 'polygon', 'solana', 'bitcoin'])
    );
  });

  it('getChain resolves case-insensitively and throws on unknown', () => {
    expect(web3.getChain('ETHEREUM').kind).toBe('evm');
    expect(() => web3.getChain('dogecoin')).toThrow(/Unsupported chain/);
  });
});

describe('validateAddress', () => {
  it('accepts a valid EVM address and rejects garbage', () => {
    expect(web3.validateAddress('ethereum', '0x52908400098527886E0F7030069857D2E4169EE7')).toBe(true);
    expect(web3.validateAddress('polygon', '0x52908400098527886E0F7030069857D2E4169EE7')).toBe(true);
    expect(web3.validateAddress('ethereum', '0xnot-an-address')).toBe(false);
    expect(web3.validateAddress('ethereum', '')).toBe(false);
    expect(web3.validateAddress('ethereum', null)).toBe(false);
  });

  it('validates a Solana base58 address', () => {
    expect(web3.validateAddress('solana', '4Nd1mYsHN7p6Xq2yJ8q4F8s5p1m2N3o4P5q6R7s8T9u')).toBe(true);
    expect(web3.validateAddress('solana', '0x123')).toBe(false);
  });

  it('validates a Bitcoin address (legacy + bech32)', () => {
    expect(web3.validateAddress('bitcoin', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(true);
    expect(web3.validateAddress('bitcoin', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(true);
    expect(web3.validateAddress('bitcoin', 'not-a-btc-address')).toBe(false);
  });
});

describe('normalizeAddress', () => {
  it('lowercases EVM addresses but leaves others untouched', () => {
    expect(web3.normalizeAddress('ethereum', '0xABCDEF0000000000000000000000000000000001')).toBe(
      '0xabcdef0000000000000000000000000000000001'
    );
    const sol = '4Nd1mYsHN7p6Xq2yJ8q4F8s5p1m2N3o4P5q6R7s8T9u';
    expect(web3.normalizeAddress('solana', sol)).toBe(sol);
  });
});

describe('buildSiweMessage', () => {
  it('builds a message containing the address, nonce and domain', () => {
    const msg = web3.buildSiweMessage({ address: '0xabc', nonce: 'nonce123' });
    expect(msg).toContain('0xabc');
    expect(msg).toContain('nonce123');
    expect(msg).toContain('solaris-health.abacusai.cloud');
  });
});

describe('verifyEvmSignature', () => {
  it('returns true for a correctly signed message', async () => {
    const wallet = ethers.Wallet.createRandom();
    const message = web3.buildSiweMessage({ address: wallet.address, nonce: 'abc123' });
    const signature = await wallet.signMessage(message);
    expect(web3.verifyEvmSignature(message, signature, wallet.address)).toBe(true);
  });

  it('returns false when the signature is from a different wallet', async () => {
    const a = ethers.Wallet.createRandom();
    const b = ethers.Wallet.createRandom();
    const message = web3.buildSiweMessage({ address: a.address, nonce: 'abc123' });
    const signature = await b.signMessage(message);
    expect(web3.verifyEvmSignature(message, signature, a.address)).toBe(false);
  });

  it('returns false for a malformed signature instead of throwing', () => {
    expect(web3.verifyEvmSignature('hello', '0xdeadbeef', '0xabc')).toBe(false);
  });
});

describe('wallet routes require auth', () => {
  it('rejects GET /api/wallet/chains without a token', async () => {
    const res = await request(app).get('/api/wallet/chains');
    expect(res.status).toBe(401);
  });

  it('rejects GET /api/wallet/me without a token', async () => {
    const res = await request(app).get('/api/wallet/me');
    expect(res.status).toBe(401);
  });

  it('rejects POST /api/wallet/connect without a token', async () => {
    const res = await request(app)
      .post('/api/wallet/connect')
      .send({ chain: 'ethereum', address: '0x52908400098527886E0F7030069857D2E4169EE7' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/wallet/chains (authenticated)', () => {
  let token;
  let userId;

  beforeAll(async () => {
    const reg = await request(app).post('/api/auth/register').send(global.makeUserPayload());
    token = reg.body.token;
    userId = reg.body.user && reg.body.user.id;
  });

  afterAll(async () => {
    if (userId) {
      const db = require('../src/db');
      await db.query('DELETE FROM reward_events WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });

  it('returns the supported chain metadata for an authed user', async () => {
    const res = await request(app)
      .get('/api/wallet/chains')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.chains)).toBe(true);
    expect(res.body.chains.length).toBeGreaterThanOrEqual(4);
  });
});
