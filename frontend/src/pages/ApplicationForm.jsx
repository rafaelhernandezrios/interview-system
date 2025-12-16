import { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../utils/axios';
import { AuthContext } from '../contexts/AuthContext';

// InputField component moved outside to prevent recreation on each render
const InputField = ({ label, name, type = 'text', required = false, options = null, colSpan = 1, formData, handleChange, ...props }) => (
  <div className={`mb-6 ${colSpan === 2 ? 'md:col-span-2' : ''}`}>
    <label className="block text-sm font-semibold text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {type === 'select' ? (
      <select
        name={name}
        value={formData[name] || ''}
        onChange={handleChange}
        required={required}
        className="bg-white/50 backdrop-blur-sm border border-gray-200 rounded-xl w-full py-3 px-4 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
        {...props}
      >
        <option value="">Select...</option>
        {options?.map(opt => (
          <option key={opt.value || opt} value={opt.value || opt}>
            {opt.label || opt}
          </option>
        ))}
      </select>
    ) : type === 'textarea' ? (
      <textarea
        name={name}
        value={formData[name] || ''}
        onChange={handleChange}
        required={required}
        rows={4}
        className="bg-white/50 backdrop-blur-sm border border-gray-200 rounded-xl w-full py-3 px-4 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none transition-all"
        {...props}
      />
    ) : type === 'checkbox' ? (
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          name={name}
          checked={formData[name] || false}
          onChange={handleChange}
          className="w-5 h-5 mt-0.5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 border-gray-300"
        />
        <span className="text-gray-700 text-sm">{props.label || ''}</span>
      </div>
    ) : (
      <input
        type={type}
        name={name}
        value={formData[name] || ''}
        onChange={handleChange}
        required={required}
        disabled={props.disabled}
        className="bg-white/50 backdrop-blur-sm border border-gray-200 rounded-xl w-full py-3 px-4 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
        {...props}
      />
    )}
  </div>
);

