const nodemailer = require('nodemailer');
const db = require('../db/connection');
const config = require('../config');

function getSmtpConfig() {
  const getVal = (key) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row?.value || '';
  };

  const host = getVal('smtp_host') || config.SMTP_HOST;
  const port = parseInt(getVal('smtp_port') || config.SMTP_PORT) || 587;
  const user = getVal('smtp_user') || config.SMTP_USER;
  const pass = getVal('smtp_pass') || config.SMTP_PASS;
  const fromName = getVal('smtp_from_name') || 'Event Check-in';

  return { host, port, user, pass, fromName };
}

function createTransporter() {
  const { host, port, user, pass } = getSmtpConfig();
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

/**
 * Get email template from DB settings, or use default
 * type: qr_fulbright, qr_vanhoa, qr_guest, remind_fulbright, remind_vanhoa, remind_guest
 * Falls back to: qr, remind
 */
function getTemplate(eventId, type) {
  // Try specific template first
  const key = `event_${eventId}_email_${type}`;
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (row?.value) {
    try { return JSON.parse(row.value); } catch {}
  }
  // Fallback to base type
  const baseType = type.startsWith('remind') ? 'remind' : 'qr';
  const baseKey = `event_${eventId}_email_${baseType}`;
  const baseRow = db.prepare('SELECT value FROM settings WHERE key = ?').get(baseKey);
  if (baseRow?.value) {
    try { return JSON.parse(baseRow.value); } catch {}
  }
  return TEMPLATES[type] || TEMPLATES[baseType] || DEFAULT_QR_TEMPLATE;
}

// Template builder
function buildTemplate({ gradient, badge, greeting, qrBg, qrBorder, qrText, qrTextColor, infoRows }) {
  return `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
  <div style="background: linear-gradient(135deg, ${gradient}); padding: 30px 40px; border-radius: 12px 12px 0 0;">
    ${badge ? `<p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">${badge}</p>` : ''}
    <h1 style="color: #ffffff; margin: ${badge ? '8px' : '0'} 0 0; font-size: 24px;">{{event_name}}</h1>
    <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">{{event_date}} {{event_location}}</p>
  </div>
  <div style="padding: 30px 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; color: #374151;">Xin chào <strong>{{student_name}}</strong>,</p>
    <p style="color: #6b7280; line-height: 1.6;">${greeting}</p>
    <div style="text-align: center; margin: 25px 0; padding: 20px; background: ${qrBg}; border-radius: 12px; border: 2px dashed ${qrBorder};">
      <img src="cid:qrcode" alt="QR Code" style="width: 250px; height: 250px;" />
      <p style="color: ${qrTextColor}; font-size: 13px; margin: 10px 0 0; font-weight: 600;">${qrText}</p>
    </div>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      ${infoRows}
    </table>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">Vui lòng không chia sẻ mã QR này cho người khác.<br/>Email này được gửi tự động từ hệ thống QR Check-in.</p>
  </div>
</div>`;
}

const infoRow = (label, value) => `<tr><td style="padding: 8px 0; color: #9ca3af; font-size: 13px; width: 130px;">${label}:</td><td style="padding: 8px 0; color: #374151; font-weight: 600;">${value}</td></tr>`;

// === 6 Templates: QR + Remind × 3 categories ===
const TEMPLATES = {
  // QR templates (lần đầu)
  qr_vanhoa: {
    subject: 'QR Check-in: {{event_name}} - ĐH Văn hóa TPHCM',
    body: buildTemplate({
      gradient: '#2563eb 0%, #1d4ed8 100%',
      greeting: 'Bạn đã đăng ký tham gia sự kiện với tư cách thành viên <strong>Đại học Văn hóa TPHCM</strong>. Vui lòng mang theo mã QR bên dưới để check-in tại cổng.',
      qrBg: '#eff6ff', qrBorder: '#93c5fd', qrText: 'Quét mã QR này tại cổng sự kiện', qrTextColor: '#1e40af',
      infoRows: [infoRow('Họ tên', '{{student_name}}'), infoRow('MSSV', '{{mssv}}'), infoRow('Chức vụ', '{{position}}'), infoRow('Trường', '{{school}}')].join(''),
    }),
  },
  qr_fulbright: {
    subject: 'QR Check-in: {{event_name}} - Fulbright University',
    body: buildTemplate({
      gradient: '#7c3aed 0%, #6d28d9 100%',
      greeting: 'Bạn đã đăng ký tham gia sự kiện với tư cách thành viên <strong>Đại học Fulbright Việt Nam</strong>. Vui lòng mang theo mã QR bên dưới để check-in tại cổng.',
      qrBg: '#f5f3ff', qrBorder: '#c4b5fd', qrText: 'Quét mã QR này tại cổng sự kiện', qrTextColor: '#5b21b6',
      infoRows: [infoRow('Họ tên', '{{student_name}}'), infoRow('Email', '{{email}}'), infoRow('Quan hệ', '{{relationship}}'), infoRow('Trường', '{{school}}')].join(''),
    }),
  },
  qr_guest: {
    subject: 'QR Check-in: {{event_name}} - Thư mời',
    body: buildTemplate({
      gradient: '#ea580c 0%, #dc2626 100%',
      greeting: 'Ban Tổ chức trân trọng kính mời <strong>{{student_name}}</strong> tham dự sự kiện. Vui lòng mang theo mã QR bên dưới để check-in nhanh chóng tại cổng.',
      qrBg: '#fff7ed', qrBorder: '#fdba74', qrText: 'Quét mã QR này tại cổng sự kiện', qrTextColor: '#9a3412',
      infoRows: [infoRow('Họ tên', '{{student_name}}'), infoRow('Chức vụ', '{{position}}'), infoRow('Cơ quan', '{{organization}}'), infoRow('Email', '{{email}}')].join(''),
    }),
  },

  // Remind templates
  remind_vanhoa: {
    subject: '[Nhắc nhở] {{event_name}} - ĐH Văn hóa TPHCM',
    body: buildTemplate({
      gradient: '#f59e0b 0%, #2563eb 100%', badge: 'Nhắc nhở',
      greeting: 'Đây là email nhắc nhở về sự kiện sắp diễn ra. Vui lòng nhớ mang theo mã QR để check-in nhanh chóng tại cổng.',
      qrBg: '#fffbeb', qrBorder: '#fbbf24', qrText: 'Đừng quên mang QR code này nhé!', qrTextColor: '#92400e',
      infoRows: [infoRow('Họ tên', '{{student_name}}'), infoRow('MSSV', '{{mssv}}'), infoRow('Trường', '{{school}}')].join(''),
    }),
  },
  remind_fulbright: {
    subject: '[Nhắc nhở] {{event_name}} - Fulbright University',
    body: buildTemplate({
      gradient: '#f59e0b 0%, #7c3aed 100%', badge: 'Nhắc nhở',
      greeting: 'Đây là email nhắc nhở về sự kiện sắp diễn ra. Vui lòng nhớ mang theo mã QR để check-in nhanh chóng tại cổng.',
      qrBg: '#fffbeb', qrBorder: '#fbbf24', qrText: 'Đừng quên mang QR code này nhé!', qrTextColor: '#92400e',
      infoRows: [infoRow('Họ tên', '{{student_name}}'), infoRow('Email', '{{email}}'), infoRow('Trường', '{{school}}')].join(''),
    }),
  },
  remind_guest: {
    subject: '[Nhắc nhở] {{event_name}} - Thư nhắc',
    body: buildTemplate({
      gradient: '#f59e0b 0%, #ef4444 100%', badge: 'Nhắc nhở',
      greeting: 'Ban Tổ chức trân trọng nhắc nhở <strong>{{student_name}}</strong> về sự kiện sắp diễn ra. Vui lòng mang theo mã QR để check-in.',
      qrBg: '#fffbeb', qrBorder: '#fbbf24', qrText: 'Đừng quên mang QR code này nhé!', qrTextColor: '#92400e',
      infoRows: [infoRow('Họ tên', '{{student_name}}'), infoRow('Chức vụ', '{{position}}'), infoRow('Cơ quan', '{{organization}}')].join(''),
    }),
  },
};

// Aliases
const DEFAULT_QR_TEMPLATE = TEMPLATES.qr_guest;
const DEFAULT_REMIND_TEMPLATE = TEMPLATES.remind_guest;
TEMPLATES.qr = DEFAULT_QR_TEMPLATE;
TEMPLATES.remind = DEFAULT_REMIND_TEMPLATE;

/**
 * Replace template variables with actual values
 */
function renderTemplate(template, data) {
  let subject = template.subject;
  let body = template.body;

  const vars = {
    '{{student_name}}': data.studentName || '',
    '{{student_code}}': data.studentCode || '',
    '{{email}}': data.email || '',
    '{{school}}': data.school || '',
    '{{phone}}': data.phone || '',
    '{{mssv}}': data.mssv || '',
    '{{position}}': data.position || '',
    '{{organization}}': data.organization || '',
    '{{relationship}}': data.relationship || '',
    '{{program}}': data.program || '',
    '{{event_name}}': data.eventName || '',
    '{{event_date}}': data.eventDate || '',
    '{{event_location}}': data.eventLocation || '',
  };

  for (const [key, value] of Object.entries(vars)) {
    subject = subject.replaceAll(key, value);
    body = body.replaceAll(key, value);
  }

  return { subject, body };
}

async function sendQREmail(student, eventName, qrBuffer, isRemind = false) {
  const smtp = getSmtpConfig();

  if (!smtp.user || !smtp.pass) {
    throw new Error('Chưa cấu hình SMTP. Vào Cài đặt → Email để cấu hình.');
  }

  // Get event info + category-specific template
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(student.event_id);
  const category = student.category || 'guest';
  const templateType = isRemind ? `remind_${category}` : `qr_${category}`;
  const template = getTemplate(student.event_id, templateType);

  const { subject, body } = renderTemplate(template, {
    studentName: student.name,
    studentCode: student.student_code,
    email: student.email,
    phone: student.phone || '',
    school: student.school || 'N/A',
    mssv: student.mssv || student.student_code || '',
    position: student.position || '',
    organization: student.organization || '',
    relationship: student.relationship || '',
    program: student.program || '',
    eventName: eventName,
    eventDate: event?.event_date || '',
    eventLocation: event?.location || '',
  });

  const transport = createTransporter();

  await transport.sendMail({
    from: `"${smtp.fromName}" <${smtp.user}>`,
    to: student.email,
    subject,
    html: body,
    attachments: [
      { filename: 'qrcode.png', content: qrBuffer, cid: 'qrcode' },
      { filename: `QR_${student.student_code}.png`, content: qrBuffer },
    ],
  });
}

function markEmailSent(studentId) {
  db.prepare("UPDATE students SET email_sent_at = datetime('now', '+7 hours') WHERE id = ?").run(studentId);
}

module.exports = {
  sendQREmail,
  markEmailSent,
  getTemplate,
  renderTemplate,
  DEFAULT_QR_TEMPLATE,
  DEFAULT_REMIND_TEMPLATE,
};
