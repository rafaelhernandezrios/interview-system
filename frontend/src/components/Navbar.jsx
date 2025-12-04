import { Link, useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-blue-600 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/dashboard" className="text-xl font-bold">
          Mirai Innovation Research Institute
        </Link>
        <div className="flex gap-4 items-center">
          {user && (
            <>
              <Link to="/dashboard" className="hover:underline">Dashboard</Link>
              <Link to="/cv-upload" className="hover:underline">CV</Link>
              <Link to="/interview" className="hover:underline">Interview</Link>
              <Link to="/results" className="hover:underline">Results</Link>
              {user.role === 'admin' && (
                <Link to="/admin" className="hover:underline">Admin</Link>
              )}
              <span className="text-sm">Hello, {user.name}</span>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

