import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api/client';

export default function DashboardPage() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get(`/events/${id}`).then((res) => setEvent(res.data));
    loadStats();

    // SSE for realtime updates
    const token = localStorage.getItem('token');
    const eventSource = new EventSource(`/api/reports/${id}/stats/realtime?token=${token}`);
    eventSource.onmessage = (e) => {
      try {
        setStats(JSON.parse(e.data));
      } catch {}
    };

    return () => eventSource.close();
  }, [id]);

  const loadStats = async () => {
    const res = await api.get(`/reports/${id}/stats`);
    setStats(res.data);
  };

  if (!stats || !event) return <div className="text-center py-10">Đang tải...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to={`/events/${id}`} className="text-blue-600 hover:underline text-sm">&larr; Quay lại</Link>
          <h1 className="text-2xl font-bold mt-1">Dashboard: {event.name}</h1>
        </div>
        <Link
          to={`/scan/${id}`}
          target="_blank"
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm"
        >
          Mở Scanner
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-6 text-center">
          <div className="text-4xl font-bold text-blue-600">{stats.totalRegistered}</div>
          <div className="text-gray-500 mt-2">Tổng đăng ký</div>
        </div>
        <div className="bg-white rounded-xl shadow p-6 text-center">
          <div className="text-4xl font-bold text-green-600">{stats.checkedIn}</div>
          <div className="text-gray-500 mt-2">Đã check-in</div>
        </div>
        <div className="bg-white rounded-xl shadow p-6 text-center">
          <div className="text-4xl font-bold text-purple-600">{stats.percentage}%</div>
          <div className="text-gray-500 mt-2">Tỉ lệ tham gia</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* By School */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Theo trường</h2>
          {stats.bySchool.length === 0 ? (
            <p className="text-gray-400">Chưa có dữ liệu</p>
          ) : (
            <div className="space-y-3">
              {stats.bySchool.map((s) => (
                <div key={s.school || 'unknown'}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{s.school || 'Không rõ'}</span>
                    <span className="font-medium">{s.checked_in}/{s.registered}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all"
                      style={{ width: `${s.registered > 0 ? (s.checked_in / s.registered) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By Hour Chart */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Check-in theo giờ</h2>
          {stats.byHour.length === 0 ? (
            <p className="text-gray-400">Chưa có dữ liệu</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.byHour}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* By Staff */}
      {stats.byStaff && stats.byStaff.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Theo nhân viên check-in</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.byStaff.map((s) => (
              <div key={s.staff_name} className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-indigo-600">{s.count}</div>
                <div className="text-sm text-gray-500 mt-1">{s.staff_name}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
