import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import axios from 'axios';

export default function ScannerPage() {
  const { eventId } = useParams();

  // Staff auth state
  const [staffToken, setStaffToken] = useState(sessionStorage.getItem('staffToken'));
  const [staffName, setStaffName] = useState(sessionStorage.getItem('staffName') || '');
  const [loginForm, setLoginForm] = useState({ username: '', pin: '' });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Scanner state
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [count, setCount] = useState(0);
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);

  useEffect(() => {
    return () => {
      if (html5QrRef.current) {
        html5QrRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Staff login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await axios.post('/api/auth/staff/login', loginForm);
      sessionStorage.setItem('staffToken', res.data.token);
      sessionStorage.setItem('staffName', res.data.name);
      setStaffToken(res.data.token);
      setStaffName(res.data.name);
    } catch (err) {
      setLoginError(err.response?.data?.error || 'Đăng nhập thất bại');
    }
    setLoginLoading(false);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('staffToken');
    sessionStorage.removeItem('staffName');
    setStaffToken(null);
    setStaffName('');
    if (html5QrRef.current) {
      html5QrRef.current.stop().catch(() => {});
    }
    setScanning(false);
    setResult(null);
    setCount(0);
  };

  const startScanner = async () => {
    setResult(null);
    setScanning(true);

    const html5Qr = new Html5Qrcode('scanner');
    html5QrRef.current = html5Qr;

    try {
      await html5Qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          await html5Qr.stop();
          setScanning(false);

          try {
            const res = await axios.post('/api/checkin',
              { token: decodedText },
              { headers: { Authorization: `Bearer ${staffToken}` } }
            );
            setResult(res.data);
            if (res.data.success) setCount((c) => c + 1);
          } catch (err) {
            const data = err.response?.data;
            if (err.response?.status === 401) {
              handleLogout();
              return;
            }
            setResult(data || { success: false, error: 'Lỗi kết nối server' });
          }
        },
        () => {}
      );
    } catch {
      setScanning(false);
      setResult({ success: false, error: 'Không thể truy cập camera. Vui lòng cho phép quyền camera.' });
    }
  };

  // ====== LOGIN SCREEN ======
  if (!staffToken) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-2">QR Check-in</h1>
        <p className="text-gray-400 mb-6">Đăng nhập để bắt đầu quét</p>

        <form onSubmit={handleLogin} className="w-full max-w-xs space-y-4">
          {loginError && (
            <div className="bg-red-600/20 text-red-300 p-3 rounded text-sm text-center">{loginError}</div>
          )}
          <input
            type="text"
            placeholder="Username"
            value={loginForm.username}
            onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            required
          />
          <input
            type="password"
            placeholder="PIN"
            inputMode="numeric"
            value={loginForm.pin}
            onChange={(e) => setLoginForm({ ...loginForm, pin: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            required
          />
          <button
            type="submit"
            disabled={loginLoading}
            className="w-full bg-blue-600 py-3 rounded-lg text-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loginLoading ? 'Đang xử lý...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    );
  }

  // ====== SCANNER SCREEN ======
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4">
      {/* Header */}
      <div className="w-full max-w-sm flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">QR Check-in</h1>
          <p className="text-gray-400 text-sm">NV: <b className="text-blue-400">{staffName}</b></p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400">Đã quét: <b className="text-green-400 text-lg">{count}</b></p>
          <button onClick={handleLogout} className="text-xs text-red-400 hover:text-red-300">
            Đăng xuất
          </button>
        </div>
      </div>

      {/* Scanner area */}
      <div id="scanner" ref={scannerRef} className="w-full max-w-sm mb-4 rounded-lg overflow-hidden"></div>

      {!scanning && (
        <button
          onClick={startScanner}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-blue-700 mb-4"
        >
          {result ? 'Quét tiếp' : 'Bắt đầu quét'}
        </button>
      )}

      {scanning && (
        <p className="text-yellow-400 animate-pulse">Đang quét... Hướng camera vào mã QR</p>
      )}

      {/* Result display */}
      {result && (
        <div className={`w-full max-w-sm rounded-lg p-6 text-center ${
          result.success
            ? 'bg-green-600'
            : result.duplicate
              ? 'bg-yellow-600'
              : 'bg-red-600'
        }`}>
          {result.success ? (
            <>
              <div className="text-5xl mb-3">&#10003;</div>
              <div className="text-2xl font-bold mb-1">{result.student.name}</div>
              <div className="text-lg opacity-90">{result.student.student_code}</div>
              <div className="opacity-80 mt-1">{result.student.school}</div>
              <div className="text-sm opacity-70 mt-2">{result.student.checked_at}</div>
            </>
          ) : result.duplicate ? (
            <>
              <div className="text-5xl mb-3">&#9888;</div>
              <div className="text-xl font-bold mb-1">Đã check-in rồi!</div>
              <div className="text-lg">{result.student?.name}</div>
              <div className="opacity-80">{result.student?.student_code}</div>
              <div className="text-sm opacity-70 mt-2">Check-in lúc: {result.student?.checked_at}</div>
            </>
          ) : (
            <>
              <div className="text-5xl mb-3">&#10007;</div>
              <div className="text-xl font-bold">{result.error}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
