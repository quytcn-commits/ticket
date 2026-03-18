import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';

export default function EventDetailPage() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [students, setStudents] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ student_code: '', name: '', email: '', school: '' });
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    const [evRes, stRes] = await Promise.all([
      api.get(`/events/${id}`),
      api.get(`/events/${id}/students`),
    ]);
    setEvent(evRes.data);
    setStudents(stRes.data);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post(`/events/${id}/students/import`, formData);
      setImportResult(res.data);
      loadData();
    } catch (err) {
      setImportResult({ error: err.response?.data?.error || 'Import failed' });
    }
    setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    await api.post(`/events/${id}/students`, addForm);
    setAddForm({ student_code: '', name: '', email: '', school: '' });
    setShowAdd(false);
    loadData();
  };

  const handleDelete = async (studentId) => {
    if (!confirm('Xóa sinh viên này?')) return;
    await api.delete(`/events/${id}/students/${studentId}`);
    loadData();
  };

  const handleDownloadQR = (studentId, code) => {
    const token = localStorage.getItem('token');
    const link = document.createElement('a');
    link.href = `/api/qr/${studentId}/download`;
    // Use fetch with auth header then download
    fetch(`/api/qr/${studentId}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = `QR_${code}.png`;
        link.click();
        URL.revokeObjectURL(url);
      });
  };

  const handleExport = () => {
    const token = localStorage.getItem('token');
    fetch(`/api/reports/${id}/export`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `report_${event?.name || 'event'}.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
      });
  };

  if (!event) return <div className="text-center py-10">Đang tải...</div>;

  const checkedIn = students.filter((s) => s.checked_at).length;

  return (
    <div>
      {/* Event Header */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{event.name}</h1>
            <p className="text-gray-500 mt-1">
              {event.event_date} {event.location && `• ${event.location}`}
            </p>
            {event.description && <p className="text-gray-600 mt-2">{event.description}</p>}
          </div>
          <div className="flex gap-2">
            <Link
              to={`/events/${id}/dashboard`}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm"
            >
              Dashboard
            </Link>
            <Link
              to={`/scan/${id}`}
              target="_blank"
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm"
            >
              Mở Scanner
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{students.length}</div>
            <div className="text-sm text-gray-500">Đăng ký</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{checkedIn}</div>
            <div className="text-sm text-gray-500">Đã check-in</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-purple-600">
              {students.length > 0 ? Math.round((checkedIn / students.length) * 100) : 0}%
            </div>
            <div className="text-sm text-gray-500">Tỉ lệ</div>
          </div>
        </div>
      </div>

      {/* Google Sheet Sync */}
      <SheetSyncPanel eventId={id} />

      {/* Email Management */}
      <EmailPanel eventId={id} onRefresh={loadData} />

      {/* Actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        <label className={`bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 cursor-pointer text-sm ${importing ? 'opacity-50' : ''}`}>
          {importing ? 'Đang import...' : 'Import Excel'}
          <input type="file" accept=".xlsx,.xls" onChange={handleImport} ref={fileRef} className="hidden" disabled={importing} />
        </label>
        <button onClick={() => setShowAdd(!showAdd)} className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm">
          + Thêm SV
        </button>
        <button onClick={handleExport} className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm">
          Export báo cáo
        </button>
      </div>

      {/* Import Result */}
      {importResult && (
        <div className={`p-4 rounded-lg mb-4 ${importResult.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {importResult.error ? importResult.error : `Import thành công: ${importResult.imported} SV, bỏ qua: ${importResult.skipped}`}
          {importResult.errors?.length > 0 && (
            <ul className="mt-2 text-sm">{importResult.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          )}
        </div>
      )}

      {/* Add Student Form */}
      {showAdd && (
        <form onSubmit={handleAddStudent} className="bg-white p-4 rounded-lg shadow mb-4 grid grid-cols-4 gap-3">
          <input placeholder="Mã SV *" value={addForm.student_code} onChange={(e) => setAddForm({ ...addForm, student_code: e.target.value })} className="border rounded px-3 py-2" required />
          <input placeholder="Họ tên *" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} className="border rounded px-3 py-2" required />
          <input placeholder="Email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} className="border rounded px-3 py-2" />
          <input placeholder="Trường" value={addForm.school} onChange={(e) => setAddForm({ ...addForm, school: e.target.value })} className="border rounded px-3 py-2" />
          <div className="col-span-4">
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm">Thêm</button>
            <button type="button" onClick={() => setShowAdd(false)} className="ml-2 text-gray-500 text-sm">Hủy</button>
          </div>
        </form>
      )}

      {/* Student Table */}
      {students.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Mã SV</th>
                <th className="px-4 py-3 text-left">Họ tên</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Trường</th>
                <th className="px-4 py-3 text-left">Trạng thái</th>
                <th className="px-4 py-3 text-left">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">{i + 1}</td>
                  <td className="px-4 py-3 font-mono">{s.student_code}</td>
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-gray-500">{s.email}</td>
                  <td className="px-4 py-3">{s.school}</td>
                  <td className="px-4 py-3">
                    {s.checked_at ? (
                      <span className="text-green-600 font-medium">Check-in {s.checked_at}</span>
                    ) : (
                      <span className="text-gray-400">Chưa check-in</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDownloadQR(s.id, s.student_code)} className="text-blue-500 hover:underline mr-3">
                      Tải QR
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="text-red-400 hover:text-red-600">
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmailPanel({ eventId, onRefresh }) {
  const [stats, setStats] = useState(null);
  const [autoEmail, setAutoEmail] = useState(true);
  const [sending, setSending] = useState('');
  const [result, setResult] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { loadStats(); loadAutoEmail(); }, [eventId]);

  const loadStats = async () => {
    try {
      const res = await api.get(`/qr/event/${eventId}/email-stats`);
      setStats(res.data);
    } catch {}
  };

  const loadAutoEmail = async () => {
    try {
      const res = await api.get(`/sheetsync/${eventId}`);
      // Check auto_email setting
      setAutoEmail(true); // default on
    } catch {}
  };

  const handleToggleAutoEmail = async () => {
    const newVal = !autoEmail;
    setAutoEmail(newVal);
    await api.post('/settings/webhook', { webhook_secret: 'keep' }); // dummy
    // Save auto_email setting
    await api.post(`/sheetsync/${eventId}`, { auto_email: newVal });
  };

  const handleSendNew = async () => {
    if (!confirm('Gửi email QR cho tất cả SV mới (chưa gửi)?')) return;
    setSending('new');
    setResult(null);
    try {
      const res = await api.post(`/qr/event/${eventId}/email-new`);
      setResult(res.data);
      loadStats();
    } catch (err) {
      setResult({ error: err.response?.data?.error || 'Failed' });
    }
    setSending('');
  };

  const handleSendRemind = async () => {
    if (!confirm('Gửi email nhắc nhở cho tất cả SV đã nhận QR?')) return;
    setSending('remind');
    setResult(null);
    try {
      const res = await api.post(`/qr/event/${eventId}/email-remind`);
      setResult(res.data);
      loadStats();
    } catch (err) {
      setResult({ error: err.response?.data?.error || 'Failed' });
    }
    setSending('');
  };

  const handleSendOne = async (studentId) => {
    try {
      await api.post(`/qr/email/${studentId}`, {});
      loadStats();
    } catch {}
  };

  if (!stats) return null;

  return (
    <div className="bg-white rounded-lg shadow p-5 mb-6">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <h3 className="font-semibold">Email QR</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
            Đã gửi: {stats.sent}/{stats.total}
          </span>
          {stats.notSent > 0 && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
              Chưa gửi: {stats.notSent}
            </span>
          )}
          <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="mt-4">
          {/* Actions */}
          <div className="flex flex-wrap gap-3 mb-4">
            <button
              onClick={handleSendNew}
              disabled={!!sending || stats.notSent === 0}
              className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50"
            >
              {sending === 'new' ? 'Đang gửi...' : `Gửi cho SV mới (${stats.notSent})`}
            </button>
            <button
              onClick={handleSendRemind}
              disabled={!!sending || stats.sent === 0}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50"
            >
              {sending === 'remind' ? 'Đang gửi...' : `Nhắc nhở (${stats.sent})`}
            </button>
          </div>

          {result && (
            <div className={`p-3 rounded-lg text-sm mb-4 ${result.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {result.error ? result.error : `Đã gửi: ${result.sent}, Lỗi: ${result.failed}`}
            </div>
          )}

          {/* Not sent list */}
          {stats.notSentList.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Chưa gửi email ({stats.notSent})</h4>
              <div className="max-h-40 overflow-y-auto border rounded-lg">
                <table className="w-full text-xs">
                  <tbody>
                    {stats.notSentList.map(s => (
                      <tr key={s.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-1.5 font-mono">{s.student_code}</td>
                        <td className="px-3 py-1.5">{s.name}</td>
                        <td className="px-3 py-1.5 text-gray-500">{s.email}</td>
                        <td className="px-3 py-1.5">
                          <button onClick={() => handleSendOne(s.id)} className="text-blue-500 hover:underline">
                            Gửi
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recently sent */}
          {stats.recentSent.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Đã gửi gần đây</h4>
              <div className="max-h-40 overflow-y-auto border rounded-lg">
                <table className="w-full text-xs">
                  <tbody>
                    {stats.recentSent.map(s => (
                      <tr key={s.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-1.5 font-mono">{s.student_code}</td>
                        <td className="px-3 py-1.5">{s.name}</td>
                        <td className="px-3 py-1.5 text-gray-500">{s.email}</td>
                        <td className="px-3 py-1.5 text-green-600">{s.email_sent_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SheetSyncPanel({ eventId }) {
  const [config, setConfig] = useState({ sheet_url: '', sync_interval: 2, auto_sync: false, last_sync: null });
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    api.get(`/sheetsync/${eventId}`).then(res => {
      setConfig(res.data);
      if (res.data.sheet_url) setExpanded(true);
    }).catch(() => {});
  }, [eventId]);

  const handleSave = async () => {
    setSaving(true);
    await api.post(`/sheetsync/${eventId}`, config);
    setSaving(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await api.post(`/sheetsync/${eventId}/sync`);
      setSyncResult(res.data);
      // Reload parent
      window.location.reload();
    } catch (err) {
      setSyncResult({ error: err.response?.data?.error || 'Sync failed' });
    }
    setSyncing(false);
  };

  const handleToggleAutoSync = async () => {
    const newVal = !config.auto_sync;
    setConfig({ ...config, auto_sync: newVal });
    await api.post(`/sheetsync/${eventId}`, { ...config, auto_sync: newVal });
  };

  return (
    <div className="bg-white rounded-lg shadow p-5 mb-6">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <h3 className="font-semibold">Google Sheets Sync</h3>
        <div className="flex items-center gap-3">
          {config.auto_sync && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Auto-sync ON</span>}
          {config.last_sync && <span className="text-xs text-gray-400">Sync: {config.last_sync}</span>}
          <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Google Sheet URL</label>
            <input
              type="text"
              value={config.sheet_url}
              onChange={e => setConfig({ ...config, sheet_url: e.target.value })}
              placeholder="https://docs.google.com/spreadsheets/d/xxx..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">Sheet phải được Publish to web (File → Share → Publish to web)</p>
          </div>

          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Poll mỗi (phút)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={config.sync_interval}
                onChange={e => setConfig({ ...config, sync_interval: parseInt(e.target.value) || 2 })}
                className="w-24 border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="pt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.auto_sync}
                  onChange={handleToggleAutoSync}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm">Tự động đồng bộ</span>
              </label>
            </div>

            <div className="pt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.auto_email !== false}
                  onChange={() => {
                    const newVal = config.auto_email === false;
                    setConfig({ ...config, auto_email: newVal });
                    api.post(`/sheetsync/${eventId}`, { auto_email: newVal });
                  }}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm">Tự động gửi email</span>
              </label>
            </div>

            <div className="pt-5">
              <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? '...' : 'Lưu'}
              </button>
            </div>

            <div className="pt-5">
              <button onClick={handleSync} disabled={syncing} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                {syncing ? 'Đang sync...' : 'Sync ngay'}
              </button>
            </div>
          </div>

          {syncResult && (
            <div className={`p-3 rounded-lg text-sm ${syncResult.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {syncResult.error
                ? syncResult.error
                : `Đồng bộ xong: ${syncResult.synced} SV mới, ${syncResult.skipped} đã có`
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
}
