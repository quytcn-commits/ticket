import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', location: '', event_date: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    const res = await api.get('/events');
    setEvents(res.data);
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    await api.post('/events', form);
    setForm({ name: '', description: '', location: '', event_date: '' });
    setShowForm(false);
    loadEvents();
  };

  const handleDelete = async (id) => {
    if (!confirm('Xóa sự kiện này?')) return;
    await api.delete(`/events/${id}`);
    loadEvents();
  };

  if (loading) return <div className="text-center py-10">Đang tải...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Danh sách sự kiện</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + Tạo sự kiện
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-lg shadow mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Tên sự kiện *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ngày *</label>
            <input
              type="date"
              value={form.event_date}
              onChange={(e) => setForm({ ...form, event_date: e.target.value })}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Địa điểm</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Mô tả</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="col-span-2">
            <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">
              Tạo
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="ml-3 text-gray-500">
              Hủy
            </button>
          </div>
        </form>
      )}

      {events.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          Chưa có sự kiện nào. Hãy tạo sự kiện đầu tiên!
        </div>
      ) : (
        <div className="grid gap-4">
          {events.map((event) => (
            <div key={event.id} className="bg-white rounded-lg shadow p-5 flex items-center justify-between">
              <Link to={`/events/${event.id}`} className="flex-1">
                <h2 className="text-lg font-semibold text-blue-600 hover:underline">{event.name}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {event.event_date} {event.location && `• ${event.location}`}
                </p>
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="text-gray-600">Đăng ký: <b>{event.student_count}</b></span>
                  <span className="text-green-600">Check-in: <b>{event.checkin_count}</b></span>
                  <span className="text-blue-600">
                    Tỉ lệ: <b>{event.student_count > 0 ? Math.round((event.checkin_count / event.student_count) * 100) : 0}%</b>
                  </span>
                </div>
              </Link>
              <button onClick={() => handleDelete(event.id)} className="text-red-400 hover:text-red-600 ml-4">
                Xóa
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
