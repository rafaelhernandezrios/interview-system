import { Link } from 'react-router-dom';
import api from '../utils/axios';

const ApplicationStepper = ({ applicationStatus, onDownloadAcceptanceLetterSuccess }) => {
  const step1Completed = applicationStatus?.step1Completed || false;
  const step2Completed = applicationStatus?.step2Completed || false;
  const step3Completed = applicationStatus?.step3Completed || false;
  const step4Completed = applicationStatus?.step4Completed || false;
  const acceptanceLetterGeneratedAt = applicationStatus?.acceptanceLetterGeneratedAt;

  // Only show AI Interview and Acceptance Letter steps
  const steps = [
    {
      id: 2,
      title: 'AI Interview',
      description: 'Answer personalized interview questions',
      route: '/interview',
      completed: step2Completed,
      available: true, // Always available, no dependency on step 1
    },
    {
      id: 4,
      title: 'Acceptance Letter',
      description: 'Download your acceptance letter (available after admin generates it)',
      route: null,
      completed: step4Completed,
      available: !!acceptanceLetterGeneratedAt,
    },
  ];

  const currentStep = applicationStatus?.currentStep || 1;

  const handleDownloadAcceptanceLetter = async () => {
    try {
      const response = await api.get('/application/acceptance-letter', {
        responseType: 'blob',
      });
      const disposition = response.headers['content-disposition'];
      const fileNameMatch = disposition?.match(/filename="?([^"]+)"?/);
      const fileName = fileNameMatch?.[1] || 'Acceptance_Letter.pdf';
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      if (typeof onDownloadAcceptanceLetterSuccess === 'function') {
        onDownloadAcceptanceLetterSuccess();
      }
    } catch (error) {
      if (error.response?.data instanceof Blob) {
        error.response.data.text().then((text) => {
          try {
            const jsonError = JSON.parse(text);
            alert(jsonError.message || 'Error downloading letter.');
          } catch {
            alert('Error downloading acceptance letter.');
          }
        });
      } else {
        alert(error.response?.data?.message || 'Error downloading acceptance letter.');
      }
    }
  };

  return (
    <div className="glass-card bg-white/60 backdrop-blur-xl border border-white/40 rounded-3xl p-6 sm:p-8 shadow-2xl">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">
        Application Progress
      </h2>
      
      <div className="space-y-6">
        {steps.map((step, index) => {
          const isActive = currentStep === step.id;
          const isCompleted = step.completed;
          const isAvailable = step.available;
          const isLast = index === steps.length - 1;
          // Display step number as 1, 2 instead of 2, 4
          const displayStepNumber = index + 1;

          return (
            <div key={step.id} className="relative">
              {/* Connector Line */}
              {!isLast && (
                <div
                  className={`absolute left-6 top-12 w-0.5 h-full ${
                    isCompleted ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                  style={{ height: 'calc(100% + 1.5rem)' }}
                />
              )}

              <div className="flex items-start gap-4">
                {/* Step Circle */}
                <div className="relative z-10 flex-shrink-0">
                  {isCompleted ? (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center shadow-lg">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  ) : isActive ? (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center shadow-lg animate-pulse">
                      <span className="text-white font-bold text-lg">{displayStepNumber}</span>
                    </div>
                  ) : (
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        isAvailable
                          ? 'bg-white/60 border-2 border-gray-300'
                          : 'bg-gray-200 border-2 border-gray-300 opacity-50'
                      }`}
                    >
                      <span
                        className={`font-bold ${
                          isAvailable ? 'text-gray-600' : 'text-gray-400'
                        }`}
                      >
                        {displayStepNumber}
                      </span>
                    </div>
                  )}
                </div>

                {/* Step Content */}
                <div className="flex-1 pt-1">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div className="flex-1">
                      <h3
                        className={`text-lg sm:text-xl font-bold mb-1 ${
                          isActive
                            ? 'text-blue-600'
                            : isCompleted
                            ? 'text-green-600'
                            : isAvailable
                            ? 'text-gray-700'
                            : 'text-gray-400'
                        }`}
                      >
                        {step.title}
                      </h3>
                      <p
                        className={`text-sm ${
                          isAvailable ? 'text-gray-600' : 'text-gray-400'
                        }`}
                      >
                        {step.description}
                      </p>
                    </div>

                    {/* Action Button */}
                    <div className="flex-shrink-0">
                      {step.id === 4 ? (
                        // Acceptance Letter - always show download button if available, allow multiple downloads
                        isAvailable ? (
                          <button
                            onClick={handleDownloadAcceptanceLetter}
                            className="inline-flex items-center justify-center bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm rounded-full px-8 py-3 shadow-lg shadow-emerald-500/40 hover:shadow-xl hover:scale-105 hover:from-emerald-700 hover:to-teal-700 transition-all duration-300"
                          >
                            Download PDF
                            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                            Locked
                          </span>
                        )
                      ) : (
                        // AI Interview step
                        isCompleted ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            Completed
                          </span>
                        ) : isActive ? (
                          <Link to={step.route}>
                            <button className="inline-flex items-center justify-center bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm rounded-full px-8 py-3 shadow-lg shadow-blue-500/40 hover:shadow-xl hover:scale-105 hover:from-blue-700 hover:to-purple-700 transition-all duration-300">
                              Continue
                              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            </button>
                          </Link>
                        ) : isAvailable ? (
                          <Link to={step.route}>
                            <button className="inline-flex items-center justify-center bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm rounded-full px-8 py-3 shadow-lg shadow-blue-500/40 hover:shadow-xl hover:scale-105 hover:from-blue-700 hover:to-purple-700 transition-all duration-300">
                              Start
                              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            </button>
                          </Link>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                            Locked
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress Summary */}
      <div className="mt-8 pt-6 border-t border-white/40">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">Overall Progress</span>
          <span className="text-sm font-bold text-gray-900">
            {steps.filter(s => s.completed).length} / {steps.length} Steps
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 rounded-full"
            style={{
              width: `${(steps.filter(s => s.completed).length / steps.length) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ApplicationStepper;