const ApplicationForm = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState(1);

  const [formData, setFormData] = useState({
    // Section 1: Basic Info
    email: user?.email || '',
    promotionalCode: '',
    
    // Section 2: Personal & Contact
    firstName: '',
    lastName: '',
    sex: '',
    dateOfBirth: '',
    countryOfCitizenship: '',
    countryOfResidency: '',
    primaryPhoneType: '',
    phoneNumber: '',
    linkedInProfileUrl: '',
    hasMedicalCondition: false,
    medicalConditionDetails: '',
    
    // Section 3: Academic Background
    cvUrl: '',
    institutionName: '',
    mainAcademicMajor: '',
    otherStudiesCertifications: '',
    currentSemester: '',
    participationInChallenges: '',
    awardsAndDistinctions: '',
    portfolioUrl: '',
    hasAcademicPublications: false,
    
    // Section 4: Language
    englishLevel: '',
    hasEnglishCertification: false,
    
    // Section 5: Program Specifics
    appliedBefore: false,
    paymentSource: '',
    
    // Section 6: Legal & Submit
    plagiarismCheckConfirmed: false,
    signature: '',
  });

  useEffect(() => {
    if (user?.email) {
      setFormData(prev => ({ ...prev, email: user.email }));
    }
    fetchApplicationData();
  }, [user]);

  const fetchApplicationData = async () => {
    try {
      const response = await api.get('/application/');
      if (response.data) {
        setFormData({
          email: response.data.email || user?.email || '',
          promotionalCode: response.data.promotionalCode || '',
          firstName: response.data.firstName || '',
          lastName: response.data.lastName || '',
          sex: response.data.sex || '',
          dateOfBirth: response.data.dateOfBirth ? new Date(response.data.dateOfBirth).toISOString().split('T')[0] : '',
          countryOfCitizenship: response.data.countryOfCitizenship || '',
          countryOfResidency: response.data.countryOfResidency || '',
          primaryPhoneType: response.data.primaryPhoneType || '',
          phoneNumber: response.data.phoneNumber || '',
          linkedInProfileUrl: response.data.linkedInProfileUrl || '',
          hasMedicalCondition: response.data.hasMedicalCondition || false,
          medicalConditionDetails: response.data.medicalConditionDetails || '',
          cvUrl: response.data.cvUrl || '',
          institutionName: response.data.institutionName || '',
          mainAcademicMajor: response.data.mainAcademicMajor || '',
          otherStudiesCertifications: response.data.otherStudiesCertifications || '',
          currentSemester: response.data.currentSemester || '',
          participationInChallenges: response.data.participationInChallenges || '',
          awardsAndDistinctions: response.data.awardsAndDistinctions || '',
          portfolioUrl: response.data.portfolioUrl || '',
          hasAcademicPublications: response.data.hasAcademicPublications || false,
          englishLevel: response.data.englishLevel || '',
          hasEnglishCertification: response.data.hasEnglishCertification || false,
          appliedBefore: response.data.appliedBefore || false,
          paymentSource: response.data.paymentSource || '',
          plagiarismCheckConfirmed: response.data.plagiarismCheckConfirmed || false,
          signature: response.data.signature || '',
        });
      }
    } catch (error) {
      console.error('Error fetching application:', error);
    }
  };

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  }, []);

  // Navigation functions
  const nextSection = () => {
    if (activeSection < sections.length) {
      setActiveSection(activeSection + 1);
      // Scroll to top of form
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevSection = () => {
    if (activeSection > 1) {
      setActiveSection(activeSection - 1);
      // Scroll to top of form
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    
    try {
      await api.put('/application/save', formData);
      setMessage('Draft saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Error saving draft');
      setTimeout(() => setError(''), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await api.put('/application/submit', formData);
      setMessage('Application submitted successfully!');
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error) {
      const errorMessage = error.response?.data?.errors 
        ? error.response.data.errors.join(', ')
        : error.response?.data?.message || 'Error submitting application';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Calculate completion percentage - memoized to prevent unnecessary recalculations
  const completionPercentage = useMemo(() => {
    const totalFields = [
      'email', 'firstName', 'lastName', 'sex', 'dateOfBirth',
      'countryOfCitizenship', 'countryOfResidency', 'primaryPhoneType',
      'phoneNumber', 'institutionName', 'mainAcademicMajor',
      'englishLevel', 'paymentSource', 'plagiarismCheckConfirmed', 'signature'
    ];
    
    const completedFields = totalFields.filter(field => {
      const value = formData[field];
      if (typeof value === 'boolean') return value === true;
      return value && value.toString().trim() !== '';
    });
    
    return Math.round((completedFields.length / totalFields.length) * 100);
  }, [formData]);

  const sections = [
    { 
      id: 1, 
      title: 'Basic Info', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      )
    },
    { 
      id: 2, 
      title: 'Personal & Contact', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
    { 
      id: 3, 
      title: 'Academic Background', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      )
    },
    { 
      id: 4, 
      title: 'Language', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
      )
    },
    { 
      id: 5, 
      title: 'Program Specifics', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    { 
      id: 6, 
      title: 'Legal & Submit', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
  ];

  const countries = [
    'United States', 'Canada', 'Mexico', 'United Kingdom', 'Germany', 'France',
    'Spain', 'Italy', 'Japan', 'China', 'India', 'Brazil', 'Argentina', 'Chile',
    'Colombia', 'Peru', 'Ecuador', 'Venezuela', 'Other'
  ];

  return (
    <div className="min-h-screen bg-mesh-gradient pb-24">
      {/* Ambient Orbs */}
      <div className="ambient-orb-1"></div>
      <div className="ambient-orb-2"></div>
      <div className="ambient-orb-3"></div>
      
      <Navbar />
      
      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-5xl">
        {/* Header - Separate Card */}
        <div className="mb-6">
          <h1 className="text-4xl sm:text-5xl font-bold mb-2">
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
              Application Form
            </span>
          </h1>
          <p className="text-gray-600 text-lg">
            Complete your application step by step. Your progress is saved automatically.
          </p>
        </div>

        {/* Progress Bar */}
        <div className="glass-card bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl p-4 mb-6 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">
              Section {activeSection} of {sections.length}
            </span>
            <span className="text-sm font-bold text-gray-900">
              {completionPercentage}% Complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 rounded-full"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>

        {/* Messages */}
        {message && (
          <div className="glass-card bg-green-500/20 backdrop-blur-sm border border-green-500/40 rounded-xl p-4 mb-6">
            <p className="text-green-800 font-semibold flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {message}
            </p>
          </div>
        )}

        {error && (
          <div className="glass-card bg-red-500/20 backdrop-blur-sm border border-red-500/40 rounded-xl p-4 mb-6">
            <p className="text-red-800 font-semibold flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </p>
          </div>
        )}

        {/* Navigation Tabs - Pill Design */}
        <div className="glass-card bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl p-4 mb-6 shadow-xl overflow-hidden">
          <div className="flex gap-2 sm:gap-3 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all duration-300 ${
                  activeSection === section.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 font-semibold'
                    : 'text-gray-500 hover:bg-white/40 font-medium'
                }`}
              >
                <span className={activeSection === section.id ? 'text-white' : 'text-gray-500'}>
                  {section.icon}
                </span>
                <span className="hidden sm:inline">{section.title}</span>
                <span className={`text-xs ${activeSection === section.id ? 'text-white/80' : 'text-gray-400'}`}>
                  ({section.id}/{sections.length})
                </span>
              </button>
            ))}
          </div>
        </div>

        <form id="application-form" onSubmit={handleSubmit}>
          <div className="glass-card bg-white/60 backdrop-blur-xl border border-white/40 rounded-3xl p-6 sm:p-8 shadow-2xl">
            {/* Section 1: Basic Info */}
            {activeSection === 1 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  Basic Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputField
                  label="Email"
                  name="email"
                  type="email"
                  required
                  disabled
                  formData={formData}
                  handleChange={handleChange}
                />
                <InputField
                  label="Promotional Code"
                  name="promotionalCode"
                  type="text"
                  placeholder="Optional"
                  formData={formData}
                  handleChange={handleChange}
                />
                </div>
              </div>
            )}

            {/* Section 2: Personal & Contact */}
            {activeSection === 2 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  Personal & Contact Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InputField
                    label="First Name"
                    name="firstName"
                    required
                    formData={formData}
                    handleChange={handleChange}
                  />
                  <InputField
                    label="Last Name"
                    name="lastName"
                    required
                    formData={formData}
                    handleChange={handleChange}
                  />
                  <InputField
                    label="Sex"
                    name="sex"
                    type="select"
                    required
                    options={['Man', 'Woman']}
                    formData={formData}
                    handleChange={handleChange}
                  />
                  <InputField
                    label="Date of Birth"
                    name="dateOfBirth"
                    type="date"
                    required
                    formData={formData}
                    handleChange={handleChange}
                  />
                  <InputField
                    label="Country of Citizenship"
                    name="countryOfCitizenship"
                    type="select"
                    required
                    options={countries}
                    formData={formData}
                    handleChange={handleChange}
                  />
                  <InputField
                    label="Country of Residency"
                    name="countryOfResidency"
                    type="select"
                    required
                    options={countries}
                    formData={formData}
                    handleChange={handleChange}
                  />
                  <InputField
                    label="Primary Phone Type"
                    name="primaryPhoneType"
                    type="select"
                    required
                    options={['Mobile', 'Home', 'Work']}
                    formData={formData}
                    handleChange={handleChange}
                  />
                  <InputField
                    label="Phone Number"
                    name="phoneNumber"
                    type="tel"
                    required
                    placeholder="+1 234 567 8900"
                    formData={formData}
                    handleChange={handleChange}
                  />
                  <InputField
                    label="LinkedIn Profile URL"
                    name="linkedInProfileUrl"
                    type="url"
                    placeholder="https://linkedin.com/in/yourprofile"
                    colSpan={2}
                    formData={formData}
                    handleChange={handleChange}
                  />
                </div>
                <div className="mt-6">
                  <InputField
                    label="Do you have any medical condition or disability?"
                    name="hasMedicalCondition"
                    type="checkbox"
                    label="Yes, I have a medical condition or disability"
                    formData={formData}
                    handleChange={handleChange}
                  />
                  {formData.hasMedicalCondition && (
                    <InputField
                      label="Please provide details"
                      name="medicalConditionDetails"
                      type="textarea"
                      required
                      colSpan={2}
                      formData={formData}
                      handleChange={handleChange}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Section 3: Academic Background */}
            {activeSection === 3 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  Academic Background
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InputField
                    label="CV URL"
                    name="cvUrl"
                    type="url"
                    placeholder="https://example.com/cv.pdf"
                    colSpan={2}
                    formData={formData}
                    handleChange={handleChange}
                  />
                  <InputField
                    label="Institution Name"
                    name="institutionName"
                    required
                    formData={formData}
                    handleChange={handleChange}
                  />
                  <InputField
                    label="Main Academic Major"
                    name="mainAcademicMajor"
                    required
                    formData={formData}
                    handleChange={handleChange}
                  />
                  <InputField
                    label="Current Semester (if student)"
                    name="currentSemester"
                    placeholder="e.g., Fall 2024, Semester 3"
                    formData={formData}
                    handleChange={handleChange}
                  />
                  <InputField
                    label="Other Studies/Certifications"
                    name="otherStudiesCertifications"
                    type="textarea"
                    placeholder="List any additional studies, certifications, or courses"
                    colSpan={2}
                    formData={formData}
                    handleChange={handleChange}
                  />
                  <InputField
                    label="Participation in Challenges/Contests"
                    name="participationInChallenges"
                    type="textarea"
                    placeholder="List any competitions, hackathons, or challenges you've participated in"
                    colSpan={2}
                    formData={formData}
                    handleChange={handleChange}
                  />
                  <InputField
                    label="Awards and Distinctions"
                    name="awardsAndDistinctions"
                    type="textarea"
                    placeholder="List any awards, honors, or distinctions you've received"
                    colSpan={2}
                    formData={formData}
                    handleChange={handleChange}
                  />
                  <InputField
                    label="Portfolio URL (GitHub, etc.)"
                    name="portfolioUrl"
                    type="url"
                    placeholder="https://github.com/yourusername"
                    colSpan={2}
                    formData={formData}
                    handleChange={handleChange}
                  />
                </div>
                <div className="mt-6">
                  <InputField
                    label="Do you have academic publications?"
                    name="hasAcademicPublications"
                    type="checkbox"
                    label="Yes, I have academic publications"
                    formData={formData}
                    handleChange={handleChange}
                  />
                </div>
              </div>
            )}

            {/* Section 4: Language */}
            {activeSection === 4 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                    </svg>
                  </div>
                  Language Proficiency
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InputField
                    label="English Level"
                    name="englishLevel"
                    type="select"
                    required
                    options={['A0/A1', 'A2', 'B1', 'B2', 'C1', 'C2']}
                    formData={formData}
                    handleChange={handleChange}
                  />
                </div>
                <div className="mt-6">
                  <InputField
                    label="Do you have an English certification?"
                    name="hasEnglishCertification"
                    type="checkbox"
                    label="Yes, I have an English certification"
                    formData={formData}
                    handleChange={handleChange}
                  />
                </div>
              </div>
            )}

            {/* Section 5: Program Specifics */}
            {activeSection === 5 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  Program Specifics (EmFuTech)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InputField
                    label="Who will pay for the program?"
                    name="paymentSource"
                    type="select"
                    required
                    options={['Parents', 'Self', 'University', 'Scholarship', 'Other']}
                    formData={formData}
                    handleChange={handleChange}
                  />
                </div>
                <div className="mt-6">
                  <InputField
                    label="Have you applied before?"
                    name="appliedBefore"
                    type="checkbox"
                    label="Yes, I have applied before"
                    formData={formData}
                    handleChange={handleChange}
                  />
                </div>
              </div>
            )}

            {/* Section 6: Legal & Submit */}
            {activeSection === 6 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  Legal & Submit
                </h2>
                <div className="grid grid-cols-1 gap-6">
                  <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4">
                    <InputField
                      label="I confirm that all information provided is accurate and original. I understand that plagiarism will result in immediate disqualification."
                      name="plagiarismCheckConfirmed"
                      type="checkbox"
                      required
                      label="I confirm that all information provided is accurate and original. I understand that plagiarism will result in immediate disqualification."
                      formData={formData}
                      handleChange={handleChange}
                    />
                  </div>
                  <InputField
                    label="Signature (Type your full name)"
                    name="signature"
                    required
                    placeholder="Your full name"
                    formData={formData}
                    handleChange={handleChange}
                  />
                </div>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 glass-card bg-white/80 backdrop-blur-xl border-t border-white/40 shadow-2xl">
        <div className="container mx-auto px-4 sm:px-6 py-4 max-w-5xl">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            {/* Navigation Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={prevSection}
                disabled={activeSection === 1}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                  activeSection === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white/60 text-gray-700 hover:bg-white/80 border-2 border-gray-300 hover:border-gray-400'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>
              {activeSection < sections.length && (
                <button
                  type="button"
                  onClick={nextSection}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
                >
                  Next
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={saving}
                className="px-6 py-3 rounded-xl font-semibold transition-all border-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
              {activeSection === sections.length && (
                <button
                  type="submit"
                  form="application-form"
                  disabled={loading}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Submitting...' : 'Submit Application'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplicationForm;
