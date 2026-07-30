'use strict';
/**
 * Documented PaymentProvider stubs (spec A4 §2.2). Their EXISTENCE documents
 * the seam for later rails (send-money-out / agent-spend). Their bodies throw
 * "not enabled" — they are never wired into M6.
 */
const { PaymentProvider } = require('../ports/PaymentProvider');

function notEnabled(name) {
  return () => {
    const err = new Error(`${name} is not enabled in this build`);
    err.status = 501;
    throw err;
  };
}

class OpenNodeAdapter extends PaymentProvider {
  constructor() { super(); this.name = 'opennode'; }
}
class LucaLightningAdapter extends PaymentProvider {
  constructor() { super(); this.name = 'luca-lightning'; }
}
class OobitAdapter extends PaymentProvider {
  constructor() { super(); this.name = 'oobit'; }
}
class BankTransferAdapter extends PaymentProvider {
  constructor() { super(); this.name = 'bank-transfer'; }
}

for (const Cls of [OpenNodeAdapter, LucaLightningAdapter, OobitAdapter, BankTransferAdapter]) {
  for (const m of ['createCheckout', 'verifyWebhook', 'getStatus', 'refund']) {
    Cls.prototype[m] = notEnabled(Cls.name);
  }
}

module.exports = { OpenNodeAdapter, LucaLightningAdapter, OobitAdapter, BankTransferAdapter };
