import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../utils/axios';

const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState('application'); // 'application', 'cv', 'interview'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/admin/users');
      setUsers(response.data.users);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/stats');
      setStats(response.data);
    } catch (error) {
    }
  };

  const toggleUserStatus = async (userId) => {
    try {
      await api.patch(`/admin/users/${userId}/toggle-status`);
      await fetchUsers();
      await fetchStats();
    } catch (error) {
      alert('Error changing user status');
    }
  };

  const changeUserRole = async (userId, newRole) => {
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      await fetchUsers();
    } catch (error) {
      alert('Error changing user role');
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }
    try {
      await api.delete(`/admin/users/${userId}`);
      await fetchUsers();
      await fetchStats();
    } catch (error) {
      alert('Error deleting user');
    }
  };

  const fetchUserDetails = async (userId) => {
    setLoadingDetails(true);
    try {
      const response = await api.get(`/admin/users/${userId}`);
      setUserDetails(response.data);
      setSelectedUser(userId);
    } catch (error) {
      console.error('Error fetching user details:', error);
      alert('Error fetching user details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeUserDetails = () => {
    setSelectedUser(null);
    setUserDetails(null);
    setActiveTab('application'); // Reset to first tab when closing
  };

  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateString;
    }
  };

  // Data Display Card Component
  const DataCard = ({ label, value, colSpan = 1 }) => (
    <div className={`bg-white/40 p-3 rounded-xl border border-white/20 ${colSpan === 2 ? 'md:col-span-2' : ''}`}>
      <p className="text-xs text-gray-500 uppercase mb-1">{label}</p>
      <p className="text-gray-800 font-medium">{value || 'N/A'}</p>
    </div>
  );

  const getCVUrl = (cvPath) => {
    if (!cvPath) return null;
    if (cvPath.startsWith('http://') || cvPath.startsWith('https://')) {
      return cvPath;
    }
    const baseURL = import.meta.env.VITE_API_URL || '/api';
    return `${baseURL}${cvPath}`;
  };

  const getVideoUrl = (videoPath) => {
    if (!videoPath) {
      return null;
    }
    // Si ya es una URL completa (http/https), devolverla tal cual
    if (videoPath.startsWith('http://') || videoPath.startsWith('https://')) {
      return videoPath;
    }
    // Si es una ruta relativa, construir la URL completa
    const baseURL = import.meta.env.VITE_API_URL || '/api';
    const fullUrl = `${baseURL}${videoPath}`;
    return fullUrl;
  };

  // Filtrar usuarios
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !filterRole || user.role === filterRole;
    const matchesStatus = !filterStatus || 
                         (filterStatus === 'active' && user.isActive) ||
                         (filterStatus === 'inactive' && !user.isActive);
    return matchesSearch && matchesRole && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh-gradient">
        <Navbar />
        <div className="flex justify-center items-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh-gradient">
      {/* Ambient Orbs */}
      <div className="ambient-orb-1"></div>
      <div className="ambient-orb-2"></div>
      <div className="ambient-orb-3"></div>

      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2">Administration Panel</h1>
          <p className="text-base sm:text-lg text-gray-600">Manage users, view statistics and administer the system</p>
        </div>

        {/* KPIs Grid - 4 Tarjetas de Cristal */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {/* Total Usuarios */}
            <div className="glass-card p-6 relative overflow-hidden">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Total Users</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {stats.totalUsers}
                  </p>
                </div>
                <div className="text-5xl drop-shadow-xl" style={{ 
                  filter: 'drop-shadow(0 20px 25px rgba(59, 130, 246, 0.3))'
                }}>
                  👥
                </div>
              </div>
            </div>

            {/* Usuarios Activos */}
            <div className="glass-card p-6 relative overflow-hidden">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Active Users</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                    {stats.activeUsers}
                  </p>
                </div>
                <div className="text-5xl drop-shadow-xl" style={{ 
                  filter: 'drop-shadow(0 20px 25px rgba(34, 197, 94, 0.3))'
                }}>
                  ✅
                </div>
              </div>
            </div>

            {/* CVs Analizados */}
            <div className="glass-card p-6 relative overflow-hidden">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">CVs Analyzed</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    {stats.cvAnalyzed}
                  </p>
                </div>
                <div className="text-5xl drop-shadow-xl" style={{ 
                  filter: 'drop-shadow(0 20px 25px rgba(139, 92, 246, 0.3))'
                }}>
                  📄
                </div>
              </div>
            </div>

            {/* Entrevistas Completadas */}
            <div className="glass-card p-6 relative overflow-hidden">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Interviews Completed</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                    {stats.interviewCompleted}
                  </p>
                </div>
                <div className="text-5xl drop-shadow-xl" style={{ 
                  filter: 'drop-shadow(0 20px 25px rgba(251, 146, 60, 0.3))'
                }}>
                  💬
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabla de Usuarios - Contenedor de Cristal */}
        <div className="glass-card p-4 sm:p-6 md:p-8 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Users</h2>
            
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="glass-card bg-white/40 border border-white/40 px-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="glass-card bg-white/40 border border-white/40 px-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Roles</option>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="glass-card bg-white/40 border border-white/40 px-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full min-w-[640px] sm:min-w-0">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700">Avatar</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700">Name</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700 hidden md:table-cell">Email</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700">Role</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user._id} className="border-b border-white/10 hover:bg-white/20 transition">
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                        {user.profilePhoto ? (
                          <img 
                            src={user.profilePhoto} 
                            alt={user.name} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-white font-bold text-lg">
                            {user.name?.charAt(0)?.toUpperCase() || 'U'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <p className="font-semibold text-gray-900 text-sm sm:text-base">{user.name}</p>
                      <p className="text-gray-500 text-xs md:hidden">{user.email}</p>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 hidden md:table-cell">
                      <p className="text-gray-700 text-xs sm:text-sm">{user.email}</p>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <select
                        value={user.role}
                        onChange={(e) => changeUserRole(user._id, e.target.value)}
                        className="glass-card bg-white/40 border border-white/40 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <span className={`inline-flex items-center gap-1 sm:gap-2 bg-white/40 backdrop-blur-sm border rounded-full px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium ${
                        user.isActive 
                          ? 'bg-green-100/50 text-green-700 border-green-200/60' 
                          : 'bg-red-100/50 text-red-700 border-red-200/60'
                      }`}>
                        <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                          user.isActive ? 'bg-green-500' : 'bg-red-500'
                        }`}></span>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <button
                          onClick={() => fetchUserDetails(user._id)}
                          className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-100/50 hover:bg-blue-200/70 text-blue-600 flex items-center justify-center transition hover:scale-110"
                          title="View Details"
                        >
                          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => toggleUserStatus(user._id)}
                          className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-orange-100/50 hover:bg-orange-200/70 text-orange-600 flex items-center justify-center transition hover:scale-110"
                          title={user.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {user.isActive ? (
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => deleteUser(user._id)}
                          className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-red-100/50 hover:bg-red-200/70 text-red-600 flex items-center justify-center transition hover:scale-110"
                          title="Delete"
                        >
                          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal de Detalles - Cristal con Bento Grid */}
        {selectedUser && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={closeUserDetails}
          >
            <div 
              className="glass-card max-w-6xl w-full max-h-[90vh] overflow-y-auto rounded-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header del Modal */}
              <div className="sticky top-0 glass-card bg-white/70 backdrop-blur-xl border-b border-white/40 p-6 flex items-center justify-between z-10">
                {loadingDetails ? (
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <h2 className="text-2xl font-bold text-gray-900">Loading details...</h2>
                  </div>
                ) : userDetails ? (
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                      {userDetails.profilePhoto ? (
                        <img 
                          src={userDetails.profilePhoto} 
                          alt={userDetails.name} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-white font-bold text-2xl">
                          {userDetails.name?.charAt(0)?.toUpperCase() || 'U'}
                        </span>
                      )}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{userDetails.name}</h2>
                      <p className="text-sm text-gray-600">
                        {userDetails.role === 'admin' ? 'Administrator' : 'User'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <h2 className="text-2xl font-bold text-gray-900">User Details</h2>
                )}
                <button
                  onClick={closeUserDetails}
                  className="w-10 h-10 rounded-lg bg-gray-100/50 hover:bg-gray-200/70 text-gray-600 flex items-center justify-center transition hover:scale-110"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {loadingDetails ? (
                <div className="p-12 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading user details...</p>
                </div>
              ) : userDetails ? (
                <div className="p-8">
                  {/* Tabs Navigation */}
                  <div className="flex gap-2 mb-6 border-b border-white/20 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    <button
                      onClick={() => setActiveTab('application')}
                      className={`px-6 py-3 rounded-t-xl font-semibold transition-all duration-300 whitespace-nowrap ${
                        activeTab === 'application'
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                          : 'text-gray-500 hover:bg-white/40'
                      }`}
                    >
                      Application Info
                    </button>
                    <button
                      onClick={() => setActiveTab('cv')}
                      className={`px-6 py-3 rounded-t-xl font-semibold transition-all duration-300 whitespace-nowrap ${
                        activeTab === 'cv'
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                          : 'text-gray-500 hover:bg-white/40'
                      }`}
                    >
                      CV & Skills
                    </button>
                    {userDetails.interviewCompleted && (
                      <button
                        onClick={() => setActiveTab('interview')}
                        className={`px-6 py-3 rounded-t-xl font-semibold transition-all duration-300 whitespace-nowrap ${
                          activeTab === 'interview'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                            : 'text-gray-500 hover:bg-white/40'
                        }`}
                      >
                        Interview Results
                      </button>
                    )}
                  </div>

                  {/* Tab Content */}
                  {activeTab === 'application' && (
                    <div>
                      {userDetails.application ? (
                        <div className="space-y-6">
                          {/* Personal & Contact Section */}
                          <div className="glass-card p-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              Personal & Contact
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <DataCard label="First Name" value={userDetails.application.firstName} />
                              <DataCard label="Last Name" value={userDetails.application.lastName} />
                              <DataCard label="Email" value={userDetails.application.email || userDetails.email} />
                              <DataCard label="Sex" value={userDetails.application.sex} />
                              <DataCard label="Date of Birth" value={formatDate(userDetails.application.dateOfBirth)} />
                              <DataCard label="Country of Citizenship" value={userDetails.application.countryOfCitizenship} />
                              <DataCard label="Country of Residency" value={userDetails.application.countryOfResidency} />
                              <DataCard label="Phone Type" value={userDetails.application.primaryPhoneType} />
                              <DataCard label="Phone Number" value={userDetails.application.phoneNumber} />
                              <DataCard label="LinkedIn Profile" value={userDetails.application.linkedInProfileUrl} colSpan={2} />
                              {userDetails.application.hasMedicalCondition && (
                                <DataCard label="Medical Condition Details" value={userDetails.application.medicalConditionDetails} colSpan={2} />
                              )}
                            </div>
                          </div>

                          {/* Academic Background Section */}
                          <div className="glass-card p-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                              Academic Background
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <DataCard label="Institution Name" value={userDetails.application.institutionName} />
                              <DataCard label="Main Academic Major" value={userDetails.application.mainAcademicMajor} />
                              <DataCard label="Current Semester" value={userDetails.application.currentSemester} />
                              <DataCard label="CV URL" value={userDetails.application.cvUrl} colSpan={2} />
                              <DataCard label="Portfolio URL" value={userDetails.application.portfolioUrl} colSpan={2} />
                              <DataCard label="Has Academic Publications" value={userDetails.application.hasAcademicPublications ? 'Yes' : 'No'} />
                              {userDetails.application.otherStudiesCertifications && (
                                <DataCard label="Other Studies/Certifications" value={userDetails.application.otherStudiesCertifications} colSpan={2} />
                              )}
                              {userDetails.application.participationInChallenges && (
                                <DataCard label="Participation in Challenges" value={userDetails.application.participationInChallenges} colSpan={2} />
                              )}
                              {userDetails.application.awardsAndDistinctions && (
                                <DataCard label="Awards and Distinctions" value={userDetails.application.awardsAndDistinctions} colSpan={2} />
                              )}
                            </div>
                          </div>

                          {/* Program Specifics Section */}
                          <div className="glass-card p-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Program Specifics
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <DataCard label="English Level" value={userDetails.application.englishLevel} />
                              <DataCard label="Has English Certification" value={userDetails.application.hasEnglishCertification ? 'Yes' : 'No'} />
                              <DataCard label="Payment Source" value={userDetails.application.paymentSource} />
                              <DataCard label="Applied Before" value={userDetails.application.appliedBefore ? 'Yes' : 'No'} />
                              <DataCard label="Promotional Code" value={userDetails.application.promotionalCode || 'None'} />
                            </div>
                          </div>

                          {/* Application Status */}
                          <div className="glass-card p-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-4">Application Status</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                              <DataCard label="Step 1 Completed" value={userDetails.application.step1Completed ? '✅ Yes' : '❌ No'} />
                              <DataCard label="Step 2 Completed" value={userDetails.application.step2Completed ? '✅ Yes' : '❌ No'} />
                              <DataCard label="Step 3 Completed" value={userDetails.application.step3Completed ? '✅ Yes' : '❌ No'} />
                              <DataCard label="Step 4 Completed" value={userDetails.application.step4Completed ? '✅ Yes' : '❌ No'} />
                              <DataCard label="Current Step" value={userDetails.application.currentStep} colSpan={2} />
                              <DataCard label="Is Draft" value={userDetails.application.isDraft ? 'Yes' : 'No'} colSpan={2} />
                            </div>
                            
                            {/* Reset Application Button */}
                            <div className="pt-6 border-t border-white/20">
                              <button
                                onClick={async () => {
                                  if (!window.confirm('Are you sure you want to delete/reset this user\'s application? This will allow them to complete the application form again from the beginning.')) {
                                    return;
                                  }
                                  try {
                                    await api.delete(`/admin/users/${selectedUser}/application`);
                                    await fetchUserDetails(selectedUser);
                                    alert('Application reset successfully. The user can now complete the form again.');
                                  } catch (error) {
                                    console.error('Error resetting application:', error);
                                    alert('Error resetting application: ' + (error.response?.data?.message || error.message));
                                  }
                                }}
                                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Reset Application
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="glass-card p-8 text-center">
                          <div className="inline-flex items-center gap-2 bg-yellow-100/50 text-yellow-700 border border-yellow-200/60 rounded-full px-4 py-2 mb-4">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-semibold">Application Pending</span>
                          </div>
                          <p className="text-gray-600 mb-4">
                            {userDetails.application 
                              ? 'This user has started the application but has not completed Step 1 yet.' 
                              : 'This user has not started the application form yet.'}
                          </p>
                          
                          {/* Debug Info - Show application status if it exists */}
                          {userDetails.application && (
                            <div className="mt-4 mb-4 p-4 bg-gray-100/50 rounded-lg text-left">
                              <p className="text-xs font-semibold text-gray-700 mb-2">Application Status:</p>
                              <div className="text-xs text-gray-600 space-y-1 mb-3">
                                <p>Application exists: ✅</p>
                                <p>Step 1 Completed: {userDetails.application.step1Completed ? '✅ Yes' : '❌ No'}</p>
                                <p>Is Draft: {userDetails.application.isDraft ? 'Yes' : 'No'}</p>
                                <p>Current Step: {userDetails.application.currentStep || 'N/A'}</p>
                                {userDetails.application.firstName && (
                                  <p>Has data: ✅ (First Name: {userDetails.application.firstName})</p>
                                )}
                              </div>
                              {!userDetails.application.step1Completed && userDetails.application.firstName && (
                                <button
                                  onClick={async () => {
                                    if (!window.confirm('Mark Step 1 as completed? This will allow the user to proceed to Step 2 (Interview).')) {
                                      return;
                                    }
                                    try {
                                      // Update application to mark step 1 as completed (using admin endpoint)
                                      await api.patch(`/admin/users/${selectedUser}/application`, {
                                        step1Completed: true,
                                        currentStep: 2,
                                        isDraft: false
                                      });
                                      await fetchUserDetails(selectedUser);
                                      alert('Step 1 marked as completed successfully.');
                                    } catch (error) {
                                      console.error('Error updating application:', error);
                                      alert('Error updating application: ' + (error.response?.data?.message || error.message));
                                    }
                                  }}
                                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] text-xs"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Mark Step 1 as Completed
                                </button>
                              )}
                            </div>
                          )}
                          
                          <button
                            onClick={async () => {
                              if (!window.confirm('Are you sure you want to delete any existing application data for this user?')) {
                                return;
                              }
                              try {
                                await api.delete(`/admin/users/${selectedUser}/application`);
                                await fetchUserDetails(selectedUser);
                                alert('Application data cleared successfully.');
                              } catch (error) {
                                console.error('Error clearing application:', error);
                                alert('Error clearing application: ' + (error.response?.data?.message || error.message));
                              }
                            }}
                            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            {userDetails.application ? 'Reset Application' : 'Clear Application Data'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'cv' && (
                    <div className="glass-card p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        CV Analysis
                      </h3>
                      {userDetails.cvPath ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Score CV</span>
                            <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                              {userDetails.score || 0}%
                            </span>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600">Status: </span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${
                              userDetails.cvAnalyzed 
                                ? 'bg-green-100/50 text-green-700' 
                                : 'bg-yellow-100/50 text-yellow-700'
                            }`}>
                              {userDetails.cvAnalyzed ? '✅ Analyzed' : '⏳ Pending'}
                            </span>
                          </div>
                          {userDetails.skills && userDetails.skills.length > 0 && (
                            <div>
                              <p className="text-sm text-gray-600 mb-3">Skills Detected:</p>
                              <div className="flex flex-wrap gap-2">
                                {userDetails.skills.map((skill, idx) => {
                                  const cleanSkill = skill
                                    .replace(/\*\*/g, '')
                                    .replace(/[-•]\s*/g, '')
                                    .replace(/\n/g, ' ')
                                    .trim()
                                    .split(/[.,;]/)[0]
                                    .trim();
                                  
                                  if (cleanSkill.length < 2 || cleanSkill.length > 50) {
                                    return null;
                                  }
                                  
                                  return (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1 bg-white/40 backdrop-blur-sm border border-blue-200/60 text-gray-800 px-3 py-1 rounded-full text-xs font-medium"
                                    >
                                      <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      {cleanSkill}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          <div className="flex gap-3">
                            <a
                              href={getCVUrl(userDetails.cvPath)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              View/Download CV
                            </a>
                            <button
                              onClick={async () => {
                                if (!window.confirm('Are you sure you want to delete the CV and related data? This will also reset the interview data.')) {
                                  return;
                                }
                                try {
                                  await api.delete(`/admin/users/${selectedUser}/cv`);
                                  await fetchUserDetails(selectedUser);
                                  alert('CV deleted successfully');
                                } catch (error) {
                                  alert('Error deleting CV');
                                }
                              }}
                              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete CV
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">No CV uploaded</p>
                      )}
                    </div>
                  )}

                  {activeTab === 'interview' && userDetails.interviewCompleted && (
                    <div className="glass-card p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        Interview Results
                      </h3>
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Interview Score</span>
                          <span className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                            {userDetails.interviewScore || 0}%
                          </span>
                        </div>

                        {/* Video de Presentación con Marco de Cristal */}
                        {userDetails.interviewVideo ? (
                          <div className="glass-card bg-white/40 border border-white/40 p-4 rounded-2xl">
                            <p className="text-sm font-semibold text-gray-700 mb-3">Presentation Video</p>
                            <video
                              controls
                              className="w-full rounded-xl shadow-lg"
                              src={getVideoUrl(userDetails.interviewVideo)}
                              onError={(e) => {
                                // Error loading video - handled silently
                              }}
                            >
                              Your browser does not support video playback.
                            </video>
                            {userDetails.interviewVideoTranscription && (
                              <div className="mt-4 pt-4 border-t border-white/20">
                                <p className="text-xs font-semibold text-gray-600 mb-2">Transcription:</p>
                                <p className="text-sm text-gray-700 bg-white/40 p-3 rounded-lg">
                                  {userDetails.interviewVideoTranscription}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="glass-card bg-white/40 border border-white/40 p-4 rounded-2xl">
                            <p className="text-sm font-semibold text-gray-700 mb-3">Presentation Video</p>
                            <p className="text-sm text-gray-500 italic">No video uploaded yet</p>
                          </div>
                        )}

                        {/* Preguntas y Respuestas */}
                        {(() => {
                          // Combine all questions (generated + default) to match interviewResponses structure
                          const defaultQuestions = [
                            "What is your motivation for applying to this program and joining Mirai Innovation Research Institute?",
                            "What is your plan to finance your tuition, travel expenses, and accommodation during your stay in Japan?"
                          ];
                          const generatedQuestions = userDetails.questions || [];
                          const allQuestions = [...generatedQuestions, ...defaultQuestions];
                          const responses = userDetails.interviewResponses || [];
                          
                          // Show all questions, matching each question with its corresponding response by index
                          // interviewResponses array has the same length and order as allQuestions
                          return allQuestions.length > 0 && (
                            <div>
                              <p className="text-sm font-semibold text-gray-700 mb-4">Questions and Answers</p>
                              <div className="space-y-4">
                                {allQuestions.map((question, idx) => (
                                  <div key={idx} className="glass-card bg-white/40 border border-white/40 p-4 rounded-xl">
                                    <p className="font-semibold text-gray-900 mb-2">
                                      {question}
                                    </p>
                                    <p className="text-gray-700 text-sm mb-3">
                                      {responses[idx] && responses[idx].trim() !== '' ? (
                                        responses[idx]
                                      ) : (
                                        <span className="text-gray-400">No answer</span>
                                      )}
                                    </p>
                                    {userDetails.interviewAnalysis && userDetails.interviewAnalysis[idx] && (
                                      <div className="mt-3 pt-3 border-t border-white/20">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-xs text-gray-600">Score</span>
                                          <span className="text-lg font-bold text-blue-600">
                                            {userDetails.interviewAnalysis[idx].score}/100
                                          </span>
                                        </div>
                                        <p className="text-xs text-gray-600">
                                          {userDetails.interviewAnalysis[idx].explanation}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                        
                        {/* Delete Interview Button */}
                        <div className="mt-6 pt-6 border-t border-white/20">
                          <button
                            onClick={async () => {
                              if (!window.confirm('Are you sure you want to delete the interview data? This will allow the user to retake the interview.')) {
                                return;
                              }
                              try {
                                await api.delete(`/admin/users/${selectedUser}/interview`);
                                await fetchUserDetails(selectedUser);
                                alert('Interview deleted successfully');
                              } catch (error) {
                                alert('Error deleting interview');
                              }
                            }}
                            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete Interview
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-12 text-center text-gray-500">
                  Could not load details
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
