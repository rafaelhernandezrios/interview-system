import { Link } from 'react-router-dom';

const ApplicationStepper = ({ applicationStatus }) => {
  const steps = [
    {
      id: 1,
      title: 'Application Form',
      description: 'Complete your personal and academic information',
      route: '/application-form',
      completed: applicationStatus?.step1Completed || false,
      available: true, // Always available
    },
    {
      id: 2,
      title: 'AI Interview',
      description: 'Answer personalized interview questions',
      route: '/interview',
      completed: applicationStatus?.step2Completed || false,
      available: applicationStatus?.step1Completed || false, // Available after step 1
    },
    {
      id: 3,
      title: 'Schedule Screening',
      description: 'Schedule your screening interview',
      route: '/schedule-screening',
      completed: applicationStatus?.step3Completed || false,
      // In development: allow after step 1, in production: require step 2
      // Check if we're in development mode or if the env var is explicitly set to true
      // In Vite, use import.meta.env instead of process.env
      // import.meta.env.MODE is 'development' in dev mode, 'production' in production
      available: (import.meta.env.MODE === 'development' || import.meta.env.VITE_ENABLE_SCHEDULE_WITHOUT_INTERVIEW === 'true'
        ? (applicationStatus?.step1Completed || false) 
        : (applicationStatus?.step2Completed || false)),
    },
    {
      id: 4,
      title: 'Acceptance Letter',
      description: 'View your acceptance decision',
      route: '#',
      completed: applicationStatus?.step4Completed || false,
      available: applicationStatus?.step3Completed || false, // Available after step 3
    },
  ];

  const currentStep = applicationStatus?.currentStep || 1;

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
                      <span className="text-white font-bold text-lg">{step.id}</span>
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
                        {step.id}
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
                      {isCompleted ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                          Completed
                        </span>
                      ) : isActive ? (
                        <Link to={step.route}>
                          <button className="inline-flex items-center justify-center bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm rounded-full px-8 py-3 shadow-lg shadow-blue-500/40 hover:shadow-xl hover:scale-105 hover:from-blue-700 hover:to-purple-700 transition-all duration-300">
                            {step.id === 1 ? 'Start' : 'Continue'}
                            <svg 
                              className="w-4 h-4 ml-2" 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={2.5} 
                                d="M13 7l5 5m0 0l-5 5m5-5H6" 
                              />
                            </svg>
                          </button>
                        </Link>
                      ) : isAvailable ? (
                        <Link to={step.route}>
                          <button className="inline-flex items-center justify-center bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm rounded-full px-8 py-3 shadow-lg shadow-blue-500/40 hover:shadow-xl hover:scale-105 hover:from-blue-700 hover:to-purple-700 transition-all duration-300">
                            Start
                            <svg 
                              className="w-4 h-4 ml-2" 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={2.5} 
                                d="M13 7l5 5m0 0l-5 5m5-5H6" 
                              />
                            </svg>
                          </button>
                        </Link>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                          Locked
                        </span>
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

