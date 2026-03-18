import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

export default function RegisterPage() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ student_code: '', name: '', email: '', school: '' });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    try {
      const res = await axios.get(`/api/register/${eventId}`);
      setEvent(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Không tìm thấy sự kiện');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setResult(null);

    try {
      const res = await axios.post(`/api/register/${eventId}`, form);
      setResult(res.data);
      setForm({ student_code: '', name: '', email: '', school: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Đăng ký thất bại');
    }
    setSubmitting(false);
  };

  // Error / closed state
  if (error && !event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">&#128683;</div>
          <h1 className="text-xl font-bold text-gray-700">{error}</h1>
        </div>
      </div>
    );
  }

  // Loading
  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-gray-500">Đang tải...</div>
      </div>
    );
  }

  // Success state
  if (result?.success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">&#10004;</div>
          <h1 className="text-2xl font-bold text-green-600 mb-2">Đăng ký thành công!</h1>
          <div className="bg-gray-50 rounded-xl p-4 mb-4 text-left">
            <p><span className="text-gray-500">Họ tên:</span> <b>{result.student.name}</b></p>
            <p><span className="text-gray-500">Mã SV:</span> <b>{result.student.student_code}</b></p>
            <p><span className="text-gray-500">Email:</span> <b>{result.student.email}</b></p>
            {result.student.school && <p><span className="text-gray-500">Trường:</span> <b>{result.student.school}</b></p>}
          </div>

          {result.emailSent ? (
            <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm mb-4">
              Mã QR đã được gửi đến <b>{result.student.email}</b>. Vui lòng kiểm tra hộp thư!
            </div>
          ) : (
            <div className="bg-yellow-50 text-yellow-700 p-3 rounded-lg text-sm mb-4">
              Đăng ký thành công nhưng chưa gửi được email. Vui lòng liên hệ BTC để nhận mã QR.
              {result.emailError && <p className="text-xs mt-1">({result.emailError})</p>}
            </div>
          )}

          <button
            onClick={() => setResult(null)}
            className="text-blue-600 hover:underline text-sm"
          >
            Đăng ký người khác
          </button>
        </div>
      </div>
    );
  }

  // Registration form
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        {/* Event header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">&#127915;</div>
          <h1 className="text-2xl font-bold text-gray-800">{event.name}</h1>
          {event.description && <p className="text-gray-500 mt-1">{event.description}</p>}
          <div className="flex justify-center gap-4 mt-3 text-sm text-gray-500">
            {event.event_date && <span>&#128197; {event.event_date}</span>}
            {event.location && <span>&#128205; {event.location}</span>}
          </div>
          <p className="text-sm text-blue-600 mt-2">
            Đã có <b>{event.studentCount}</b> người đăng ký
          </p>
        </div>

        <hr className="mb-6" />

        <h2 className="text-lg font-semibold mb-4">Đăng ký tham gia</h2>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mã sinh viên <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.student_code}
              onChange={e => setForm({ ...form, student_code: e.target.value })}
              placeholder="VD: SV2021001"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Họ và tên <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="VD: Nguyễn Văn An"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="VD: an.nv@gmail.com"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <p className="text-xs text-gray-400 mt-1">Mã QR sẽ được gửi về email này</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trường / Đơn vị
            </label>
            <input
              type="text"
              value={form.school}
              onChange={e => setForm({ ...form, school: e.target.value })}
              placeholder="VD: ĐH Sư phạm Kỹ thuật"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium text-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Đang xử lý...' : 'Đăng ký'}
          </button>
        </form>
      </div>
    </div>
  );
}
