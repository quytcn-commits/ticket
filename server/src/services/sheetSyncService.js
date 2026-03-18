const https = require('https');
const http = require('http');
const db = require('../db/connection');
const { generateToken, generateQRBuffer } = require('./qrService');
const { sendQREmail } = require('./emailService');

let syncInterval = null;

/**
 * Fetch CSV from a URL, following redirects
 */
function fetchCSV(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'QR-Checkin-Server' } }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchCSV(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Parse CSV string into array of rows
 */
function parseCSV(csv) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  const lines = [];

  // Split into lines respecting quoted fields
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === '\n' && !inQuotes) {
      lines.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) lines.push(current.trim());

  // Parse each line into fields
  for (const line of lines) {
    if (!line) continue;
    const fields = [];
    let field = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (c === ',' && !inQ) {
        fields.push(field);
        field = '';
      } else {
        field += c;
      }
    }
    fields.push(field);
    rows.push(fields);
  }

  return rows;
}

/**
 * Extract student info from a row based on "đơn vị" (column B)
 * Returns full data for all 3 branches
 */
function extractStudent(row) {
  const donVi = (row[1] || '').trim();
  const result = {
    name: '', email: '', phone: '', school: '',
    category: 'guest', student_code: '',
    position: '', organization: '', mssv: '',
    program: '', image_consent: 0, relationship: '',
  };

  if (donVi.includes('Fulbright')) {
    result.category = 'fulbright';
    result.name = row[2] || '';
    result.email = row[3] || '';
    result.phone = row[4] || '';
    result.relationship = row[5] || '';   // Quan hệ với Fulbright
    result.program = row[6] || '';        // Phần tham dự
    result.image_consent = (row[7] || '').includes('Có') ? 1 : 0;
    result.school = 'ĐH Fulbright Việt Nam';
    result.student_code = result.email ? result.email.split('@')[0] : '';
  } else if (donVi.includes('Văn hóa')) {
    result.category = 'vanhoa';
    result.name = row[8] || '';
    result.email = row[9] || '';
    result.phone = row[10] || '';
    result.position = row[11] || '';      // Chức vụ tại ĐH Văn hóa
    result.mssv = row[12] || '';          // MSSV
    result.program = row[13] || '';
    result.image_consent = (row[14] || '').includes('Có') ? 1 : 0;
    result.school = 'ĐH Văn hóa TPHCM';
    result.student_code = result.mssv && result.mssv !== 'Không có'
      ? result.mssv
      : (result.email ? result.email.split('@')[0] : '');
  } else {
    result.category = 'guest';
    result.name = row[15] || '';
    result.email = row[16] || '';
    result.phone = row[17] || '';
    result.program = row[18] || '';
    result.image_consent = (row[19] || '').includes('Có') ? 1 : 0;
    result.position = row[20] || '';      // Chức vụ
    result.organization = row[21] || '';  // Cơ quan
    result.school = result.organization || result.position || 'Khách mời';
    result.student_code = result.email ? result.email.split('@')[0] : '';
  }

  // Fallback email
  if (!result.email && row[22]) result.email = row[22];

  // Trim all
  for (const key of Object.keys(result)) {
    if (typeof result[key] === 'string') result[key] = result[key].trim();
  }

  if (!result.name || !result.email || !result.student_code) return null;
  return result;
}

/**
 * Sync one event's Google Sheet
 */
