import { useState, useEffect } from 'react';
import api from '../api/client';

export default function StaffsPage() {
  const [staffs, setStaffs] = useState([]);
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', name: '', pin: '' });
  const [error, setError] = useState('');
  const [assignForm, setAssignForm] = useState({ staffId: null, eventId: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [sRes, eRes] = await Promise.all([
      api.get('/staffs'),
      api.get('/events'),
    ]);
    setStaffs(sRes.data);
    setEvents(eRes.data);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/staffs', form);
      setForm({ username: '', name: '', pin: '' });
      setShowForm(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi tạo staff');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Xóa nhân viên này?')) return;
    await api.delete(`/staffs/${id}`);
    loadData();
  };

  const handleToggleActive = async (staff) => {
    await api.put(`/staffs/${staff.id}`, { active: staff.active ? 0 : 1 });
    loadData();
  };

  const handleAssign = async (staffId) => {
    if (!assignForm.eventId) return;
    await api.post(`/staffs/${staffId}/events`, { event_id: assignForm.eventId });
    setAssignForm({ staffId: null, eventId: '' });
    loadData();
  };

  const handleUnassign = async (staffId, eventId) => {
    await api.delete(`/staffs/${staffId}/events/${eventId}`);
    loadData();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Quản lý nhân viên check-in</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + Thêm nhân viên
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-lg shadow mb-6">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Username *</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="vd: staff01"
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Họ tên *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="vd: Nguyễn Văn A"
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">PIN (4-6 số) *</label>
              <input
                type="text"
                value={form.pin}
                onChange={(e) => setForm({ ...form, pin: e.target.value })}
                placeholder="vd: 1234"
                maxLength={6}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
          </div>
          <div className="mt-4">
            <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">Tạo</button>
            <button type="button" onClick={() => setShowForm(false)} className="ml-3 text-gray-500">Hủy</button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Staff đăng nhập bằng Username + PIN trên trang Scanner
          </p>
        </form>
      )}

      {staffs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          Chưa có nhân viên nào. Hãy thêm nhân viên check-in!
        </div>
      ) : (
        <div className="space-y-4">
          {staffs.map((s) => (
            <div key={s.id} className="bg-white rounded-lg shadow p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold">{s.name}</h2>
                    <span className="text-sm text-gray-400">@{s.username}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${s.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {s.active ? 'Hoạt động' : 'Vô hiệu'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Đã check-in: <b>{s.total_checkins}</b> lượt
                    {s.assigned_events && <> • Sự kiện: {s.assigned_events}</>}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleToggleActive(s)} className="text-sm text-blue-500 hover:underline">
                    {s.active ? 'Vô hiệu hóa' : 'Kích hoạt'}
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="text-sm text-red-400 hover:text-red-600">
                    Xóa
                  </button>
                </div>
              </div>

              {/* Assign to event */}
              <div className="mt-3 flex items-center gap-2">
                <select
                  value={assignForm.staffId === s.id ? assignForm.eventId : ''}
                  onChange={(e) => setAssignForm({ staffId: s.id, eventId: e.target.value })}
                  className="border rounded px-3 py-1.5 text-sm flex-1 max-w-xs"
                >
                  <option value="">-- Phân công sự kiện --</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.name}</option>
                  ))}
                </select>
                {assignForm.staffId === s.id && assignForm.eventId && (
                  <button
                    onClick={() => handleAssign(s.id)}
                    className="bg-blue-500 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-600"
                  >
                    Phân công
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
