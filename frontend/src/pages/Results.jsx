import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../utils/axios';
import { AuthContext } from '../contexts/AuthContext';
import cvIcon from '../assets/cv.png';
import interviewIcon from '../assets/interview.png';

// Función para formatear markdown básico a HTML
const formatMarkdown = (text) => {
  if (!text) return '';
  
  const lines = text.split('\n');
  let html = '';
  let inList = false;
  let listItems = [];
  let currentParagraph = [];
  
  const closeList = () => {
    if (inList && listItems.length > 0) {
      html += '<ul class="list-disc list-inside space-y-1 my-3 ml-4">';
      listItems.forEach(item => {
        html += `<li class="mb-1">${item}</li>`;
      });
      html += '</ul>';
      listItems = [];
      inList = false;
    }
  };
  
  const closeParagraph = () => {
    if (currentParagraph.length > 0) {
      let content = currentParagraph.join(' ').trim();
      // Procesar negritas
      content = content.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>');
      if (content) {
        html += `<p class="mb-3">${content}</p>`;
      }
      currentParagraph = [];
    }
  };
  
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    
    // Línea vacía - cerrar lista y párrafo
    if (!trimmed) {
      closeList();
      closeParagraph();
      return;
    }
    
    // Encabezados ###
    if (trimmed.startsWith('### ')) {
      closeList();
      closeParagraph();
      const content = trimmed.substring(4).trim();
      html += `<h3 class="text-lg font-bold text-gray-900 mt-4 mb-2">${content}</h3>`;
      return;
    }
    
    // Encabezados ####
    if (trimmed.startsWith('#### ')) {
      closeList();
      closeParagraph();
      const content = trimmed.substring(5).trim();
      html += `<h4 class="text-base font-semibold text-gray-800 mt-3 mb-2">${content}</h4>`;
      return;
    }
    
    // Lista con -
    if (trimmed.startsWith('- ')) {
      closeParagraph();
      if (!inList) {
        closeList();
        inList = true;
      }
      let content = trimmed.substring(2).trim();
      // Procesar negritas dentro de la lista
      content = content.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>');
      listItems.push(content);
      return;
    }
    
    // Lista numerada 1. 2. etc.
    const numberedMatch = trimmed.match(/^\d+\. (.+)$/);
    if (numberedMatch) {
      closeParagraph();
      if (!inList) {
        closeList();
        inList = true;
      }
      let content = numberedMatch[1].trim();
      // Procesar negritas dentro de la lista
      content = content.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>');
      listItems.push(content);
      return;
    }
    
    // Párrafo normal - acumular líneas
    closeList();
    currentParagraph.push(trimmed);
  });
  
  // Cerrar lista y párrafo si quedan abiertos al final
  closeList();
  closeParagraph();
  
  return html;
};

// Componente de gráfico circular de progreso
const CircularProgress = ({ percentage, size = 150, color = 'blue' }) => {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  const gradientColors = {
    blue: { from: '#3B82F6', to: '#8B5CF6' },
    green: { from: '#10B981', to: '#3B82F6' },
    purple: { from: '#8B5CF6', to: '#EC4899' }
  };

  const colors = gradientColors[color] || gradientColors.blue;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth="12"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#gradient-${color})`}
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
        <defs>
          <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.from} />
            <stop offset="100%" stopColor={colors.to} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <span className={`text-4xl font-bold bg-gradient-to-r ${color === 'blue' ? 'from-blue-600 to-purple-600' : color === 'green' ? 'from-green-600 to-blue-600' : 'from-purple-600 to-pink-600'} bg-clip-text text-transparent`}>
            {percentage}%
          </span>
        </div>
      </div>
    </div>
  );
};

