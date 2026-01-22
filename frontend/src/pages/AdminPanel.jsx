import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../utils/axios';

// Component for individual report item with response functionality
const ReportItem = ({ report, reportIndex, userId, userName, onResponseSent }) => {
  const [responseMessage, setResponseMessage] = useState('');
  const [sendingResponse, setSendingResponse] = useState(false);
  const [showResponseForm, setShowResponseForm] = useState(false);

  const handleRespond = async () => {
    if (!responseMessage.trim()) {
      alert('Please enter a message');
      return;
    }

    setSendingResponse(true);
    try {
      await api.post(`/admin/users/${userId}/reports/${reportIndex}/respond`, {
        message: responseMessage
      });
      setResponseMessage('');
      setShowResponseForm(false);
      await onResponseSent(userId);
      alert('Response sent successfully! The user will be notified by email.');
    } catch (error) {
      alert(error.response?.data?.message || 'Error sending response');
    } finally {
      setSendingResponse(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white/40 border border-white/40 p-4 rounded-xl space-y-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
            report.type === 'problem' ? 'bg-red-100 text-red-700' :
            report.type === 'survey' ? 'bg-blue-100 text-blue-700' :
            'bg-green-100 text-green-700'
          }`}>
            {report.type === 'problem' ? 'Problem' : report.type === 'survey' ? 'Survey' : 'Feedback'}
          </span>
          {report.subject && (
            <span className="font-semibold text-gray-900 text-sm">{report.subject}</span>
          )}
        </div>
        <span className="text-xs text-gray-500">
          {formatDate(report.submittedAt)}
        </span>
      </div>
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.message}</p>

      {/* Messages Thread */}
      {report.messages && report.messages.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Conversation:</h4>
          {report.messages.map((msg, msgIdx) => (
            <div
              key={msgIdx}
              className={`p-3 rounded-lg ${
                msg.sender === 'admin'
                  ? 'bg-blue-50 border-l-4 border-blue-500'
                  : 'bg-gray-50 border-l-4 border-gray-400'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-700">
                  {msg.sender === 'admin' ? (msg.senderName || 'Admin') : userName}
                </span>
                <span className="text-xs text-gray-500">
                  {formatDate(msg.sentAt)}
                </span>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{msg.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Response Form */}
      {showResponseForm ? (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <textarea
            value={responseMessage}
            onChange={(e) => setResponseMessage(e.target.value)}
            placeholder="Type your response to the user..."
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none mb-3"
            disabled={sendingResponse}
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowResponseForm(false);
                setResponseMessage('');
              }}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-all"
              disabled={sendingResponse}
            >
              Cancel
            </button>
            <button
              onClick={handleRespond}
              disabled={sendingResponse || !responseMessage.trim()}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendingResponse ? 'Sending...' : 'Send Response'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowResponseForm(true)}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all"
        >
          Respond to Report
        </button>
      )}
    </div>
  );
};

