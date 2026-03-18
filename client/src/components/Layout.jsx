import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-xl font-bold text-blue-600">
              QR Check-in
            </Link>
            <Link to="/events" className="text-gray-600 hover:text-blue-600">
              Sự kiện
            </Link>
            <Link to="/staffs" className="text-gray-600 hover:text-blue-600">
              Nhân viên
            </Link>
            <Link to="/settings" className="text-gray-600 hover:text-blue-600">
              Cài đặt
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">Xin chào, {user}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-red-500 hover:text-red-700"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
