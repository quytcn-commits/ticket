import { useState, useEffect } from 'react';
import api from '../api/client';

const PRESETS = [
  { key: 'gmail', label: 'Gmail', host: 'smtp.gmail.com', port: '587', hint: 'Cần App Password (không phải mật khẩu Gmail)' },
  { key: 'outlook', label: 'Outlook / Hotmail', host: 'smtp-mail.outlook.com', port: '587', hint: 'Dùng mật khẩu email Outlook' },
  { key: 'yahoo', label: 'Yahoo', host: 'smtp.mail.yahoo.com', port: '587', hint: 'Cần App Password' },
  { key: 'custom', label: 'Tự cấu hình', host: '', port: '587', hint: 'Nhập thông tin SMTP server' },
];

export default function SettingsPage() {
  const [preset, setPreset] = useState('gmail');
  const [form, setForm] = useState({
    smtp_host: 'smtp.gmail.com',
    smtp_port: '587',
    smtp_user: '',
    smtp_pass: '',
    smtp_from_name: 'Event Check-in',
  });
  const [testEmail, setTestEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState(null);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await api.get('/settings/smtp');
      const data = res.data;
      setConfigured(data.configured);
      if (data.configured) {
        setForm({
          smtp_host: data.smtp_host || '',
          smtp_port: data.smtp_port || '587',
          smtp_user: data.smtp_user || '',
          smtp_pass: data.smtp_pass || '',
          smtp_from_name: data.smtp_from_name || 'Event Check-in',
        });
        // Detect preset
        const found = PRESETS.find(p => p.host === data.smtp_host);
        setPreset(found ? found.key : 'custom');
      }
    } catch {}
  };

  const handlePresetChange = (key) => {
    setPreset(key);
    const p = PRESETS.find(pr => pr.key === key);
    if (p && p.host) {
      setForm(f => ({ ...f, smtp_host: p.host, smtp_port: p.port }));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await api.post('/settings/smtp', { ...form, preset });
      setMessage({ type: 'success', text: res.data.message });
      setConfigured(true);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Lỗi lưu cấu hình' });
    }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!testEmail) {
      setMessage({ type: 'error', text: 'Vui lòng nhập email nhận thử' });
      return;
    }
    setTesting(true);
    setMessage(null);
    try {
      const res = await api.post('/settings/smtp/test', { test_email: testEmail });
      setMessage({ type: 'success', text: res.data.message });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Gửi test thất bại' });
    }
    setTesting(false);
  };

  const currentPreset = PRESETS.find(p => p.key === preset);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Cài đặt Email (SMTP)</h1>

      {/* Status */}
      <div className={`p-4 rounded-lg mb-6 ${configured ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
        <span className={configured ? 'text-green-700' : 'text-yellow-700'}>
          {configured ? 'Email đã được cấu hình' : 'Chưa cấu hình email — cần thiết lập để gửi QR cho sinh viên'}
        </span>
      </div>

      {/* Preset selector */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Chọn dịch vụ email</h2>
        <div className="grid grid-cols-4 gap-3">
          {PRESETS.map(p => (
            <button
              key={p.key}
              type="button"
              onClick={() => handlePresetChange(p.key)}
              className={`p-3 rounded-lg border-2 text-center transition-all ${
                preset === p.key
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium">{p.label}</div>
            </button>
          ))}
        </div>
        {currentPreset?.hint && (
          <p className="mt-3 text-sm text-amber-600 bg-amber-50 p-3 rounded">
            {currentPreset.hint}
          </p>
        )}
      </div>

      {/* SMTP Form */}
      <form onSubmit={handleSave} className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Thông tin SMTP</h2>

        {message && (
          <div className={`p-3 rounded mb-4 text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
            <input
              type="text"
              value={form.smtp_host}
              onChange={e => setForm({ ...form, smtp_host: e.target.value })}
              placeholder="smtp.gmail.com"
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={preset !== 'custom'}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
            <input
              type="text"
              value={form.smtp_port}
              onChange={e => setForm({ ...form, smtp_port: e.target.value })}
              placeholder="587"
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={preset !== 'custom'}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email đăng nhập</label>
            <input
              type="email"
              value={form.smtp_user}
              onChange={e => setForm({ ...form, smtp_user: e.target.value })}
              placeholder="your-email@gmail.com"
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {preset === 'gmail' ? 'App Password' : 'Mật khẩu'}
            </label>
            <input
              type="password"
              value={form.smtp_pass}
              onChange={e => setForm({ ...form, smtp_pass: e.target.value })}
              placeholder={preset === 'gmail' ? 'xxxx xxxx xxxx xxxx' : 'Mật khẩu email'}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên hiển thị người gửi</label>
            <input
              type="text"
              value={form.smtp_from_name}
              onChange={e => setForm({ ...form, smtp_from_name: e.target.value })}
              placeholder="Event Check-in"
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
        </button>

        {preset === 'gmail' && (
          <div className="mt-4 text-sm text-gray-500 bg-gray-50 p-4 rounded-lg">
            <p className="font-medium text-gray-700 mb-2">Hướng dẫn lấy App Password Gmail:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Vào <b>myaccount.google.com/security</b></li>
              <li>Bật <b>Xác minh 2 bước</b> (bắt buộc)</li>
              <li>Vào <b>myaccount.google.com/apppasswords</b></li>
              <li>Tạo App Password → chọn tên: "QR Checkin"</li>
              <li>Copy mật khẩu 16 ký tự → dán vào ô "App Password" ở trên</li>
            </ol>
          </div>
        )}
      </form>

      {/* Test email */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Gửi email thử</h2>
        <div className="flex gap-3">
          <input
            type="email"
            value={testEmail}
            onChange={e => setTestEmail(e.target.value)}
            placeholder="Nhập email của bạn để test"
            className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleTest}
            disabled={testing}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {testing ? 'Đang gửi...' : 'Gửi thử'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Gửi 1 email test để kiểm tra cấu hình hoạt động đúng chưa
        </p>
      </div>
    </div>
  );
}