async function syncSheet(eventId) {
  const sheetUrl = db.prepare("SELECT value FROM settings WHERE key = ?")
    .get(`event_${eventId}_sheet_url`);

  if (!sheetUrl || !sheetUrl.value) return { synced: 0, skipped: 0, errors: [] };

  // Convert to CSV export URL
  let csvUrl = sheetUrl.value;
  // Handle various Google Sheets URL formats
  const match = csvUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    csvUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=0`;
  }

  console.log(`[SheetSync] Fetching: ${csvUrl}`);

  const csv = await fetchCSV(csvUrl);
  const rows = parseCSV(csv);

  if (rows.length < 2) return { synced: 0, skipped: 0, errors: [] };

  // Skip header row
  const dataRows = rows.slice(1);
  let synced = 0, skipped = 0;
  const errors = [];

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  if (!event) return { synced: 0, skipped: 0, errors: ['Event not found'] };

  for (const row of dataRows) {
    try {
      const student = extractStudent(row);
      if (!student) { skipped++; continue; }

      // Check if already exists (by email to avoid duplicates)
      const existing = db.prepare(
        'SELECT id, category FROM students WHERE event_id = ? AND (student_code = ? OR email = ?)'
      ).get(eventId, student.student_code, student.email);

      if (existing) {
        // Update category + metadata if changed
        db.prepare(`
          UPDATE students SET category = ?, phone = ?, position = ?, organization = ?,
            mssv = ?, program = ?, image_consent = ?, relationship = ?, school = ?
          WHERE id = ?
        `).run(
          student.category, student.phone, student.position, student.organization,
          student.mssv, student.program, student.image_consent, student.relationship,
          student.school, existing.id
        );
        skipped++;
        continue;
      }

      // Insert student with full data
      const result = db.prepare(`
        INSERT INTO students (event_id, student_code, name, email, phone, school, category, position, organization, mssv, program, image_consent, relationship, qr_token)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        eventId, student.student_code, student.name, student.email, student.phone,
        student.school, student.category, student.position, student.organization,
        student.mssv, student.program, student.image_consent, student.relationship, 'temp'
      );

      const studentId = result.lastInsertRowid;
      const token = generateToken(eventId, studentId, student.student_code);
      db.prepare('UPDATE students SET qr_token = ? WHERE id = ?').run(token, studentId);

      // Check if auto-email is enabled
      const autoEmail = db.prepare("SELECT value FROM settings WHERE key = ?")
        .get(`event_${eventId}_auto_email`);
      const shouldSendEmail = autoEmail ? autoEmail.value === '1' : true;

      // Send QR email
      if (shouldSendEmail) {
        try {
          const studentRow = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
          const qrBuffer = await generateQRBuffer(token);
          await sendQREmail(studentRow, event.name, qrBuffer);
          db.prepare("UPDATE students SET email_sent_at = datetime('now', '+7 hours') WHERE id = ?").run(studentId);
          console.log(`[SheetSync] ✓ ${student.name} (${student.email}) → QR sent`);
        } catch (emailErr) {
          console.log(`[SheetSync] ✓ ${student.name} registered, email failed: ${emailErr.message}`);
        }
      } else {
        console.log(`[SheetSync] ✓ ${student.name} registered (auto-email OFF)`);
      }

      synced++;
    } catch (err) {
      errors.push(err.message);
    }
  }

  console.log(`[SheetSync] Event ${eventId}: synced=${synced}, skipped=${skipped}, errors=${errors.length}`);
  return { synced, skipped, errors };
}

/**
 * Start auto-sync polling
 */
function startAutoSync(intervalMinutes = 2) {
  if (syncInterval) clearInterval(syncInterval);

  const run = async () => {
    // Find all events with sheet URLs configured
    const settings = db.prepare(
      "SELECT key, value FROM settings WHERE key LIKE 'event_%_sheet_url' AND value != ''"
    ).all();

    for (const s of settings) {
      const eventId = s.key.match(/event_(\d+)_sheet_url/)?.[1];
      if (eventId) {
        try {
          await syncSheet(parseInt(eventId));
        } catch (err) {
          console.error(`[SheetSync] Error syncing event ${eventId}:`, err.message);
        }
      }
    }
  };

  // Run immediately on start
  run();

  // Then poll every X minutes
  syncInterval = setInterval(run, intervalMinutes * 60 * 1000);
  console.log(`[SheetSync] Auto-sync started (every ${intervalMinutes} min)`);
}

function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('[SheetSync] Auto-sync stopped');
  }
}

module.exports = { syncSheet, startAutoSync, stopAutoSync };
