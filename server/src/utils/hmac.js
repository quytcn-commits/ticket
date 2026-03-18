const crypto = require('crypto');
const config = require('../config');

function sign(payload) {
  const encoded = Buffer.from(payload).toString('base64url');
  const signature = crypto
    .createHmac('sha256', config.HMAC_SECRET)
    .update(payload)
    .digest('base64url');
  return `v1.${encoded}.${signature}`;
}

function verify(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'v1') {
      return { valid: false, payload: null };
    }
    const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
    const expectedSig = crypto
      .createHmac('sha256', config.HMAC_SECRET)
      .update(payload)
      .digest('base64url');
    const valid = crypto.timingSafeEqual(
      Buffer.from(parts[2]),
      Buffer.from(expectedSig)
    );
    return { valid, payload };
  } catch {
    return { valid: false, payload: null };
  }
}

module.exports = { sign, verify };
