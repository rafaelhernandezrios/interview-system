import { Link } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import logo from '../assets/logo.png';
import cvIcon from '../assets/cv.png';
import interviewIcon from '../assets/interview.png';

const Landing = () => {
  const { user } = useContext(AuthContext);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Navigation */}
      <nav className="bg-white/95 backdrop-blur-sm shadow-sm sticky top-0 z-50 border-b border-gray-100">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex justify-between items-center">
            <Link to="/" className="flex items-center gap-3 group">
              <img 
                src={logo} 
                alt="Mirai Innovation" 
                className="h-8 sm:h-10 w-auto object-contain group-hover:scale-110 transition-transform"
              />
              <div>
                <div className="text-base sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  <span className="hidden sm:inline">Mirai Innovation Research Institute</span>
                  <span className="sm:hidden">MIRI</span>
                </div>
                <div className="text-xs sm:text-sm text-gray-600 hidden sm:block">
                  Evaluation and Selection System
                </div>
              </div>
            </Link>
            <div className="flex gap-2 sm:gap-4 items-center">
              {user ? (
                <>
                  <Link
                    to="/dashboard"
                    className="text-gray-700 hover:text-blue-600 transition"
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/login"
                    onClick={() => {
                      localStorage.removeItem('token');
                      localStorage.removeItem('user');
                      window.location.href = '/login';
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition"
                  >
                    Logout
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-gray-700 hover:text-blue-600 transition text-sm sm:text-base px-2 sm:px-0"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition text-sm sm:text-base"
                  >
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12 sm:py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 sm:mb-8 flex justify-center">
            <img 
              src={logo} 
              alt="Mirai Innovation" 
              className="h-16 sm:h-24 w-auto object-contain drop-shadow-lg"
            />
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 sm:mb-6">
            Intelligent Evaluation Platform and
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> Selection System</span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-6 sm:mb-8 px-2 max-w-3xl mx-auto">
            Intelligent platform for the selection process of our academic programs.
            Evaluate your competencies through automated CV analysis and personalized interviews
            to become part of our excellence programs.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center flex-wrap px-4">
            {!user && (
              <Link
                to="/register"
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-xl text-base sm:text-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-2xl transform hover:scale-105"
              >
                Register
              </Link>
            )}
            {user && (
              <Link
                to="/dashboard"
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-xl text-base sm:text-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-2xl transform hover:scale-105"
              >
                Continue My Evaluation
              </Link>
            )}
          </div>
          <p className="mt-6 text-sm text-gray-500">
            This platform is complementary to the selection process of our academic programs.
            <br />
            To learn more about our programs, visit our official program pages.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-12 sm:py-20">
        <div className="text-center mb-8 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
            Comprehensive Evaluation Process
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 px-4">
            Complete evaluation system to select the best applicants
            for our academic programs
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10 max-w-5xl mx-auto">
          {/* Feature 1 - CV Analysis */}
          <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] border border-gray-100">
            <div className="flex items-center justify-center mb-6">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center">
                <img 
                  src={cvIcon} 
                  alt="CV Analysis" 
                  className="w-16 h-16 object-contain"
                />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">
              Automated CV Analysis
            </h3>
            <p className="text-gray-600 text-center">
              Upload your CV and our AI-powered system automatically analyzes
              your skills, experience, and competencies to evaluate your profile
              as an applicant to our academic programs.
            </p>
          </div>

          {/* Feature 2 - Interview */}
          <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] border border-gray-100">
            <div className="flex items-center justify-center mb-6">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-purple-200 rounded-2xl flex items-center justify-center">
                <img 
                  src={interviewIcon} 
                  alt="Interview" 
                  className="w-16 h-16 object-contain"
                />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">
              Personalized Interview
            </h3>
            <p className="text-gray-600 text-center">
              Answer questions specifically generated for you based on your CV.
              Our AI evaluates your responses through video interviews to determine your suitability
              and competencies for our programs.
            </p>
          </div>
        </div>

        {/* Additional Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-5xl mx-auto mt-8">
          {/* Evaluation Card */}
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-xl border border-blue-100">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">Comprehensive Evaluation</h4>
                <p className="text-gray-600 text-sm">
                  Receive a complete evaluation with detailed analysis of your competencies,
                  which will be used by our selection committee to determine your admission.
                </p>
              </div>
            </div>
          </div>

          {/* Security Card */}
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-6 rounded-xl border border-purple-100">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">Secure & Confidential</h4>
                <p className="text-gray-600 text-sm">
                  Your data is protected and only the authorized selection committee has access
                  to your information for the evaluation process.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Selection Process
            </h2>
            <p className="text-xl text-gray-600">
              Follow these steps to complete your evaluation as an applicant
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="space-y-12">
              {/* Step 1 */}
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex-shrink-0 w-20 h-20 bg-blue-600 text-white rounded-full flex items-center justify-center text-3xl font-bold">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    Register and Upload Your CV
                  </h3>
                  <p className="text-gray-600 text-lg">
                    Create your account as an applicant and upload your CV in PDF format.
                    Our system will automatically analyze it
                    to evaluate your initial profile.
                    Available academic levels: High School Level, University Level, Postgraduate Level.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex-shrink-0 w-20 h-20 bg-purple-600 text-white rounded-full flex items-center justify-center text-3xl font-bold">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    Complete the Interview
                  </h3>
                  <p className="text-gray-600 text-lg">
                    Answer the personalized questions generated based on your CV.
                    Our AI will evaluate your responses to determine your suitability
                    and competencies for our programs.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex-shrink-0 w-20 h-20 bg-green-600 text-white rounded-full flex items-center justify-center text-3xl font-bold">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    Committee Review
                  </h3>
                  <p className="text-gray-600 text-lg">
                    Once your evaluation is complete, our selection committee
                    will review your complete profile to make the final decision
                    regarding your admission to the programs.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Apply?
          </h2>
          <p className="text-lg sm:text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Complete the evaluation process to be considered as an applicant
            to our excellence academic programs.
          </p>
          {!user && (
            <Link
              to="/register"
              className="inline-block bg-white text-blue-600 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-gray-50 transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:scale-105"
            >
              Register
            </Link>
          )}
          {user && (
            <Link
              to="/dashboard"
              className="inline-block bg-white text-blue-600 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-gray-50 transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:scale-105"
            >
              Go to Dashboard
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img 
                  src={logo} 
                  alt="Mirai Innovation" 
                  className="h-10 w-auto object-contain"
                />
                <h3 className="text-xl font-bold">Mirai Innovation Research Institute</h3>
              </div>
              <p className="text-gray-400">
                Evaluation and selection system for academic programs.
                Complementary platform for the admission process.
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="https://www.mirai-innovation-lab.com/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">
                    Home
                  </a>
                </li>
                {user && (
                  <>
                    <li>
                      <Link to="/dashboard" className="hover:text-white transition">
                        My Evaluation
                      </Link>
                    </li>
                    <li>
                      <Link to="/results" className="hover:text-white transition">
                        Summary
                      </Link>
                    </li>
                  </>
                )}
                <li>
                  <a href="https://www.mirai-innovation-lab.com/training-programs/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">
                    Academic Programs
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Information</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="https://www.mirai-innovation-lab.com/about-us/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">
                    About the Institute
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    Frequently Asked Questions
                  </a>
                </li>
                <li>
                  <a href="https://www.mirai-innovation-lab.com/directions-to-mirai-innovation-laboratory/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">
                    Contact
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    Privacy and Terms
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-gray-400">
            <p>&copy; 2025 Mirai Innovation Research Institute. All rights reserved.</p>
            <p className="mt-2 text-sm">
              This platform is complementary to the selection process of our academic programs.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;

