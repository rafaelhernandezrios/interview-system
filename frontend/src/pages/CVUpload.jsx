import { useState, useEffect, useRef, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../utils/axios';
import { AuthContext } from '../contexts/AuthContext';
import cvIcon from '../assets/cv.png';

const CVUpload = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const resultsRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchProfile();
  }, []);

  // Auto-scroll to results when analysis is completed
  useEffect(() => {
    if (profile?.cvAnalyzed && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current.scrollIntoView({ behavior: 'smooth' });
      }, 200);
    }
  }, [profile?.cvAnalyzed]);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/users/profile');
      setProfile(response.data);
    } catch (error) {
    }
  };

  const handleFileChange = (e) => {
    // Block if interview is completed
    if (profile?.interviewCompleted) {
      setError('Interview is completed. You cannot modify your CV.');
      return;
    }
    
    if (e.target.files[0]) {
      if (e.target.files[0].type !== 'application/pdf') {
        setError('Only PDF files are allowed');
        return;
      }
      if (e.target.files[0].size > 5 * 1024 * 1024) {
        setError('File size must not exceed 5MB');
        return;
      }
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    // Block if interview is completed
    if (profile?.interviewCompleted) {
      setError('Interview is completed. You cannot modify your CV.');
      return;
    }
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (droppedFile.type !== 'application/pdf') {
        setError('Only PDF files are allowed');
        return;
      }
      if (droppedFile.size > 5 * 1024 * 1024) {
        setError('File size must not exceed 5MB');
        return;
      }
      setFile(droppedFile);
      setError('');
    }
  };

  const handleDeleteCV = async () => {
    // Block if interview is completed
    if (profile?.interviewCompleted) {
      setError('Interview is completed. You cannot modify your CV.');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete your current CV? This will also reset your analysis and interview data.')) {
      return;
    }

    setDeleting(true);
    setError('');
    setMessage('');

    try {
      await api.delete('/users/cv');
      setMessage('CV deleted successfully');
      await fetchProfile();
      setFile(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Error deleting CV');
    } finally {
      setDeleting(false);
    }
  };

  const handleUpload = async () => {
    // Block if interview is completed
    if (profile?.interviewCompleted) {
      setError('Interview is completed. You cannot modify your CV.');
      return;
    }
    
    if (!file) {
      setError('Please select a file');
      return;
    }

    if (profile?.cvPath) {
      if (!window.confirm('You already have a CV uploaded. Uploading a new CV will replace the existing one and reset your analysis. Do you want to continue?')) {
        return;
      }
    }

    setUploading(true);
    setError('');
    setMessage('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post('/users/upload-cv', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setMessage('CV uploaded successfully');
      await fetchProfile();
      setFile(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Error uploading CV');
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyze = async () => {
    // Block if interview is completed
    if (profile?.interviewCompleted) {
      setError('Interview is completed. You cannot modify your CV.');
      return;
    }
    
    setAnalyzing(true);
    setError('');
    setMessage('');

    try {
      const response = await api.post('/users/analyze-cv');
      setMessage(`CV analyzed successfully. ${response.data.questions?.length || 4} interview questions have been generated.`);
      await fetchProfile();
      // Scroll to results after analysis completes
      if (resultsRef.current) {
        setTimeout(() => {
          resultsRef.current.scrollIntoView({ behavior: 'smooth' });
        }, 200);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error analyzing CV');
    } finally {
      setAnalyzing(false);
    }
  };

  // Determinar el paso actual del stepper
  const getCurrentStep = () => {
    if (profile?.cvAnalyzed) return 3;
    if (profile?.cvPath) return 2;
    return 1;
  };

  const currentStep = getCurrentStep();

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
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2">CV Analysis</h1>
          <p className="text-base sm:text-lg text-gray-600">
            Upload your CV and let our system analyze your skills and generate personalized interview questions
          </p>
        </div>

        {/* Stepper Visual */}
        <div className="glass-card p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {/* Step 1: Upload */}
            <div className="flex flex-col items-center flex-1">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mb-2 sm:mb-3 transition-all ${
                currentStep >= 1 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-400'
              }`}>
                {currentStep > 1 ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <span className="text-lg font-bold">1</span>
                )}
              </div>
              <span className={`text-sm font-medium ${currentStep >= 1 ? 'text-gray-900' : 'text-gray-400'}`}>
                Upload CV
              </span>
            </div>

            {/* Connector */}
            <div className={`flex-1 h-1 mx-2 sm:mx-4 mb-6 transition-all ${
              currentStep >= 2 ? 'bg-blue-600' : 'bg-gray-200'
            }`}></div>

            {/* Step 2: Analyze */}
            <div className="flex flex-col items-center flex-1">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-all ${
                currentStep >= 2 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-400'
              }`}>
                {currentStep > 2 ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <span className="text-lg font-bold">2</span>
                )}
              </div>
              <span className={`text-sm font-medium ${currentStep >= 2 ? 'text-gray-900' : 'text-gray-400'}`}>
                Analyze
              </span>
            </div>

            {/* Connector */}
            <div className={`flex-1 h-1 mx-4 mb-6 transition-all ${
              currentStep >= 3 ? 'bg-blue-600' : 'bg-gray-200'
            }`}></div>

            {/* Step 3: Results */}
            <div className="flex flex-col items-center flex-1">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-all ${
                currentStep >= 3 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-400'
              }`}>
                {currentStep >= 3 ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <span className="text-lg font-bold">3</span>
                )}
              </div>
              <span className={`text-sm font-medium ${currentStep >= 3 ? 'text-gray-900' : 'text-gray-400'}`}>
                Results
              </span>
            </div>
          </div>
        </div>

        {/* Interview Completed Warning */}
        {profile?.interviewCompleted && (
          <div className="glass-card bg-yellow-50/80 border-yellow-300 p-4 sm:p-6 mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-yellow-800 mb-1">Interview Completed</h3>
                <p className="text-yellow-700 text-sm sm:text-base">
                  Your interview has been completed. You cannot upload, delete, or re-analyze your CV at this time. All modifications are locked to maintain the integrity of your application.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error and Success Messages */}
        {error && (
          <div className="glass-card bg-red-50/80 border-red-200 p-4 mb-6">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-red-700 font-medium">{error}</p>
            </div>
          </div>
        )}

        {message && (
          <div className="glass-card bg-green-50/80 border-green-200 p-4 mb-6">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-green-700 font-medium">{message}</p>
            </div>
          </div>
        )}

        {/* Grid Superior: Upload Zone + Analyze Action */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Upload Zone - Columna Grande */}
          <div className="lg:col-span-2 glass-card p-4 sm:p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload CV</h2>
                <p className="text-gray-600">Upload your CV in PDF format (max 5MB)</p>
              </div>
            </div>

            {/* Drag and Drop Zone */}
            <div
              onDragOver={profile?.interviewCompleted ? undefined : handleDragOver}
              onDragLeave={profile?.interviewCompleted ? undefined : handleDragLeave}
              onDrop={profile?.interviewCompleted ? undefined : handleDrop}
              onClick={profile?.interviewCompleted ? undefined : () => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-12 text-center transition-all ${
                profile?.interviewCompleted
                  ? 'border-gray-300 bg-gray-100/50 cursor-not-allowed opacity-60'
                  : isDragging
                  ? 'border-blue-500 bg-blue-50/50 scale-[1.02] cursor-pointer'
                  : profile?.cvPath
                  ? 'border-green-300 bg-green-50/30 cursor-pointer'
                  : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/20 cursor-pointer'
              }`}
            >
              {/* Icono 3D Flotante */}
              <div className="flex justify-center mb-4 sm:mb-6">
                <img 
                  src={cvIcon} 
                  alt="CV Document" 
                  className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 object-contain drop-shadow-xl"
                  style={{ 
                    filter: 'drop-shadow(0 20px 25px rgba(59, 130, 246, 0.4)) drop-shadow(0 10px 10px rgba(59, 130, 246, 0.2))'
                  }}
                />
              </div>

              {profile?.cvPath ? (
                <div className="w-full space-y-4">
                  <div className="glass-card bg-white/60 border border-green-200/60 p-4 inline-block w-full">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-3.5l-1-1h-5l-1 1H6a2 2 0 00-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {profile.cvPath.split('/').pop() || 'cv.pdf'}
                        </p>
                        <p className="text-xs text-gray-500">PDF Document</p>
                      </div>
                      <button
                        onClick={handleDeleteCV}
                        disabled={deleting || profile?.interviewCompleted}
                        className="inline-flex items-center gap-2 border border-red-400 bg-transparent hover:bg-red-50 text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deleting ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Deleting...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete CV
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : file ? (
                <div>
                  <p className="text-lg font-semibold text-blue-700 mb-2">File Selected</p>
                  <p className="text-sm text-gray-600 mb-4">{file.name}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpload();
                    }}
                    disabled={uploading || profile?.interviewCompleted}
                    className="bg-gradient-to-r from-blue-600 via-blue-700 to-purple-600 hover:from-blue-700 hover:via-blue-800 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Uploading...
                      </span>
                    ) : (
                      'Upload CV'
                    )}
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-lg font-semibold text-gray-700 mb-2">
                    Drag and drop your CV here
                  </p>
                  <p className="text-sm text-gray-600 mb-2">or click to browse</p>
                  <p className="text-xs text-gray-500">PDF up to 5MB</p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                disabled={profile?.interviewCompleted}
                className="hidden"
              />
            </div>
          </div>

          {/* Analyze Action - Columna Pequeña */}
          {profile?.cvPath && (
            <div className="glass-card p-4 sm:p-6 md:p-8 flex flex-col">
              <div className="flex justify-center mb-4 sm:mb-6">
                <div className="text-4xl sm:text-5xl md:text-6xl drop-shadow-xl" style={{ 
                  filter: 'drop-shadow(0 20px 25px rgba(139, 92, 246, 0.4)) drop-shadow(0 10px 10px rgba(139, 92, 246, 0.2))'
                }}>
                  🧠
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Analyze CV</h3>
                  <p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6">
                    Extract skills and generate personalized interview questions
                  </p>
                </div>
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing || profile?.cvAnalyzed || profile?.interviewCompleted}
                  className="w-full bg-gradient-to-r from-blue-600 via-blue-700 to-purple-600 hover:from-blue-700 hover:via-blue-800 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {analyzing ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Analyzing...</span>
                    </>
                  ) : profile?.cvAnalyzed ? (
                    <>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Already Analyzed</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>Analyze CV</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Results Section - Aparece condicionalmente */}
        {profile?.cvAnalyzed && (
          <>
            <div ref={resultsRef}></div>
            {/* Métricas Bento - Dos tarjetas cuadradas */}
            <div className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-6 mb-8`}>
              {isAdmin && (
                <div className="glass-card p-8">
                  <div className="flex flex-col items-center text-center">
                    <div className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                      {profile.score || 0}%
                    </div>
                    <p className="text-gray-600 font-medium mb-1">Initial Score</p>
                    <p className="text-sm text-gray-500">Based on skills identified</p>
                  </div>
                </div>
              )}

              <div className={`glass-card p-8 ${isAdmin ? '' : 'md:max-w-md mx-auto'}`}>
                <div className="flex flex-col items-center text-center">
                  <div className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
                    {profile.skills?.length || 0}
                  </div>
                  <p className="text-gray-600 font-medium mb-1">Skills Identified</p>
                  <p className="text-sm text-gray-500">Hard and soft skills found</p>
                </div>
              </div>
            </div>

            {/* Panel de Habilidades */}
            {profile.skills && profile.skills.length > 0 && (
              <div className="glass-card p-8 mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Skills Detected</h3>
                    <p className="text-sm text-gray-600">
                      {profile.skills.length} skills identified from your CV analysis
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  {profile.skills.map((skill, index) => {
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
                        key={index}
                        className="inline-flex items-center gap-2 bg-white/40 backdrop-blur-sm border border-blue-200/60 text-gray-800 px-4 py-2 rounded-full text-sm font-medium shadow-sm hover:shadow-md hover:border-blue-300 hover:bg-white/60 transition-all duration-200"
                      >
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {cleanSkill}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Banner Final CTA */}
            {profile.questions && profile.questions.length > 0 && (
              <div className="glass-card bg-gradient-to-r from-indigo-500/10 to-purple-500/10 backdrop-blur-xl p-8 mb-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="text-6xl drop-shadow-xl" style={{ 
                      filter: 'drop-shadow(0 20px 25px rgba(139, 92, 246, 0.3))'
                    }}>
                      💬
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-700 mb-1">
                        Interview Questions Generated
                      </h3>
                      <p className="text-gray-600 text-sm">
                        Your personalized interview questions are ready. Start your interview now!
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/interview"
                    className="bg-white hover:bg-gray-50 text-blue-600 font-semibold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.05] flex items-center gap-2"
                  >
                    <span>Go to Interview</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CVUpload;
