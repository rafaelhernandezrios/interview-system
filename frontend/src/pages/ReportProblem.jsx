import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../utils/axios';

const ReportProblem = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    type: 'problem',
    subject: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reports, setReports] = useState([]);
  const [selectedReportIndex, setSelectedReportIndex] = useState(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [sendingResponse, setSendingResponse] = useState(false);
  const [viewMode, setViewMode] = useState('form'); // 'form' or 'history'

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await api.get('/users/reports');
      setReports(response.data.reports || []);
    } catch (err) {
      console.error('Error fetching reports:', err);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
    setMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    if (!formData.message.trim()) {
      setError('Please provide a message');
      setLoading(false);
      return;
    }

    try {
      await api.post('/users/report', formData);
      setMessage('Thank you for your report! We will review it and get back to you if needed.');
      setFormData({
        type: 'problem',
        subject: '',
        message: ''
      });
      await fetchReports();
      setViewMode('history');
      // Don't redirect, show history instead
    } catch (err) {
      setError(err.response?.data?.message || 'Error submitting report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRespondToReport = async (reportIndex) => {
    if (!responseMessage.trim()) {
      setError('Please enter a message');
      return;
    }

    setSendingResponse(true);
    setError('');

    try {
      await api.post(`/users/reports/${reportIndex}/respond`, {
        message: responseMessage
      });
      setResponseMessage('');
      setSelectedReportIndex(null);
      await fetchReports();
      setMessage('Your response has been sent successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error sending response. Please try again.');
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

  const getTypeLabel = (type) => {
    const labels = {
      problem: 'Problem',
      survey: 'Survey',
      feedback: 'Feedback'
    };
    return labels[type] || type;
  };

  return (
    <div className="min-h-screen bg-mesh-gradient">
      {/* Ambient Orbs */}
      <div className="ambient-orb-1"></div>
      <div className="ambient-orb-2"></div>
      <div className="ambient-orb-3"></div>

      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Tabs */}
        <div className="glass-card bg-white/60 backdrop-blur-xl border border-white/40 rounded-3xl shadow-2xl p-6 sm:p-8 mb-6">
          <div className="flex gap-4 border-b border-gray-200 mb-6">
            <button
              onClick={() => setViewMode('form')}
              className={`px-4 py-2 font-semibold transition-colors ${
                viewMode === 'form'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              New Report
            </button>
            <button
              onClick={() => setViewMode('history')}
              className={`px-4 py-2 font-semibold transition-colors relative ${
                viewMode === 'history'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              My Reports
              {reports.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {reports.length}
                </span>
              )}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {message && (
            <div className="bg-green-50 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4">
              {message}
            </div>
          )}

          {/* Form View */}
          {viewMode === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  Type *
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  required
                >
                  <option value="problem">Report a Problem</option>
                  <option value="survey">Survey Response</option>
                  <option value="feedback">General Feedback</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  Subject (Optional)
                </label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="Brief description of your report..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  Message *
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Please describe the problem, provide feedback, or share your thoughts..."
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
                  required
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !formData.message.trim()}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          )}

          {/* History View */}
          {viewMode === 'history' && (
            <div className="space-y-6">
              {reports.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No reports</h3>
                  <p className="mt-1 text-sm text-gray-500">You haven't submitted any reports yet.</p>
                  <button
                    onClick={() => setViewMode('form')}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Create New Report
                  </button>
                </div>
              ) : (
                reports.map((report, index) => (
                  <div key={index} className="glass-card bg-white/40 border border-white/40 rounded-2xl p-6 space-y-4">
                    {/* Report Header */}
                    <div className="flex items-start justify-between border-b border-gray-200 pb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            report.type === 'problem' ? 'bg-red-100 text-red-700' :
                            report.type === 'survey' ? 'bg-blue-100 text-blue-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {getTypeLabel(report.type)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDate(report.submittedAt)}
                          </span>
                        </div>
                        {report.subject && (
                          <h3 className="text-lg font-semibold text-gray-900">{report.subject}</h3>
                        )}
                        <p className="text-sm text-gray-600 mt-1">{report.message}</p>
                      </div>
                    </div>

                    {/* Messages Thread */}
                    {report.messages && report.messages.length > 0 && (
                      <div className="space-y-3 mt-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Conversation:</h4>
                        {report.messages.map((msg, msgIndex) => (
                          <div
                            key={msgIndex}
                            className={`p-4 rounded-lg ${
                              msg.sender === 'admin'
                                ? 'bg-blue-50 border-l-4 border-blue-500'
                                : 'bg-gray-50 border-l-4 border-gray-400'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-gray-700">
                                {msg.sender === 'admin' ? (msg.senderName || 'Admin') : 'You'}
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
                    {selectedReportIndex === index ? (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <textarea
                          value={responseMessage}
                          onChange={(e) => setResponseMessage(e.target.value)}
                          placeholder="Type your response..."
                          rows={4}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none mb-3"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedReportIndex(null);
                              setResponseMessage('');
                            }}
                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-all"
                            disabled={sendingResponse}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleRespondToReport(index)}
                            disabled={sendingResponse || !responseMessage.trim()}
                            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {sendingResponse ? 'Sending...' : 'Send Response'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedReportIndex(index)}
                        className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all"
                      >
                        Respond to Report
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportProblem;
