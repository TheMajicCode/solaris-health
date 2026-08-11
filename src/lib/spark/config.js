/**
 * spark/config.js — explicit, fail-closed Spark configuration (spec §4).
 *
 * The optional Spark wallet surface is DISABLED unless the build sets BOTH:
 *   VITE_SPARK_WALLET_ENABLED = "true"
 *   VITE_SPARK_NETWORK        = "REGTEST" | "MAINNET"   (exact, no default/fallback)
 *
 * Anything missing/disabled/unknown fails closed with a user-safe message and no
 * Spark SDK or network activity ever runs. When enabled, the active network is
 * always surfaced to the member. There is NO default network and NO silent
 * fallback: an enabled build with an invalid VITE_SPARK_NETWORK stays disabled.
 */

const ALLOWED_NETWORKS = ['REGTEST', 'MAINNET'];

// Non-secret, deterministic demo fixture toggle (spec §4/§7): when set, the UI's
// backup-gate can be exercised WITHOUT ever invoking a live SparkWallet.initialize()
// or creating a real mnemonic. It carries no secret and no network access.
export function isSparkDemoFixture() {
  const v = import.meta.env.VITE_SPARK_DEMO_FIXTURE;
  return v === 'true' || v === true;
}

/**
 * @returns {{enabled:boolean, network?:string, invalid?:boolean, reason?:string}}
 */
export function readSparkConfig() {
  const enabledRaw = import.meta.env.VITE_SPARK_WALLET_ENABLED;
  const enabled = enabledRaw === 'true' || enabledRaw === true;
  if (!enabled) {
    return { enabled: false, reason: 'The optional Spark wallet is turned off in this build.' };
  }
  const network = import.meta.env.VITE_SPARK_NETWORK;
  if (!ALLOWED_NETWORKS.includes(network)) {
    // Fail closed — enabled but misconfigured is NOT a wallet we will touch.
    return {
      enabled: false,
      invalid: true,
      reason: 'The Spark wallet is not available because its network is not configured correctly.',
    };
  }
  return { enabled: true, network };
}

export { ALLOWED_NETWORKS };
