import { useState, useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import api from '../utils/axios';
import ApplicationStepper from '../components/ApplicationStepper';

const Dashboard = () => {
  const [applicationStatus, setApplicationStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApplicationStatus();
    
    // Refresh status when window regains focus (user returns from another page)
    const handleFocus = () => {
      fetchApplicationStatus();
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
    } finally {
      setLoading(false);
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

  return (
    <div className="min-h-screen bg-mesh-gradient">
      {/* Ambient Orbs */}
      <div className="ambient-orb-1"></div>
      <div className="ambient-orb-2"></div>
      <div className="ambient-orb-3"></div>
      
      <Navbar />
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-5xl">
        {/* Application Stepper - Main Hero Element */}
        <div className="flex justify-center">
          <div className="w-full">
            <ApplicationStepper applicationStatus={applicationStatus} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
