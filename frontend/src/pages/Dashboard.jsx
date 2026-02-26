import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../utils/axios';
import ApplicationStepper from '../components/ApplicationStepper';
import ConfirmDatesSection from '../components/ConfirmDatesSection';

// Circular progress (same style as main / Results)
const CircularProgress = ({ percentage, size = 120, color = 'blue' }) => {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const gradientColors = {
    blue: { from: '#3B82F6', to: '#8B5CF6' },
    green: { from: '#10B981', to: '#3B82F6' },
    purple: { from: '#8B5CF6', to: '#EC4899' },
  };
  const colors = gradientColors[color] || gradientColors.blue;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255, 255, 255, 0.2)" strokeWidth="12" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#gradient-dash-${color})`}
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
        <defs>
          <linearGradient id={`gradient-dash-${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.from} />
            <stop offset="100%" stopColor={colors.to} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          {percentage}%
        </span>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [applicationStatus, setApplicationStatus] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchApplicationStatus();
    fetchProfile();
    
    // Refresh status when window regains focus (user returns from another page)
    const handleFocus = () => {
      fetchApplicationStatus();
      fetchProfile();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchApplicationStatus = async () => {
    try {
      const response = await api.get('/application/status');
      setApplicationStatus(response.data);
    } catch (error) {
      console.error('Error fetching application status:', error);
    }
  };

  const fetchProfile = async () => {
    try {
      const response = await api.get('/users/profile');
      setProfile(response.data);
    } catch (error) {
      console.error('Error fetching profile:', error);
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

  // Match ApplicationStepper: only steps currently shown (AI Interview = step2, Acceptance Letter = step4)
  const activeStepsTotal = 2;
  const activeStepsCompleted = applicationStatus
    ? [applicationStatus.step2Completed, applicationStatus.step4Completed].filter(Boolean).length
    : 0;
  const journeyPercentage = activeStepsTotal ? Math.round((activeStepsCompleted / activeStepsTotal) * 100) : 0;

  return (
    <div className="min-h-screen bg-mesh-gradient">
      {/* Ambient Orbs */}
      <div className="ambient-orb-1"></div>
      <div className="ambient-orb-2"></div>
      <div className="ambient-orb-3"></div>
      
      <Navbar />
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-7xl">
        {/* Your Journey card: circle progress + Application Progress (only active steps: AI Interview + Acceptance Letter) */}
        <div className="glass-card p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-6">
            <div className="flex items-center gap-4">
              <CircularProgress percentage={journeyPercentage} size={120} color="blue" />
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Your journey</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {applicationStatus ? `${activeStepsCompleted} / ${activeStepsTotal} steps completed` : `0 / ${activeStepsTotal} steps completed`}
                </p>
              </div>
            </div>
          </div>
          <ApplicationStepper applicationStatus={applicationStatus} onDownloadAcceptanceLetterSuccess={fetchApplicationStatus} />
          {profile?.program === 'MIRI' && applicationStatus?.step4Completed && (
            <ConfirmDatesSection applicationStatus={applicationStatus} onSuccess={fetchApplicationStatus} />
          )}
        </div>

        {/* View summary - elemento separado, mismo ancho que Your journey (estilo main: azul, letras blancas, icono Results) */}
        <Link
          to="/results"
          className="block w-full mb-6 sm:mb-8 p-4 sm:p-6 text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <span className="inline-flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            View summary
          </span>
        </Link>

        {/* Profile Card - Full Width */}
        <div className="glass-card p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
            {/* Avatar Section */}
            <div className="relative flex-shrink-0">
              <div 
                onClick={() => !uploadingPhoto && fileInputRef.current?.click()}
                className={`relative w-16 h-16 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center cursor-pointer group transition-all duration-300 ${
                  uploadingPhoto ? 'opacity-50 cursor-not-allowed' : 'hover:ring-4 hover:ring-blue-300 hover:scale-105'
                }`}
                title={uploadingPhoto ? 'Uploading...' : 'Click to upload profile photo'}
              >
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
                {/* Overlay on hover */}
                {!uploadingPhoto && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="text-center">
                      <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 001.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="text-xs sm:text-sm text-white font-semibold">Click to upload</p>
                    </div>
                  </div>
                )}
              </div>
              {/* Upload button indicator */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className={`absolute -bottom-1 -right-1 w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center shadow-lg transition-all ${
                  uploadingPhoto ? 'cursor-not-allowed' : 'hover:scale-110'
                }`}
                title={uploadingPhoto ? 'Uploading...' : 'Upload profile photo'}
              >
                {uploadingPhoto ? (
                  <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white"></div>
                ) : (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              {/* Helper text below avatar */}
              <div className="mt-2 text-center">
                <p className="text-xs text-gray-600 font-medium">
                  {uploadingPhoto ? 'Uploading...' : profile?.profilePhoto ? 'Click to change photo' : 'Click to add photo'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Max 5MB</p>
              </div>
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
