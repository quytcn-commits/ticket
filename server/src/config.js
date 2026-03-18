require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'default-jwt-secret',
  HMAC_SECRET: process.env.HMAC_SECRET || 'default-hmac-secret',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT) || 587,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  ADMIN_USER: process.env.ADMIN_USER || 'admin',
  ADMIN_PASS: process.env.ADMIN_PASS || 'admin123',
  DB_PATH: process.env.DB_PATH || require('path').join(__dirname, '../data/checkin.db'),
};
