import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../utils/axios';
import { AuthContext } from '../contexts/AuthContext';

const ScheduleScreening = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [applicationStatus, setApplicationStatus] = useState(null);
  const [scheduledMeeting, setScheduledMeeting] = useState(null);
  const [showForm, setShowForm] = useState(true); // Control whether to show form or confirmation

  const [formData, setFormData] = useState({
    preferredDate: '',
    preferredTime: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    additionalNotes: '',
    meetingType: 'zoom', // 'zoom' or 'google-calendar'
  });

  useEffect(() => {
    fetchApplicationStatus();
  }, []);

  const fetchApplicationStatus = async () => {
    try {
      const response = await api.get('/application/status');
      setApplicationStatus(response.data);
      
      // Store scheduled meeting if exists, but don't show confirmation on initial load
      // Only show confirmation after successful form submission
      if (response.data.scheduledMeeting) {
        setScheduledMeeting(response.data.scheduledMeeting);
        // Keep showForm as true to show the form, not the confirmation
        // Confirmation will only show after successful submission
      }
    } catch (error) {
      console.error('Error fetching application status:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      // Combine date and time
      const dateTime = new Date(`${formData.preferredDate}T${formData.preferredTime}`);
      
      if (dateTime < new Date()) {
        setError('Please select a future date and time');
        setLoading(false);
        return;
      }

      const response = await api.post('/application/schedule-screening', {
        ...formData,
        dateTime: dateTime.toISOString(),
      });

      // Check if there are warnings (e.g., Google Calendar failed but Zoom succeeded)
      if (response.data.warnings && response.data.warnings.length > 0) {
        setMessage(response.data.message || 'Screening interview scheduled successfully!');
        // Show warning but still proceed
        console.warn('Warnings:', response.data.warnings);
      } else {
        setMessage('Screening interview scheduled successfully!');
      }
      
      setScheduledMeeting(response.data.meeting);
      setShowForm(false); // Show confirmation view after successful scheduling
      
      // Update application status
      await fetchApplicationStatus();
      
      // Redirect after 5 seconds (give user time to see confirmation)
      setTimeout(() => {
        navigate('/dashboard');
      }, 5000);
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Error scheduling screening interview';
      setError(errorMessage);
      console.error('Error scheduling screening:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get minimum date (today)
  const getMinDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString().split('T')[0];
  };

  // Get minimum time (current time if today, or any time if future date)
  const getMinTime = () => {
    const today = new Date().toISOString().split('T')[0];
    if (formData.preferredDate === today) {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    return '00:00';
  };

  // Only show confirmation if meeting was just scheduled (not on initial load)
  if (scheduledMeeting && !showForm) {
    return (
      <div className="min-h-screen bg-mesh-gradient">
        <Navbar />
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-4xl">
          <div className="glass-card bg-white/60 backdrop-blur-xl border border-white/40 rounded-3xl p-6 sm:p-8 shadow-2xl">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                Screening Interview Scheduled
              </h2>
              <p className="text-gray-600">
                Your screening interview has been successfully scheduled
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Meeting Details</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Date & Time</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(scheduledMeeting.dateTime).toLocaleString()}
                  </p>
                </div>
                {scheduledMeeting.zoomMeeting ? (
                  <div>
                    <p className="text-sm text-gray-600">Zoom Meeting</p>
                    <a 
                      href={scheduledMeeting.zoomMeeting.joinUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-semibold"
                    >
                      Join Zoom Meeting
                    </a>
                    <p className="text-xs text-gray-500 mt-1">
                      Meeting ID: {scheduledMeeting.zoomMeeting.meetingId}
                    </p>
                    {scheduledMeeting.zoomMeeting.password && (
                      <p className="text-xs text-gray-500">
                        Password: {scheduledMeeting.zoomMeeting.password}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      ⚠️ Zoom meeting could not be created. Please contact support.
                    </p>
                  </div>
                )}
                {scheduledMeeting.googleCalendarEvent ? (
                  <div>
                    <p className="text-sm text-gray-600">Google Calendar</p>
                    <a 
                      href={scheduledMeeting.googleCalendarEvent.htmlLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-semibold"
                    >
                      View in Google Calendar
                    </a>
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      ⚠️ Google Calendar event could not be created. The meeting is scheduled but you may need to add it manually to your calendar.
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      This usually means the Google Calendar API credentials need to be configured. Check backend logs for details.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-3 px-8 rounded-full hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh-gradient">
      <Navbar />
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-4xl">
        <div className="glass-card bg-white/60 backdrop-blur-xl border border-white/40 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            Schedule Screening Interview
          </h2>

          {scheduledMeeting && showForm && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl mb-6">
              <p className="font-semibold mb-1">You already have a scheduled meeting</p>
              <p className="text-sm">
                Date: {new Date(scheduledMeeting.dateTime).toLocaleString()}
              </p>
              <p className="text-sm mt-2">
                You can schedule a new meeting below, which will replace the existing one.
              </p>
            </div>
          )}

          <p className="text-gray-600 mb-8">
            Please select your preferred date and time for the screening interview. 
            A Zoom meeting link and Google Calendar event will be created automatically.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6">
              {error}
            </div>
          )}

          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-6">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Preferred Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="preferredDate"
                  value={formData.preferredDate}
                  onChange={handleChange}
                  min={getMinDate()}
                  required
                  className="bg-white/50 backdrop-blur-sm border border-gray-200 rounded-xl w-full py-3 px-4 text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Preferred Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  name="preferredTime"
                  value={formData.preferredTime}
                  onChange={handleChange}
                  min={getMinTime()}
                  required
                  className="bg-white/50 backdrop-blur-sm border border-gray-200 rounded-xl w-full py-3 px-4 text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Timezone
              </label>
              <input
                type="text"
                name="timezone"
                value={formData.timezone}
                disabled
                className="bg-gray-100 border border-gray-200 rounded-xl w-full py-3 px-4 text-gray-600 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Additional Notes (Optional)
              </label>
              <textarea
                name="additionalNotes"
                value={formData.additionalNotes}
                onChange={handleChange}
                rows={4}
                placeholder="Any additional information or special requests..."
                className="bg-white/50 backdrop-blur-sm border border-gray-200 rounded-xl w-full py-3 px-4 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none transition-all"
              />
            </div>

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="px-6 py-3 text-gray-700 font-semibold rounded-full hover:bg-gray-100 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-3 px-8 rounded-full hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Scheduling...' : 'Schedule Interview'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ScheduleScreening;

