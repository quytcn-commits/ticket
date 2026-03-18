const XLSX = require('xlsx');

function parseStudentExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const students = [];
  const errors = [];

  rows.forEach((row, index) => {
    // Flexible column name matching
    const studentCode = row['student_code'] || row['MSSV'] || row['mssv'] || row['StudentCode'] || row['Ma_SV'] || '';
    const name = row['name'] || row['Name'] || row['Họ tên'] || row['ho_ten'] || row['FullName'] || '';
    const email = row['email'] || row['Email'] || row['EMAIL'] || '';
    const school = row['school'] || row['School'] || row['Trường'] || row['truong'] || '';

    if (!studentCode || !name) {
      errors.push(`Row ${index + 2}: missing student_code or name`);
      return;
    }

    students.push({
      student_code: String(studentCode).trim(),
      name: String(name).trim(),
      email: String(email).trim(),
      school: String(school).trim(),
    });
  });

  return { students, errors };
}

function generateReport(students, eventName) {
  const data = students.map((s) => ({
    'Mã SV': s.student_code,
    'Họ tên': s.name,
    'Email': s.email || '',
    'Trường': s.school || '',
    'Check-in': s.checked_at ? 'Có' : 'Không',
    'Thời gian check-in': s.checked_at || '',
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 15 }, { wch: 25 }, { wch: 30 }, { wch: 25 }, { wch: 10 }, { wch: 20 },
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, eventName || 'Report');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { parseStudentExcel, generateReport };
