import { Link, useNavigate } from 'react-router-dom';
import { useContext, useState } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import logo from '../assets/logo.png';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setMobileMenuOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-sm">
      <div className="container mx-auto px-4 py-4 max-w-7xl">
        <div className="flex justify-between items-center">
          <Link to="/dashboard" className="flex items-center gap-2 sm:gap-3 group">
            <img 
              src={logo} 
              alt="Mirai Innovation" 
              className="h-8 sm:h-10 w-auto object-contain group-hover:scale-110 transition-transform"
            />
            <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              <span className="hidden sm:inline">Mirai Innovation</span>
              <span className="sm:hidden">Mirai</span>
            </span>
          </Link>
          
          {/* Desktop Menu */}
          <div className="hidden lg:flex gap-4 items-center">
            {user && (
              <>
                <Link 
                  to="/dashboard" 
                  className="text-gray-700 hover:text-blue-600 font-medium transition px-3 py-2 rounded-lg hover:bg-white/50"
                >
                  Dashboard
                </Link>
                <Link 
                  to="/cv-upload" 
                  className="text-gray-700 hover:text-blue-600 font-medium transition px-3 py-2 rounded-lg hover:bg-white/50"
                >
                  CV
                </Link>
                <Link 
                  to="/interview" 
                  className="text-gray-700 hover:text-blue-600 font-medium transition px-3 py-2 rounded-lg hover:bg-white/50"
                >
                  Interview
                </Link>
                <Link 
                  to="/results" 
                  className="text-gray-700 hover:text-blue-600 font-medium transition px-3 py-2 rounded-lg hover:bg-white/50"
                >
                  Summary
                </Link>
                {user.role === 'admin' && (
                  <Link 
                    to="/admin" 
                    className="text-gray-700 hover:text-blue-600 font-medium transition px-3 py-2 rounded-lg hover:bg-white/50"
                  >
                    Admin
                  </Link>
                )}
                <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                  <div className="text-right hidden xl:block">
                    <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.role === 'admin' ? 'Administrator' : 'User'}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {user.name?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition shadow-md hover:shadow-lg"
                  >
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          {user && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/50 transition"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Mobile Menu */}
        {user && mobileMenuOpen && (
          <div className="lg:hidden mt-4 pb-4 border-t border-gray-200 pt-4">
            <div className="flex flex-col gap-2">
              <Link 
                to="/dashboard" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-700 hover:text-blue-600 font-medium transition px-3 py-2 rounded-lg hover:bg-white/50"
              >
                Dashboard
              </Link>
              <Link 
                to="/cv-upload" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-700 hover:text-blue-600 font-medium transition px-3 py-2 rounded-lg hover:bg-white/50"
              >
                CV
              </Link>
              <Link 
                to="/interview" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-700 hover:text-blue-600 font-medium transition px-3 py-2 rounded-lg hover:bg-white/50"
              >
                Interview
              </Link>
              <Link 
                to="/results" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-700 hover:text-blue-600 font-medium transition px-3 py-2 rounded-lg hover:bg-white/50"
              >
                Summary
              </Link>
              {user.role === 'admin' && (
                <Link 
                  to="/admin" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-gray-700 hover:text-blue-600 font-medium transition px-3 py-2 rounded-lg hover:bg-white/50"
                >
                  Admin
                </Link>
              )}
              <div className="flex items-center gap-3 pt-3 mt-3 border-t border-gray-200">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {user.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.role === 'admin' ? 'Administrator' : 'User'}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition shadow-md hover:shadow-lg"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
