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
 */
function getTemplate(eventId, type) {
  const key = `event_${eventId}_email_${type}`;
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (row?.value) {
    try { return JSON.parse(row.value); } catch {}
  }
  return type === 'remind' ? DEFAULT_REMIND_TEMPLATE : DEFAULT_QR_TEMPLATE;
}

const DEFAULT_QR_TEMPLATE = {
  subject: 'QR Check-in: {{event_name}}',
  body: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 40px; border-radius: 12px 12px 0 0;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">{{event_name}}</h1>
    <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">{{event_date}} {{event_location}}</p>
  </div>

  <!-- Body -->
  <div style="padding: 30px 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; color: #374151;">Xin chào <strong>{{student_name}}</strong>,</p>
    <p style="color: #6b7280; line-height: 1.6;">Bạn đã đăng ký tham gia sự kiện thành công. Vui lòng mang theo mã QR bên dưới để check-in tại cổng sự kiện.</p>

    <!-- QR Code -->
    <div style="text-align: center; margin: 25px 0; padding: 20px; background: #f9fafb; border-radius: 12px; border: 2px dashed #d1d5db;">
      <img src="cid:qrcode" alt="QR Code" style="width: 250px; height: 250px;" />
      <p style="color: #9ca3af; font-size: 12px; margin: 10px 0 0;">Quét mã QR này tại cổng sự kiện</p>
    </div>

    <!-- Info -->
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 8px 0; color: #9ca3af; font-size: 13px; width: 120px;">Họ tên:</td>
        <td style="padding: 8px 0; color: #374151; font-weight: 600;">{{student_name}}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #9ca3af; font-size: 13px;">Mã sinh viên:</td>
        <td style="padding: 8px 0; color: #374151; font-weight: 600;">{{student_code}}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #9ca3af; font-size: 13px;">Trường / Đơn vị:</td>
        <td style="padding: 8px 0; color: #374151; font-weight: 600;">{{school}}</td>
      </tr>
    </table>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">Vui lòng không chia sẻ mã QR này cho người khác.<br/>Email này được gửi tự động từ hệ thống QR Check-in.</p>
  </div>
</div>`,
};

const DEFAULT_REMIND_TEMPLATE = {
  subject: '[Nhắc nhở] QR Check-in: {{event_name}}',
  body: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); padding: 30px 40px; border-radius: 12px 12px 0 0;">
    <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Nhắc nhở</p>
    <h1 style="color: #ffffff; margin: 8px 0 0; font-size: 24px;">{{event_name}}</h1>
    <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">{{event_date}} {{event_location}}</p>
  </div>

  <!-- Body -->
  <div style="padding: 30px 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; color: #374151;">Xin chào <strong>{{student_name}}</strong>,</p>
    <p style="color: #6b7280; line-height: 1.6;">Đây là email nhắc nhở về sự kiện sắp diễn ra. Vui lòng nhớ mang theo mã QR bên dưới để check-in nhanh chóng tại cổng.</p>

    <!-- QR Code -->
    <div style="text-align: center; margin: 25px 0; padding: 20px; background: #fffbeb; border-radius: 12px; border: 2px dashed #fbbf24;">
      <img src="cid:qrcode" alt="QR Code" style="width: 250px; height: 250px;" />
      <p style="color: #92400e; font-size: 13px; margin: 10px 0 0; font-weight: 600;">Đừng quên mang QR code này nhé!</p>
    </div>

    <!-- Info -->
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 8px 0; color: #9ca3af; font-size: 13px; width: 120px;">Họ tên:</td>
        <td style="padding: 8px 0; color: #374151; font-weight: 600;">{{student_name}}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #9ca3af; font-size: 13px;">Mã sinh viên:</td>
        <td style="padding: 8px 0; color: #374151; font-weight: 600;">{{student_code}}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #9ca3af; font-size: 13px;">Trường / Đơn vị:</td>
        <td style="padding: 8px 0; color: #374151; font-weight: 600;">{{school}}</td>
      </tr>
    </table>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">Vui lòng không chia sẻ mã QR này cho người khác.<br/>Email này được gửi tự động từ hệ thống QR Check-in.</p>
  </div>
</div>`,
};

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

  // Get event info for template
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(student.event_id);
  const template = getTemplate(student.event_id, isRemind ? 'remind' : 'qr');

  const { subject, body } = renderTemplate(template, {
    studentName: student.name,
    studentCode: student.student_code,
    email: student.email,
    school: student.school || 'N/A',
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
