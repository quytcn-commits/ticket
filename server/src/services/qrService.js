const QRCode = require('qrcode');
const hmac = require('../utils/hmac');

function generateToken(eventId, studentId, studentCode) {
  const payload = `${eventId}:${studentId}:${studentCode}`;
  return hmac.sign(payload);
}

async function generateQRBuffer(token) {
  return QRCode.toBuffer(token, {
    width: 400,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  });
}

async function generateQRDataURL(token) {
  return QRCode.toDataURL(token, {
    width: 400,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
}

module.exports = { generateToken, generateQRBuffer, generateQRDataURL };