const Results = () => {
  const [profile, setProfile] = useState(null);
  const [interviewData, setInterviewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchProfile();
    fetchInterviewData();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/users/profile');
      setProfile(response.data);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const fetchInterviewData = async () => {
    try {
      const response = await api.get('/users/interview-responses');
      setInterviewData(response.data);
    } catch (error) {
      // Interview not completed yet, that's okay
    }
  };

  const handleResetAll = async () => {
    setResetting(true);
    setResetError('');
    
    try {
      // Reset only interview data, keep CV
      await api.post('/users/reset-interview-only');
      // Refresh profile data
      await fetchProfile();
      await fetchInterviewData();
      setShowResetConfirm(false);
      // Redirect to interview page automatically
      window.location.href = '/interview';
    } catch (error) {
      setResetError(error.response?.data?.message || 'Error resetting interview data. Please try again.');
    } finally {
      setResetting(false);
    }
  };

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

  const cvScore = profile?.score || 0;
  const interviewScore = profile?.interviewScore || 0;
  const skills = profile?.skills || [];
  const interviewAnalysis = profile?.interviewAnalysis || [];

  return (
    <div className="min-h-screen bg-mesh-gradient">
      {/* Ambient Orbs */}
      <div className="ambient-orb-1"></div>
      <div className="ambient-orb-2"></div>
      <div className="ambient-orb-3"></div>
      
      <Navbar />
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Summary</h1>
          <p className="text-gray-600">View your skill analysis results based on your CV and your answers to the interview</p>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 auto-rows-min">
          
          {/* CV Analysis Card - Large */}
          <div className="lg:col-span-6 glass-card p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                <img 
                  src={cvIcon} 
                  alt="CV Analysis" 
                  className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
                />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">CV Analysis</h2>
                <p className="text-sm text-gray-600">Resume evaluation results</p>
              </div>
            </div>

            {profile?.cvAnalyzed ? (
              <div className="space-y-6">
                {/* Score Display - Solo mostrar si es admin */}
                {isAdmin && (
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="flex-shrink-0">
                      <CircularProgress percentage={cvScore} size={150} color="blue" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-600">Overall Score</span>
                          <span className="text-2xl font-bold text-blue-600">{cvScore}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className="bg-gradient-to-r from-blue-600 to-purple-600 h-3 rounded-full transition-all duration-1000"
                            style={{ width: `${cvScore}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          cvScore >= 80 ? 'bg-green-100 text-green-700' :
                          cvScore >= 60 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {cvScore >= 80 ? 'Excellent' : cvScore >= 60 ? 'Good' : 'Needs Improvement'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Skills Section */}
                {skills.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Identified Skills ({skills.length})</h3>
                    <div className="flex flex-wrap gap-2">
                      {skills.slice(0, 10).map((skill, index) => (
                        <span
                          key={index}
                          className="px-3 py-1.5 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg text-sm font-medium text-gray-700"
                        >
                          {skill}
                        </span>
                      ))}
                      {skills.length > 10 && (
                        <span className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm font-medium text-gray-600">
                          +{skills.length - 10} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Analysis Text */}
                {profile?.analysis && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Analysis Summary</h3>
                    <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
                      {profile.analysis}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-600 mb-4">CV analysis not completed yet</p>
                <Link
                  to="/cv-upload"
                  className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  Upload & Analyze CV
                </Link>
              </div>
            )}
          </div>

          {/* Interview Results Card - Large */}
          <div className="lg:col-span-6 glass-card p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
                <img 
                  src={interviewIcon} 
                  alt="Interview" 
                  className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
                />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Interview Summary</h2>
                <p className="text-sm text-gray-600">Video interview evaluation</p>
              </div>
            </div>

            {profile?.interviewCompleted ? (
              <div className="space-y-6">
                {/* Score Display - Solo mostrar si es admin */}
                {isAdmin && (
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="flex-shrink-0">
                      <CircularProgress percentage={interviewScore} size={150} color="green" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-600">Overall Score</span>
                          <span className="text-2xl font-bold text-green-600">{interviewScore}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className="bg-gradient-to-r from-green-600 to-blue-600 h-3 rounded-full transition-all duration-1000"
                            style={{ width: `${interviewScore}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          interviewScore >= 80 ? 'bg-green-100 text-green-700' :
                          interviewScore >= 60 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {interviewScore >= 80 ? 'Excellent' : interviewScore >= 60 ? 'Good' : 'Needs Improvement'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mensaje de agradecimiento y próximos pasos */}
                {profile?.interviewCompleted && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Thank You for Completing Your Interview!</h3>
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border-l-4 border-purple-500">
                      <div className="text-sm text-gray-700 leading-relaxed space-y-3">
                        <p className="mb-3">
                          Thank you for completing your interview with <strong className="font-semibold text-gray-900">Mirai Innovation Research Institute</strong>. We appreciate the time and effort you invested in this process.
                        </p>
                        <div className="bg-white/60 p-4 rounded-lg border border-purple-200">
                          <p className="font-semibold text-gray-900 mb-2">📢 Coming Soon:</p>
                          <ul className="list-disc list-inside space-y-2 ml-2">
                            <li><strong className="font-semibold">Personalized Recommendations:</strong> Detailed analysis and improvement suggestions based on your interview performance.</li>
                            <li><strong className="font-semibold">Exclusive Webinars:</strong> Professional development webinars with certificates for all participants, brought to you by Mirai Innovation Research Institute.</li>
                          </ul>
                        </div>
                        <p className="mt-3 text-gray-600 italic">
                          Please stay tuned for updates! We will notify you via email when these resources become available.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Interview Analysis and Recommendations - COMENTADO TEMPORALMENTE */}
                {/* 
                {(interviewData?.recommendations || profile?.interviewRecommendations) && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Performance Analysis & Recommendations</h3>
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border-l-4 border-purple-500">
                      <div 
                        className="text-sm text-gray-700 leading-relaxed"
                        dangerouslySetInnerHTML={{ 
                          __html: formatMarkdown(interviewData?.recommendations || profile?.interviewRecommendations) 
                        }}
                      />
                    </div>
                  </div>
                )}
                */}

                {/* Video Link */}
                {profile?.interviewVideo && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Interview Video</h3>
                    <a
                      href={profile.interviewVideo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Watch Self-Introduction Video
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-gray-600 mb-4">Interview not completed yet</p>
                {profile?.cvAnalyzed ? (
                  <Link
                    to="/interview"
                    className="inline-block bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    Start Interview
                  </Link>
                ) : (
                  <p className="text-sm text-gray-500">Complete CV analysis first</p>
                )}
              </div>
            )}
          </div>

          {/* Overall Summary Card - Full Width */}
          {(profile?.cvAnalyzed || profile?.interviewCompleted) && (
            <div className="lg:col-span-12 glass-card p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Overall Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">CV Analysis Status</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {profile?.cvAnalyzed ? 'Completed' : 'Pending'}
                      </p>
                    </div>
                    {profile?.cvAnalyzed && (
                      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Interview Status</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {profile?.interviewCompleted ? 'Completed' : 'Pending'}
                      </p>
                    </div>
                    {profile?.interviewCompleted && (
                      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  {isAdmin && (
                    <div className="p-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg text-white">
                      <p className="text-sm opacity-90 mb-1">Average Score</p>
                      <p className="text-3xl font-bold">
                        {profile?.cvAnalyzed && profile?.interviewCompleted
                          ? Math.round((cvScore + interviewScore) / 2)
                          : profile?.cvAnalyzed
                          ? cvScore
                          : interviewScore}
                        %
                      </p>
                    </div>
                  )}
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <Link
                        to="/dashboard"
                        className="flex-1 text-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-all duration-300"
                      >
                        Back to Dashboard
                      </Link>
                      {!profile?.cvAnalyzed && (
                        <Link
                          to="/cv-upload"
                          className="flex-1 text-center bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl"
                        >
                          Upload CV
                        </Link>
                      )}
                      {profile?.cvAnalyzed && !profile?.interviewCompleted && (
                        <Link
                          to="/interview"
                          className="flex-1 text-center bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl"
                        >
                          Start Interview
                        </Link>
                      )}
                    </div>
                    
                    {/* Retake Interview Button - Show only if both CV and Interview are completed */}
                    {profile?.cvAnalyzed && profile?.interviewCompleted && (
                      <button
                        onClick={() => setShowResetConfirm(true)}
                        className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Retake Interview
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card bg-white/90 backdrop-blur-xl border border-white/40 rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Retake Interview</h2>
            <p className="text-gray-600 mb-4">
              Are you sure you want to retake the interview? This will reset:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-6 space-y-2">
              <li>All interview responses</li>
              <li>Interview video and transcription</li>
              <li>Interview scores and analysis</li>
            </ul>
            
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6 rounded">
              <p className="text-blue-800 text-sm font-semibold">ℹ️ Note</p>
              <p className="text-blue-700 text-sm">Your CV and CV analysis will be kept. You will be redirected to start the interview again.</p>
            </div>

            {resetError && (
              <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {resetError}
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetError('');
                }}
                disabled={resetting}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl px-6 py-3 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleResetAll}
                disabled={resetting}
                className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-xl px-6 py-3 font-bold shadow-xl hover:shadow-2xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetting ? 'Resetting...' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Results;
