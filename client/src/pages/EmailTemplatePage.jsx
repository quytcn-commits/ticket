import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';

export default function EmailTemplatePage() {
  const { id } = useParams();
  const [type, setType] = useState('qr');
  const [template, setTemplate] = useState({ subject: '', body: '' });
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [event, setEvent] = useState(null);

  useEffect(() => {
    api.get(`/events/${id}`).then(r => setEvent(r.data));
  }, [id]);

  useEffect(() => {
    loadTemplate();
  }, [id, type]);

  const loadTemplate = async () => {
    const res = await api.get(`/settings/email-template/${id}/${type}`);
    setTemplate(res.data);
    setPreview(null);
  };

  const handlePreview = async () => {
    const res = await api.post('/settings/email-template/preview', template);
    setPreview(res.data);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.post(`/settings/email-template/${id}/${type}`, template);
      setMessage({ type: 'success', text: 'Đã lưu template' });
    } catch {
      setMessage({ type: 'error', text: 'Lỗi lưu' });
    }
    setSaving(false);
  };

  const handleReset = async () => {
    if (!confirm('Khôi phục template mặc định?')) return;
    await api.delete(`/settings/email-template/${id}/${type}`);
    loadTemplate();
    setMessage({ type: 'success', text: 'Đã khôi phục mặc định' });
  };

  return (
    <div>
      <Link to={`/events/${id}`} className="text-blue-600 hover:underline text-sm">&larr; Quay lại sự kiện</Link>
      <h1 className="text-2xl font-bold mt-2 mb-6">
        Email Template {event ? `— ${event.name}` : ''}
      </h1>

      {/* Type selector */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setType('qr')}
          className={`px-5 py-2.5 rounded-lg font-medium ${type === 'qr' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          QR Code (lần đầu)
        </button>
        <button
          onClick={() => setType('remind')}
          className={`px-5 py-2.5 rounded-lg font-medium ${type === 'remind' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Nhắc nhở (Remind)
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Editor */}
        <div>
          {message && (
            <div className={`p-3 rounded mb-4 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {message.text}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề email</label>
            <input
              type="text"
              value={template.subject}
              onChange={e => setTemplate({ ...template, subject: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung HTML</label>
            <textarea
              value={template.body}
              onChange={e => setTemplate({ ...template, body: e.target.value })}
              rows={20}
              className="w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2">
            <button onClick={handlePreview} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700">
              Xem trước
            </button>
            <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? '...' : 'Lưu'}
            </button>
            <button onClick={handleReset} className="border text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
              Khôi phục mặc định
            </button>
          </div>

          {/* Variables reference */}
          <div className="mt-4 bg-gray-50 p-4 rounded-lg text-xs">
            <p className="font-medium text-gray-700 mb-2">Biến có thể dùng:</p>
            <div className="grid grid-cols-2 gap-1 text-gray-500">
              <span><code className="bg-gray-200 px-1 rounded">{'{{student_name}}'}</code> Họ tên</span>
              <span><code className="bg-gray-200 px-1 rounded">{'{{student_code}}'}</code> Mã SV</span>
              <span><code className="bg-gray-200 px-1 rounded">{'{{email}}'}</code> Email</span>
              <span><code className="bg-gray-200 px-1 rounded">{'{{school}}'}</code> Trường</span>
              <span><code className="bg-gray-200 px-1 rounded">{'{{event_name}}'}</code> Tên sự kiện</span>
              <span><code className="bg-gray-200 px-1 rounded">{'{{event_date}}'}</code> Ngày</span>
              <span><code className="bg-gray-200 px-1 rounded">{'{{event_location}}'}</code> Địa điểm</span>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div>
          <div className="bg-gray-100 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Preview {preview ? '(với dữ liệu mẫu)' : ''}
            </h3>

            {preview && (
              <div className="mb-3 bg-blue-50 p-3 rounded text-sm">
                <strong>Subject:</strong> {preview.subject}
              </div>
            )}

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <iframe
                srcDoc={preview?.body || template.body}
                className="w-full border-0"
                style={{ height: '600px' }}
                title="Email preview"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