const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy, setSortBy] = useState(''); // Sort by: 'both', 'cv-only', 'none'
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState(null);

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, []);

  const fetchUsers = async () => {
    try {
      // Solicitar todos los usuarios sin límite de paginación
      const response = await api.get('/admin/users');
      setUsers(response.data.users);
    } catch (error) {
      console.error('Error fetching users:', error);
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

  const handleSendBulkEmail = async () => {
    if (!emailSubject.trim() || !emailMessage.trim()) {
      alert('Please fill in both subject and message');
      return;
    }

    setSendingEmail(true);
    setEmailResult(null);
    try {
      const response = await api.post('/admin/send-bulk-email', {
        subject: emailSubject,
        message: emailMessage
      });
      setEmailResult({
        success: true,
        message: response.data.message,
        totalSent: response.data.totalSent,
        totalFailed: response.data.totalFailed,
        totalUsers: response.data.totalUsers
      });
      setEmailSubject('');
      setEmailMessage('');
      setTimeout(() => {
        setShowEmailModal(false);
        setEmailResult(null);
      }, 3000);
    } catch (error) {
      setEmailResult({
        success: false,
        message: error.response?.data?.message || 'Error sending emails'
      });
    } finally {
      setSendingEmail(false);
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
  };

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

  // Filtrar y ordenar usuarios
  let filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !filterRole || user.role === filterRole;
    const matchesStatus = !filterStatus || 
                         (filterStatus === 'active' && user.isActive) ||
                         (filterStatus === 'inactive' && !user.isActive);
    
    // Filter by score status
    const hasCVScore = user.score !== undefined && user.score !== null;
    const hasInterviewScore = user.interviewScore !== undefined && user.interviewScore !== null;
    
    if (sortBy === 'both') {
      // Only show users with both CV and Interview scores
      if (!hasCVScore || !hasInterviewScore) return false;
    } else if (sortBy === 'cv-only') {
      // Only show users with CV score but no Interview score
      if (!hasCVScore || hasInterviewScore) return false;
    } else if (sortBy === 'none') {
      // Only show users with no scores
      if (hasCVScore || hasInterviewScore) return false;
    }
    // If sortBy is empty, show all
    
    return matchesSearch && matchesRole && matchesStatus;
  });
  
  // Sort users based on sortBy
  if (sortBy === 'both') {
    filteredUsers = [...filteredUsers].sort((a, b) => {
      const aTotal = (a.score || 0) + (a.interviewScore || 0);
      const bTotal = (b.score || 0) + (b.interviewScore || 0);
      return bTotal - aTotal; // Descending order
    });
  } else if (sortBy === 'cv-only') {
    filteredUsers = [...filteredUsers].sort((a, b) => {
      return (b.score || 0) - (a.score || 0); // Descending order
    });
  }

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

        {/* Send Bulk Email Section */}
        <div className="glass-card p-4 sm:p-6 md:p-8 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Send Email to All Active Users</h2>
              <p className="text-sm text-gray-600">Send a general email notification to all active users</p>
            </div>
            <button
              onClick={() => setShowEmailModal(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-2 px-6 rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Send Email
            </button>
          </div>
        </div>

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
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="glass-card bg-white/40 border border-white/40 px-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Scores</option>
                <option value="both">CV + Interview Scores</option>
                <option value="cv-only">CV Score Only</option>
                <option value="none">No Scores</option>
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
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700">Score</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700">Reports</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const hasReports = user.reports && user.reports.length > 0;
                  const reportsCount = user.reports ? user.reports.length : 0;
                  
                  return (
                  <tr 
                    key={user._id} 
                    className={`border-b transition ${
                      hasReports 
                        ? 'border-l-4 border-l-orange-500 bg-orange-50/30 hover:bg-orange-50/50' 
                        : 'border-white/10 hover:bg-white/20'
                    }`}
                  >
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center relative">
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
                        {hasReports && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center">
                            <span className="text-white text-xs font-bold">{reportsCount}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center gap-2">
                        <p className={`font-semibold text-sm sm:text-base ${
                          hasReports ? 'text-orange-700' : 'text-gray-900'
                        }`}>
                          {user.name}
                        </p>
                        {hasReports && (
                          <svg className="w-4 h-4 text-orange-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        )}
                      </div>
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
                      <div className="flex flex-col gap-1">
                        {user.score !== undefined && user.score !== null ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-600">CV:</span>
                            <span className={`font-bold text-sm ${
                              user.score >= 80 ? 'text-green-600' :
                              user.score >= 60 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {user.score}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">CV: N/A</span>
                        )}
                        {user.interviewScore !== undefined && user.interviewScore !== null ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-600">Int:</span>
                            <span className={`font-bold text-sm ${
                              user.interviewScore >= 80 ? 'text-green-600' :
                              user.interviewScore >= 60 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {user.interviewScore}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Int: N/A</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      {hasReports ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 bg-orange-100/70 text-orange-700 border border-orange-300 rounded-full px-2.5 py-1 text-xs font-bold shadow-sm">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            {reportsCount}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">No reports</span>
                      )}
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
                  );
                })}
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
                  {/* Bento Grid de Información */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Tarjeta Info Básica */}
                    <div className="glass-card p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Basic Information
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Email</p>
                          <p className="font-semibold text-gray-900">{userDetails.email}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Program</p>
                          <p className="font-semibold text-gray-900">{userDetails.program || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Academic Level</p>
                          <p className="font-semibold text-gray-900">{userDetails.academic_level || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Digital ID</p>
                          <p className="font-semibold text-gray-900">{userDetails.digitalId || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Status</p>
                          <span className={`inline-flex items-center gap-2 bg-white/40 backdrop-blur-sm border rounded-full px-3 py-1 text-sm font-medium ${
                            userDetails.isActive 
                              ? 'bg-green-100/50 text-green-700 border-green-200/60' 
                              : 'bg-red-100/50 text-red-700 border-red-200/60'
                          }`}>
                            <span className={`w-2 h-2 rounded-full ${
                              userDetails.isActive ? 'bg-green-500' : 'bg-red-500'
                            }`}></span>
                            {userDetails.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Tarjeta CV */}
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
                  </div>

                  {/* Tarjeta Entrevista */}
                  {userDetails.interviewCompleted && (
                    <div className="glass-card p-6 mb-8">
                      <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        Interview
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
                          // Get default questions based on user's program
                          const firstQuestion = "What is your motivation for applying to this program and joining Mirai Innovation Research Institute?";
                          const userProgram = userDetails.program || '';
                          let lastQuestion;
                          if (userProgram === 'FUTURE_INNOVATORS_JAPAN') {
                            lastQuestion = "Why do you deserve to be awarded this scholarship?";
                          } else {
                            lastQuestion = "What is your plan to finance your tuition, travel expenses, and accommodation during your stay in Japan?";
                          }
                          const defaultQuestions = [firstQuestion, lastQuestion];
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

                  {/* Reports Section */}
                  {userDetails.reports && userDetails.reports.length > 0 && (
                    <div className="glass-card p-6 mb-8">
                      <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Reports & Feedback ({userDetails.reports.length})
                      </h3>
                      <div className="space-y-4">
                        {userDetails.reports.map((report, idx) => (
                          <ReportItem
                            key={idx}
                            report={report}
                            reportIndex={idx}
                            userId={selectedUser}
                            userName={userDetails.name}
                            onResponseSent={fetchUserDetails}
                          />
                        ))}
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

        {/* Email Modal */}
        {showEmailModal && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => !sendingEmail && setShowEmailModal(false)}
          >
            <div 
              className="glass-card max-w-2xl w-full rounded-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 glass-card bg-white/70 backdrop-blur-xl border-b border-white/40 p-6 flex items-center justify-between z-10">
                <h2 className="text-2xl font-bold text-gray-900">Send Email to All Active Users</h2>
                <button
                  onClick={() => !sendingEmail && setShowEmailModal(false)}
                  disabled={sendingEmail}
                  className="w-10 h-10 rounded-lg bg-gray-100/50 hover:bg-gray-200/70 text-gray-600 flex items-center justify-center transition hover:scale-110 disabled:opacity-50"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6">
                {emailResult && (
                  <div className={`mb-4 p-4 rounded-lg ${
                    emailResult.success 
                      ? 'bg-green-50 border border-green-400 text-green-700' 
                      : 'bg-red-50 border border-red-400 text-red-700'
                  }`}>
                    <p className="font-semibold">{emailResult.message}</p>
                    {emailResult.success && emailResult.totalSent !== undefined && (
                      <p className="text-sm mt-2">
                        Sent to {emailResult.totalSent} out of {emailResult.totalUsers} active users.
                        {emailResult.totalFailed > 0 && ` ${emailResult.totalFailed} failed.`}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      Subject *
                    </label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Email subject..."
                      disabled={sendingEmail}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      Message *
                    </label>
                    <textarea
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      placeholder="Write your message here..."
                      rows={10}
                      disabled={sendingEmail}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none disabled:opacity-50"
                    />
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      onClick={() => {
                        setShowEmailModal(false);
                        setEmailResult(null);
                        setEmailSubject('');
                        setEmailMessage('');
                      }}
                      disabled={sendingEmail}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-all disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSendBulkEmail}
                      disabled={sendingEmail || !emailSubject.trim() || !emailMessage.trim()}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {sendingEmail ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          Sending...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                          Send Email
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
