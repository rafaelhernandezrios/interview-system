import { useState, useEffect, useRef, useContext } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../utils/axios';
import { AuthContext } from '../contexts/AuthContext';
import cvIcon from '../assets/cv.png';
import interviewIcon from '../assets/interview.png';

// Componente de gráfico circular de progreso
const CircularProgress = ({ percentage, size = 200 }) => {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Círculo de fondo */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth="12"
          fill="none"
        />
        {/* Círculo de progreso */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#gradient)"
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
      </svg>
      {/* Porcentaje en el centro */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <span className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            {percentage}%
          </span>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchProfile();
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

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);

      const response = await api.post('/users/upload-photo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Actualizar el perfil con la nueva foto
      setProfile({ ...profile, profilePhoto: response.data.profilePhoto });
    } catch (error) {
      alert('Error uploading photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Calculate overall progress
  const calculateProgress = () => {
    if (!profile) return 0;
    let completed = 0;
    const total = 2;
    
    if (profile.cvAnalyzed) completed++;
    if (profile.interviewCompleted) completed++;
    
    return Math.round((completed / total) * 100);
  };

  const overallProgress = calculateProgress();

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
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-7xl">
        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 auto-rows-min">
          
          {/* Your Journey Card - Large (spans 2 columns) */}
          <div className="lg:col-span-5 glass-card p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Your Journey</h2>
            <div className="flex flex-col items-center justify-center py-4 sm:py-8">
              <div className="hidden sm:block">
                <CircularProgress percentage={overallProgress} size={200} />
              </div>
              <div className="block sm:hidden">
                <CircularProgress percentage={overallProgress} size={150} />
              </div>
              <div className="mt-8 w-full space-y-4 px-4">
                <div className="flex items-center gap-3 relative">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    profile?.cvAnalyzed ? 'bg-blue-500' : 'bg-gray-300'
                  }`}>
                    {profile?.cvAnalyzed && (
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className="text-gray-700 font-medium flex-1">CV Analysis</span>
                  <div className="flex-1 border-t border-dashed border-gray-300 mx-3"></div>
                  <span className={`text-sm flex-shrink-0 ${
                    profile?.cvAnalyzed ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {profile?.cvAnalyzed ? '(Done)' : '(Pending)'}
                  </span>
                </div>
                <div className="flex items-center gap-3 relative">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    profile?.interviewCompleted ? 'bg-blue-500' : 'bg-gray-300'
                  }`}>
                    {profile?.interviewCompleted && (
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className="text-gray-700 font-medium flex-1">Interview</span>
                  <div className="flex-1 border-t border-dashed border-gray-300 mx-3"></div>
                  <span className={`text-sm flex-shrink-0 ${
                    profile?.interviewCompleted ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {profile?.interviewCompleted ? '(Done)' : '(Pending)'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* CV Analysis Card */}
          <div className="lg:col-span-3 glass-card group cursor-pointer hover:scale-[1.02] transition-transform duration-300 p-4 sm:p-6">
            <Link to="/cv-upload" className="block h-full">
              <div className="flex flex-col h-full">
                <div className="flex items-start justify-between mb-4 sm:mb-6">
                  <div className="flex-1">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">CV Analysis</h3>
                    <p className="text-xs sm:text-sm text-gray-600">Upload and analyze your CV</p>
                  </div>
                  <div className="flex-shrink-0 mb-4">
                    <img 
                      src={cvIcon} 
                      alt="CV Analysis" 
                      className="w-16 h-16 sm:w-24 sm:h-24 object-contain drop-shadow-xl"
                      style={{ 
                        filter: 'drop-shadow(0 20px 25px rgba(34, 197, 94, 0.4)) drop-shadow(0 10px 10px rgba(34, 197, 94, 0.2))'
                      }}
                    />
                  </div>
                </div>
                {profile?.cvAnalyzed ? (
                  <div className="mt-auto space-y-4">
                    <div className="relative">
                      <div className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                        100%
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">
                      {profile?.skills?.length || 0} skills identified
                    </p>
                    <button className="w-full bg-gradient-to-r from-blue-600 via-blue-700 to-purple-600 hover:from-blue-700 hover:via-blue-800 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl mb-2 transform hover:scale-[1.02]">
                      View Details
                    </button>
                  </div>
                ) : (
                  <div className="mt-auto">
                    <button className="w-full bg-gradient-to-r from-blue-600 via-blue-700 to-purple-600 hover:from-blue-700 hover:via-blue-800 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl mb-2 transform hover:scale-[1.02]">
                      Start Now
                    </button>
                  </div>
                )}
              </div>
            </Link>
          </div>

          {/* Interview Card */}
          <div className="lg:col-span-4 glass-card group cursor-pointer hover:scale-[1.02] transition-transform duration-300 p-4 sm:p-6">
            <Link to={profile?.interviewCompleted ? "/results" : (profile?.cvAnalyzed ? "/interview" : "/cv-upload")} className="block h-full">
              <div className="flex flex-col h-full">
                <div className="flex items-start justify-between mb-4 sm:mb-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900">Interview</h3>
                      {profile?.interviewCompleted ? (
                        <span className="bg-green-100 text-green-600 px-2 py-1 rounded-full text-xs font-semibold">
                          ✓ Completed
                        </span>
                      ) : (
                        <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded-full text-xs font-semibold">
                          • Pending
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600">
                      {profile?.interviewCompleted ? 'View your interview results' : 'Answer personalized questions'}
                    </p>
                  </div>
                  <div className="flex-shrink-0 mb-4">
                    <img 
                      src={interviewIcon} 
                      alt="Interview" 
                      className="w-16 h-16 sm:w-24 sm:h-24 object-contain drop-shadow-xl"
                      style={{ 
                        filter: 'drop-shadow(0 20px 25px rgba(147, 51, 234, 0.4)) drop-shadow(0 10px 10px rgba(147, 51, 234, 0.2))'
                      }}
                    />
                  </div>
                </div>
                <div className="mt-auto">
                  {profile?.interviewCompleted ? (
                    <Link to="/results">
                      <button className="w-full bg-gradient-to-r from-green-600 via-green-700 to-emerald-600 hover:from-green-700 hover:via-green-800 hover:to-emerald-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 mb-2 transform hover:scale-[1.02]">
                        View Results
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </Link>
                  ) : profile?.cvAnalyzed ? (
                    <button className="w-full bg-gradient-to-r from-purple-600 via-purple-700 to-blue-600 hover:from-purple-700 hover:via-purple-800 hover:to-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 mb-2 transform hover:scale-[1.02]">
                      Start Interview Now
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ) : (
                    <button className="w-full bg-gray-300 text-gray-600 font-semibold py-3 px-4 rounded-lg cursor-not-allowed mb-2">
                      Complete CV First
                    </button>
                  )}
                </div>
              </div>
            </Link>
          </div>

          {/* View Complete Results Banner - Full Width */}
          {overallProgress > 0 && (
            <div className="lg:col-span-12">
              <Link
                to="/results"
                className="block hover:scale-[1.01] transition-transform duration-300 rounded-3xl overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-600"
                style={{
                  boxShadow: '0 8px 32px 0 rgba(59, 130, 246, 0.4)'
                }}
              >
                <div className="flex items-center justify-between p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-1">View Complete Results</h3>
                      <p className="text-white/90 text-sm">
                        See your comprehensive evaluation and all your assessment results
                      </p>
                    </div>
                  </div>
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            </div>
          )}

          {/* Profile Card - Full Width */}
          <div className="lg:col-span-12 glass-card p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              {/* Avatar Section */}
              <div className="relative flex-shrink-0">
                <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                  {profile?.profilePhoto ? (
                    <img 
                      src={profile.profilePhoto} 
                      alt={profile?.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl font-bold text-white">
                      {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute -bottom-1 -right-1 w-8 h-8 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center shadow-lg transition hover:scale-110"
                  title="Upload photo"
                >
                  {uploadingPhoto ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 001.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>

              {/* Profile Info */}
              <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 items-center">
                <div className="flex flex-col">
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Name</p>
                  <p className="text-base sm:text-lg font-bold text-gray-900 truncate">{profile?.name}</p>
                </div>
                <div className="flex flex-col">
                  <p className="text-xs sm:text-sm text-gray-600 mb-1 flex items-center gap-1">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    ID
                  </p>
                  <p className="text-base sm:text-lg font-bold text-gray-900 truncate">{profile?.digitalId || 'N/A'}</p>
                </div>
                <div className="flex flex-col">
                  <p className="text-xs sm:text-sm text-gray-600 mb-1 flex items-center gap-1">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Level
                  </p>
                  <p className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span className="truncate">{profile?.academic_level || 'N/A'}</span>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                    </svg>
                  </p>
                </div>
                <div className="flex flex-col">
                  <p className="text-xs sm:text-sm text-gray-600 mb-1 flex items-center gap-1">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Email
                  </p>
                  <p className="text-base sm:text-lg font-bold text-gray-900 truncate" title={profile?.email}>
                    {profile?.email}
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-between sm:justify-start">
                <div className={`px-4 py-2 rounded-full flex items-center gap-2 ${
                  profile?.isActive 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  <span className="font-semibold">
                    {profile?.isActive ? '✓ Active' : '✗ Inactive'}
                  </span>
                </div>
              </div>

              {/* Action Icons */}
              <div className="flex gap-2 flex-shrink-0">
                <button className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
                <button className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
