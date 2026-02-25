import { useState, useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import api from '../utils/axios';

// Component for individual report item with response functionality
const ReportItem = ({ report, reportIndex, userId, userName, onResponseSent }) => {
  const [responseMessage, setResponseMessage] = useState('');
  const [sendingResponse, setSendingResponse] = useState(false);
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [resolving, setResolving] = useState(false);

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

  const handleResolve = async () => {
    if (!confirm('Are you sure you want to mark this report as resolved? It will no longer appear in the notifications.')) {
      return;
    }

    setResolving(true);
    try {
      await api.patch(`/admin/users/${userId}/reports/${reportIndex}/resolve`);
      await onResponseSent(userId);
      alert('Report marked as resolved successfully!');
    } catch (error) {
      alert(error.response?.data?.message || 'Error resolving report');
    } finally {
      setResolving(false);
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
    <div className={`bg-white/40 border border-white/40 p-4 rounded-xl space-y-4 ${report.resolved ? 'opacity-75' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
            report.type === 'problem' ? 'bg-red-100 text-red-700' :
            report.type === 'survey' ? 'bg-blue-100 text-blue-700' :
            'bg-green-100 text-green-700'
          }`}>
            {report.type === 'problem' ? 'Problem' : report.type === 'survey' ? 'Survey' : 'Feedback'}
          </span>
          {report.resolved && (
            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
              ✓ Resolved
            </span>
          )}
          {report.subject && (
            <span className="font-semibold text-gray-900 text-sm">{report.subject}</span>
          )}
        </div>
        <span className="text-xs text-gray-500">
          {formatDate(report.submittedAt)}
        </span>
      </div>
      {report.resolved && report.resolvedAt && (
        <div className="text-xs text-gray-500 mb-2">
          Resolved by {report.resolvedBy || 'Admin'} on {formatDate(report.resolvedAt)}
        </div>
      )}
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
      {!report.resolved && (
        <>
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
            <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
              <button
                onClick={() => setShowResponseForm(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all"
              >
                Respond to Report
              </button>
              <button
                onClick={handleResolve}
                disabled={resolving}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resolving ? 'Resolving...' : 'Mark as Resolved'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const AdminPanel = () => {
  const initialLoadExecutedRef = useRef(false);
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
  const [filterProgram, setFilterProgram] = useState('');
  const [filterAcceptanceLetter, setFilterAcceptanceLetter] = useState(''); // 'sent', 'not-sent', ''
  const [sortBy, setSortBy] = useState(''); // Sort by: 'both', 'cv-only', 'none', 'with-reports'
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState(null);
  const [showAcceptanceLetterModal, setShowAcceptanceLetterModal] = useState(false);
  const [selectedUserIdsForLetter, setSelectedUserIdsForLetter] = useState(new Set());
  const [sendingAcceptanceLetters, setSendingAcceptanceLetters] = useState(false);
  const [acceptanceLetterBulkResult, setAcceptanceLetterBulkResult] = useState(null);
  const [acceptanceLetterProgramType, setAcceptanceLetterProgramType] = useState('MIRI'); // For single user
  const [bulkAcceptanceLetterProgramType, setBulkAcceptanceLetterProgramType] = useState('MIRI'); // For bulk
  const [downloadAllLettersProgramType, setDownloadAllLettersProgramType] = useState('MIRI');
  const [downloadingAllLetters, setDownloadingAllLetters] = useState(false);
  const [invoiceRequests, setInvoiceRequests] = useState([]);
  const [loadingInvoiceRequests, setLoadingInvoiceRequests] = useState(false);
  const [invoiceActionUserId, setInvoiceActionUserId] = useState(null); // userId being approved/rejected
  const [scholarshipPctByUserId, setScholarshipPctByUserId] = useState({}); // { [userId]: "50" }

  useEffect(() => {
    if (initialLoadExecutedRef.current) {
      return;
    }
    initialLoadExecutedRef.current = true;
    fetchUsers();
    fetchStats();
    fetchInvoiceRequests();
  }, []);

  const fetchInvoiceRequests = async () => {
    try {
      setLoadingInvoiceRequests(true);
      const response = await api.get('/admin/invoice-requests');
      setInvoiceRequests(response.data?.pending || []);
    } catch (err) {
      console.error('Error fetching invoice requests:', err);
    } finally {
      setLoadingInvoiceRequests(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      // Solicitar todos los usuarios sin límite de paginación
      const response = await api.get('/admin/users');
      if (response.data && response.data.users) {
        setUsers(response.data.users);
      } else {
        console.error('Unexpected response format:', response.data);
        alert('Error: Formato de respuesta inesperado. Por favor, revisa la consola.');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Error desconocido al obtener usuarios';
      alert(`Error al cargar usuarios: ${errorMessage}\n\nPor favor, verifica:\n1. Que estés autenticado como admin\n2. Que la base de datos esté conectada\n3. Revisa la consola para más detalles`);
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

  const changeUserProgram = async (userId, newProgram) => {
    try {
      await api.patch(`/admin/users/${userId}/program`, { program: newProgram || undefined });
      await fetchUsers();
    } catch (error) {
      alert(error.response?.data?.message || 'Error changing user program');
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
      // Set the program type if it exists, otherwise default to MIRI
      if (response.data.application?.acceptanceLetterProgramType) {
        setAcceptanceLetterProgramType(response.data.application.acceptanceLetterProgramType);
      } else {
        setAcceptanceLetterProgramType('MIRI');
      }
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

  // Filtrar y ordenar usuarios
  let filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !filterRole || user.role === filterRole;
    const matchesStatus = !filterStatus || 
                         (filterStatus === 'active' && user.isActive) ||
                         (filterStatus === 'inactive' && !user.isActive);
    const matchesProgram = !filterProgram || (user.program || '') === filterProgram;
    
    // Filter by acceptance letter status
    const hasAcceptanceLetter = user.acceptanceLetterGeneratedAt !== null && user.acceptanceLetterGeneratedAt !== undefined;
    const matchesAcceptanceLetter = !filterAcceptanceLetter ||
                                   (filterAcceptanceLetter === 'sent' && hasAcceptanceLetter) ||
                                   (filterAcceptanceLetter === 'not-sent' && !hasAcceptanceLetter);
    
    // Filter by score status
    const hasCVScore = user.score !== undefined && user.score !== null;
    const hasInterviewScore = user.interviewScore !== undefined && user.interviewScore !== null;
    
    // Check for unresolved reports
    const hasUnresolvedReports = user.reports && user.reports.some(report => !report.resolved);
    
    if (sortBy === 'both') {
      // Only show users with both CV and Interview scores
      if (!hasCVScore || !hasInterviewScore) return false;
    } else if (sortBy === 'cv-only') {
      // Only show users with CV score but no Interview score
      if (!hasCVScore || hasInterviewScore) return false;
    } else if (sortBy === 'none') {
      // Only show users with no scores
      if (hasCVScore || hasInterviewScore) return false;
    } else if (sortBy === 'with-reports') {
      // Only show users with unresolved reports
      if (!hasUnresolvedReports) return false;
    }
    // If sortBy is empty, show all
    
    return matchesSearch && matchesRole && matchesStatus && matchesProgram && matchesAcceptanceLetter;
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
  } else if (sortBy === 'with-reports') {
    filteredUsers = [...filteredUsers].sort((a, b) => {
      const aUnresolved = a.reports ? a.reports.filter(r => !r.resolved).length : 0;
      const bUnresolved = b.reports ? b.reports.filter(r => !r.resolved).length : 0;
      return bUnresolved - aUnresolved; // Descending order (most reports first)
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
        <div className="glass-card p-5 sm:p-6 md:p-8 mb-6 sm:mb-8 rounded-2xl border border-gray-200/60">
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-1">Email & acceptance letters</h2>
              <p className="text-sm text-gray-500">Notify selected users with an acceptance letter, or send a general email to all active users.</p>
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap gap-4 sm:gap-5 items-stretch sm:items-center">
              {/* Acceptance letter: primary CTA */}
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 items-stretch sm:items-center">
                <button
                  onClick={() => {
                    setAcceptanceLetterBulkResult(null);
                    setSelectedUserIdsForLetter(new Set());
                    setShowAcceptanceLetterModal(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition shadow-sm hover:shadow"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Send acceptance letter to selected
                </button>
                {/* Download all: program + button grouped */}
                <div className="inline-flex flex-wrap gap-2 items-center rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2">
                  <select
                    value={downloadAllLettersProgramType}
                    onChange={(e) => setDownloadAllLettersProgramType(e.target.value)}
                    disabled={downloadingAllLetters}
                    className="bg-transparent border-0 text-gray-700 text-sm font-medium focus:outline-none focus:ring-0 py-1 pr-6 disabled:opacity-50"
                  >
                    <option value="MIRI">MIRI</option>
                    <option value="FIJSE">FIJSE</option>
                  </select>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={async () => {
                      setDownloadingAllLetters(true);
                      try {
                        const response = await api.post('/admin/acceptance-letter/download-all', {
                          programType: downloadAllLettersProgramType,
                        }, { responseType: 'blob' });
                        const url = window.URL.createObjectURL(new Blob([response.data]));
                        const link = document.createElement('a');
                        link.href = url;
                        link.setAttribute('download', `acceptance_letters_${downloadAllLettersProgramType}_${new Date().toISOString().slice(0, 10)}.zip`);
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        window.URL.revokeObjectURL(url);
                        alert('ZIP download started. It may take a moment for large files.');
                      } catch (error) {
                        if (error.response?.data instanceof Blob) {
                          const text = await error.response.data.text();
                          try {
                            const json = JSON.parse(text);
                            alert(json.message || 'Error downloading letters.');
                          } catch {
                            alert('Error downloading letters.');
                          }
                        } else {
                          alert(error.response?.data?.message || 'Error downloading letters.');
                        }
                      } finally {
                        setDownloadingAllLetters(false);
                      }
                    }}
                    disabled={downloadingAllLetters}
                    className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {downloadingAllLetters ? (
                      <>
                        <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Generating…
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download all letters
                      </>
                    )}
                  </button>
                </div>
              </div>
              {/* General email: secondary */}
              <button
                onClick={() => setShowEmailModal(true)}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Send email to all active users
              </button>
            </div>
          </div>
        </div>

        {/* Confirm dates (MIRI) - Pending invoice/date confirmations */}
        <div className="glass-card p-5 sm:p-6 md:p-8 mb-6 sm:mb-8 rounded-2xl border border-gray-200/60">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-1">Confirm dates (MIRI)</h2>
              <p className="text-sm text-gray-500">Review and approve date ranges submitted by MIRI users. Set scholarship % if applicable; then the user can download their invoice.</p>
            </div>
            {loadingInvoiceRequests ? (
              <p className="text-sm text-gray-500">Loading pending requests...</p>
            ) : invoiceRequests.length === 0 ? (
              <p className="text-sm text-gray-500">No pending date confirmations.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-700">Name</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">Email</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">From</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">To</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">Scholarship %</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invoiceRequests.map((row) => {
                      const uid = row.userId?._id || row.userId;
                      const isBusy = invoiceActionUserId === uid;
                      const pct = scholarshipPctByUserId[uid] ?? '';
                      const formatD = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
                      return (
                        <tr key={uid} className="bg-white/60 hover:bg-white/80">
                          <td className="px-4 py-3 text-gray-900">{row.name || '—'}</td>
                          <td className="px-4 py-3 text-gray-700">{row.email || '—'}</td>
                          <td className="px-4 py-3 text-gray-700">{formatD(row.dateRangeStart)}</td>
                          <td className="px-4 py-3 text-gray-700">{formatD(row.dateRangeEnd)}</td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              placeholder="0"
                              value={pct}
                              onChange={(e) => setScholarshipPctByUserId((prev) => ({ ...prev, [uid]: e.target.value }))}
                              className="w-16 rounded border border-gray-300 px-2 py-1 text-center text-sm"
                              disabled={isBusy}
                            />
                          </td>
                          <td className="px-4 py-3 flex flex-wrap gap-2">
                            <button
                              onClick={async () => {
                                setInvoiceActionUserId(uid);
                                try {
                                  const num = pct === '' ? 0 : Math.min(100, Math.max(0, Number(pct)));
                                  await api.patch(`/admin/users/${uid}/invoice-approve`, { scholarshipPercentage: num });
                                  await fetchInvoiceRequests();
                                  setScholarshipPctByUserId((prev) => {
                                    const next = { ...prev };
                                    delete next[uid];
                                    return next;
                                  });
                                  alert('Approved. The user can now download their invoice.');
                                } catch (err) {
                                  alert(err.response?.data?.message || 'Error approving.');
                                } finally {
                                  setInvoiceActionUserId(null);
                                }
                              }}
                              disabled={isBusy}
                              className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-50"
                            >
                              {isBusy ? '…' : 'Approve'}
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm('Reject this date confirmation? The user can submit new dates.')) return;
                                setInvoiceActionUserId(uid);
                                try {
                                  await api.patch(`/admin/users/${uid}/invoice-reject`);
                                  await fetchInvoiceRequests();
                                  setScholarshipPctByUserId((prev) => {
                                    const next = { ...prev };
                                    delete next[uid];
                                    return next;
                                  });
                                  alert('Rejected.');
                                } catch (err) {
                                  alert(err.response?.data?.message || 'Error rejecting.');
                                } finally {
                                  setInvoiceActionUserId(null);
                                }
                              }}
                              disabled={isBusy}
                              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Tabla de Usuarios - Contenedor de Cristal */}
        <div className="glass-card p-4 sm:p-6 md:p-8 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Users</h2>
            <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={async () => {
                    try {
                      const response = await api.get('/admin/export-users?format=xlsx', {
                        responseType: 'blob'
                      });
                      const url = window.URL.createObjectURL(new Blob([response.data]));
                      const link = document.createElement('a');
                      const fileName = `users_export_${new Date().toISOString().split('T')[0]}.xlsx`;
                      link.href = url;
                      link.setAttribute('download', fileName);
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      window.URL.revokeObjectURL(url);
                    } catch (error) {
                      console.error('Error downloading file:', error);
                      // Si el error tiene un mensaje del servidor, mostrarlo
                      if (error.response?.data) {
                        // Si es un blob, intentar leerlo como texto
                        if (error.response.data instanceof Blob) {
                          error.response.data.text().then(text => {
                            try {
                              const jsonError = JSON.parse(text);
                              alert(jsonError.message || 'Error downloading file. Please try again.');
                            } catch (e) {
                              alert('Error downloading file. Please try again.');
                            }
                          });
                        } else {
                          alert(error.response.data.message || 'Error downloading file. Please try again.');
                        }
                      } else {
                        alert('Error downloading file. Please try again.');
                      }
                    }
                  }}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-2 px-4 rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center gap-2 text-sm"
                  title="Download as Excel"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Excel
                </button>
                <button
                  onClick={async () => {
                    try {
                      const response = await api.get('/admin/export-users?format=csv', {
                        responseType: 'blob'
                      });
                      const url = window.URL.createObjectURL(new Blob([response.data]));
                      const link = document.createElement('a');
                      const fileName = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
                      link.href = url;
                      link.setAttribute('download', fileName);
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      window.URL.revokeObjectURL(url);
                    } catch (error) {
                      console.error('Error downloading file:', error);
                      // Si el error tiene un mensaje del servidor, mostrarlo
                      if (error.response?.data) {
                        // Si es un blob, intentar leerlo como texto
                        if (error.response.data instanceof Blob) {
                          error.response.data.text().then(text => {
                            try {
                              const jsonError = JSON.parse(text);
                              alert(jsonError.message || 'Error downloading file. Please try again.');
                            } catch (e) {
                              alert('Error downloading file. Please try again.');
                            }
                          });
                        } else {
                          alert(error.response.data.message || 'Error downloading file. Please try again.');
                        }
                      } else {
                        alert('Error downloading file. Please try again.');
                      }
                    }
                  }}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center gap-2 text-sm"
                  title="Download as CSV"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  CSV
                </button>
          </div>
          </div>

          {/* Filters - single section, wraps inside card */}
          <div className="w-full border-t border-white/20 pt-4">
            <p className="text-sm font-medium text-gray-600 mb-3">Filters</p>
            <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="glass-card bg-white/40 border border-white/40 px-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[180px] flex-1 max-w-xs"
              />
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="glass-card bg-white/40 border border-white/40 px-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-0"
              >
                <option value="">All Roles</option>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="glass-card bg-white/40 border border-white/40 px-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-0"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <select
                value={filterProgram}
                onChange={(e) => setFilterProgram(e.target.value)}
                className="glass-card bg-white/40 border border-white/40 px-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-0"
              >
                <option value="">All Programs</option>
                <option value="MIRI">MIRI</option>
                <option value="EMFUTECH">EMFUTECH</option>
                <option value="JCTI">JCTI</option>
                <option value="MIRAITEACH">MIRAITEACH</option>
                <option value="FUTURE_INNOVATORS_JAPAN">FUTURE_INNOVATORS_JAPAN</option>
                <option value="OTHER">OTHER</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="glass-card bg-white/40 border border-white/40 px-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-0"
              >
                <option value="">All Scores</option>
                <option value="both">CV + Interview Scores</option>
                <option value="cv-only">CV Score Only</option>
                <option value="none">No Scores</option>
                <option value="with-reports">With Unresolved Reports</option>
              </select>
              <select
                value={filterAcceptanceLetter}
                onChange={(e) => setFilterAcceptanceLetter(e.target.value)}
                className="glass-card bg-white/40 border border-white/40 px-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-0"
              >
                <option value="">All Acceptance Letters</option>
                <option value="sent">Letter Sent</option>
                <option value="not-sent">Letter Not Sent</option>
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
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700">Program</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700">Score</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700">Reports</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700">Acceptance Letter</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {users.length === 0 ? 'No hay usuarios en la base de datos' : 'No se encontraron usuarios'}
                        </h3>
                        <p className="text-gray-600 mb-4">
                          {users.length === 0 
                            ? 'Parece que no hay usuarios registrados o hay un problema con la conexión a la base de datos.'
                            : 'Intenta ajustar los filtros de búsqueda.'}
                        </p>
                        {users.length === 0 && (
                          <button
                            onClick={fetchUsers}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all"
                          >
                            Reintentar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                  // Only count unresolved reports for notifications
                  const unresolvedReports = user.reports ? user.reports.filter(report => !report.resolved) : [];
                  const hasReports = unresolvedReports.length > 0;
                  const reportsCount = unresolvedReports.length;
                  
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
                      <select
                        value={user.program || ''}
                        onChange={(e) => changeUserProgram(user._id, e.target.value)}
                        className="glass-card bg-white/40 border border-white/40 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition min-w-0 max-w-[180px]"
                      >
                        <option value="">—</option>
                        <option value="MIRI">MIRI</option>
                        <option value="EMFUTECH">EMFUTECH</option>
                        <option value="JCTI">JCTI</option>
                        <option value="MIRAITEACH">MIRAITEACH</option>
                        <option value="FUTURE_INNOVATORS_JAPAN">FUTURE_INNOVATORS_JAPAN</option>
                        <option value="OTHER">OTHER</option>
                      </select>
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
                      {user.acceptanceLetterGeneratedAt ? (
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center gap-1.5 bg-green-100/70 text-green-700 border border-green-300 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Sent
                          </span>
                          {user.acceptanceLetterProgramType && (
                            <span className="text-xs text-gray-600">
                              {user.acceptanceLetterProgramType === 'FIJSE' ? 'FIJSE' : 'MIRI'}
                            </span>
                          )}
                          <span className="text-xs text-gray-500">
                            {new Date(user.acceptanceLetterGeneratedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 bg-gray-100/70 text-gray-600 border border-gray-300 rounded-full px-2.5 py-1 text-xs font-semibold">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Not Sent
                        </span>
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
                  })
                )}
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
                  {/* Basic Information - Always Visible */}
                  <div className="glass-card p-6 mb-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Basic Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <DataCard label="Email" value={userDetails.email} />
                      <DataCard label="Program" value={userDetails.program || 'N/A'} />
                      <DataCard label="Academic Level" value={userDetails.academic_level || 'N/A'} />
                      <DataCard label="Digital ID" value={userDetails.digitalId || 'N/A'} />
                    </div>
                  </div>

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
                    {userDetails.application && (
                      <button
                        onClick={() => setActiveTab('screening')}
                        className={`px-6 py-3 rounded-t-xl font-semibold transition-all duration-300 whitespace-nowrap ${
                          activeTab === 'screening'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                            : 'text-gray-500 hover:bg-white/40'
                        }`}
                      >
                        Screening & Acceptance
                      </button>
                    )}
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
                    <button
                      onClick={() => setActiveTab('reports')}
                      className={`px-6 py-3 rounded-t-xl font-semibold transition-all duration-300 whitespace-nowrap ${
                        activeTab === 'reports'
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                          : 'text-gray-500 hover:bg-white/40'
                      }`}
                    >
                      Reports &amp; Feedback
                      {userDetails.reports?.length > 0 && (
                        <span className="ml-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-orange-500 text-white text-xs font-bold">
                          {userDetails.reports.filter(r => !r.resolved).length || userDetails.reports.length}
                        </span>
                      )}
                    </button>
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

                  {activeTab === 'screening' && (
                    <div className="space-y-6">
                      {/* Screening Interview Status */}
                      <div className="glass-card p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Screening Interview
                        </h3>
                        {userDetails.application?.scheduledMeeting?.dateTime ? (
                          <div className="flex items-center gap-2 text-green-700">
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-100 font-medium">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Scheduled
                            </span>
                            <span className="text-gray-700">
                              {new Date(userDetails.application.scheduledMeeting.dateTime).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-amber-700">
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-100 font-medium">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Not scheduled yet
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Generate Acceptance Letter */}
                      <div className="glass-card p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Acceptance Letter
                        </h3>
                        {userDetails.application?.acceptanceLetterGeneratedAt && (
                          <div className="mb-4 p-4 rounded-xl bg-green-50 border border-green-200 flex items-center gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-green-800">Letter ready — User can download</p>
                              <p className="text-sm text-green-700">
                                Program: {userDetails.application.acceptanceLetterProgramType === 'FIJSE' ? 'Future Innovators Japan Selection Entry' : 'MIRI'} · Released on {new Date(userDetails.application.acceptanceLetterGeneratedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                              </p>
                            </div>
                          </div>
                        )}
                        <p className="text-gray-600 mb-4">
                          Generate and download the official acceptance letter PDF, or notify the user by email so they can download it from their dashboard.
                        </p>
                        <div className="mb-4">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Select Program:
                          </label>
                          <select
                            value={acceptanceLetterProgramType}
                            onChange={(e) => setAcceptanceLetterProgramType(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            <option value="MIRI">MIRI (Mirai Innovation Research Immersion Program)</option>
                            <option value="FIJSE">Future Innovators Japan Selection Entry</option>
                          </select>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={async () => {
                              try {
                                const response = await api.get(`/admin/users/${selectedUser}/acceptance-letter?programType=${acceptanceLetterProgramType}`, {
                                  responseType: 'blob'
                                });
                                const disposition = response.headers['content-disposition'];
                                const fileNameMatch = disposition?.match(/filename="?([^"]+)"?/);
                                const fileName = fileNameMatch?.[1] || `Acceptance_Letter_${selectedUser}.pdf`;
                                const url = window.URL.createObjectURL(new Blob([response.data]));
                                const link = document.createElement('a');
                                link.href = url;
                                link.setAttribute('download', fileName);
                                document.body.appendChild(link);
                                link.click();
                                link.remove();
                                window.URL.revokeObjectURL(url);
                                await fetchUserDetails(selectedUser);
                              } catch (error) {
                                if (error.response?.data instanceof Blob) {
                                  error.response.data.text().then((text) => {
                                    try {
                                      const jsonError = JSON.parse(text);
                                      alert(jsonError.message || 'Error generating PDF.');
                                    } catch {
                                      alert('Error generating acceptance letter PDF.');
                                    }
                                  });
                                } else {
                                  alert(error.response?.data?.message || 'Error generating acceptance letter PDF.');
                                }
                              }
                            }}
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Generate &amp; Download PDF
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await api.post(`/admin/users/${selectedUser}/acceptance-letter/notify`, {
                                  programType: acceptanceLetterProgramType
                                });
                                await fetchUserDetails(selectedUser);
                                alert('Notification sent. The user will receive an email and can download their acceptance letter from the dashboard.');
                              } catch (error) {
                                alert(error.response?.data?.message || 'Error sending notification.');
                              }
                            }}
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Notify User by Email
                          </button>
                        </div>
                      </div>
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

                  {activeTab === 'reports' && (
                    <div className="glass-card p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Reports &amp; Feedback {userDetails.reports?.length > 0 && `(${userDetails.reports.length})`}
                      </h3>
                      {userDetails.reports && userDetails.reports.length > 0 ? (
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
                      ) : (
                        <p className="text-gray-500 py-8 text-center">No reports or feedback from this user.</p>
                      )}
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

        {/* Send Acceptance Letter to Selected Users Modal */}
        {showAcceptanceLetterModal && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => !sendingAcceptanceLetters && setShowAcceptanceLetterModal(false)}
          >
            <div
              className="glass-card max-w-2xl w-full max-h-[90vh] flex flex-col rounded-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 glass-card bg-white/70 backdrop-blur-xl border-b border-white/40 p-6 flex items-center justify-between z-10 rounded-t-3xl">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Send Acceptance Letter to Selected Users</h2>
                <button
                  onClick={() => !sendingAcceptanceLetters && setShowAcceptanceLetterModal(false)}
                  disabled={sendingAcceptanceLetters}
                  className="w-10 h-10 rounded-lg bg-gray-100/50 hover:bg-gray-200/70 text-gray-600 flex items-center justify-center transition hover:scale-110 disabled:opacity-50"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 overflow-hidden flex flex-col flex-1 min-h-0">
                {acceptanceLetterBulkResult && (
                  <div className={`mb-4 p-4 rounded-lg ${
                    acceptanceLetterBulkResult.failed === 0 && acceptanceLetterBulkResult.sent > 0
                      ? 'bg-green-50 border border-green-400 text-green-700'
                      : acceptanceLetterBulkResult.sent > 0
                        ? 'bg-amber-50 border border-amber-400 text-amber-800'
                        : 'bg-red-50 border border-red-400 text-red-700'
                  }`}>
                    <p className="font-semibold">{acceptanceLetterBulkResult.message}</p>
                    <p className="text-sm mt-2">
                      Notified: {acceptanceLetterBulkResult.sent} · Failed: {acceptanceLetterBulkResult.failed}
                    </p>
                  </div>
                )}

                <p className="text-sm text-gray-600 mb-3">
                  Select users. When you press &quot;Send&quot;, their acceptance letter will be marked as ready and they will receive an email to download it (regardless of application status).
                </p>

                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Select Program:
                  </label>
                  <select
                    value={bulkAcceptanceLetterProgramType}
                    onChange={(e) => setBulkAcceptanceLetterProgramType(e.target.value)}
                    disabled={sendingAcceptanceLetters}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
                  >
                    <option value="MIRI">MIRI (Mirai Innovation Research Immersion Program)</option>
                    <option value="FIJSE">Future Innovators Japan Selection Entry</option>
                  </select>
                </div>

                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setSelectedUserIdsForLetter(new Set(users.map((u) => u._id)))}
                    disabled={sendingAcceptanceLetters || users.length === 0}
                    className="px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-medium disabled:opacity-50"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedUserIdsForLetter(new Set())}
                    disabled={sendingAcceptanceLetters}
                    className="px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-medium disabled:opacity-50"
                  >
                    Deselect all
                  </button>
                  <span className="text-sm text-gray-600 self-center ml-2">
                    {selectedUserIdsForLetter.size} selected
                  </span>
                </div>

                <div className="border border-gray-200 rounded-xl overflow-auto flex-1 min-h-[200px] max-h-[40vh] bg-white/40">
                  {users.length === 0 ? (
                    <p className="p-4 text-gray-500 text-center">No users loaded.</p>
                  ) : (
                    <ul className="divide-y divide-gray-200">
                      {users.map((user) => (
                        <li key={user._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/50">
                          <input
                            type="checkbox"
                            id={`letter-${user._id}`}
                            checked={selectedUserIdsForLetter.has(user._id)}
                            onChange={(e) => {
                              const next = new Set(selectedUserIdsForLetter);
                              if (e.target.checked) next.add(user._id);
                              else next.delete(user._id);
                              setSelectedUserIdsForLetter(next);
                            }}
                            disabled={sendingAcceptanceLetters}
                            className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <label htmlFor={`letter-${user._id}`} className="flex-1 cursor-pointer text-sm text-gray-800 truncate">
                            <span className="font-medium">{user.name}</span>
                            <span className="text-gray-500 ml-2">{user.email}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex gap-4 pt-4 mt-4 border-t border-white/40">
                  <button
                    onClick={() => {
                      setShowAcceptanceLetterModal(false);
                      setAcceptanceLetterBulkResult(null);
                      setSelectedUserIdsForLetter(new Set());
                      setBulkAcceptanceLetterProgramType('MIRI');
                    }}
                    disabled={sendingAcceptanceLetters}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (selectedUserIdsForLetter.size === 0) {
                        alert('Select at least one user.');
                        return;
                      }
                      setSendingAcceptanceLetters(true);
                      setAcceptanceLetterBulkResult(null);
                      try {
                        const response = await api.post('/admin/acceptance-letter/notify-bulk', {
                          userIds: Array.from(selectedUserIdsForLetter),
                          programType: bulkAcceptanceLetterProgramType,
                        });
                        setAcceptanceLetterBulkResult(response.data);
                      } catch (error) {
                        setAcceptanceLetterBulkResult({
                          message: error.response?.data?.message || 'Error sending acceptance letters.',
                          sent: 0,
                          skipped: 0,
                          failed: selectedUserIdsForLetter.size,
                        });
                      } finally {
                        setSendingAcceptanceLetters(false);
                      }
                    }}
                    disabled={sendingAcceptanceLetters || selectedUserIdsForLetter.size === 0}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold py-3 px-6 rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {sendingAcceptanceLetters ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Send to {selectedUserIdsForLetter.size} user{selectedUserIdsForLetter.size !== 1 ? 's' : ''}
                      </>
                    )}
                  </button>
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
