import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../utils/axios';

const Results = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/users/profile');
      setProfile(response.data);
    } catch (error) {
      console.error('Error obteniendo perfil:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
        <Navbar />
        <div className="flex justify-center items-center h-screen">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh-gradient">
      <Navbar />
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-7xl">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-gray-900">Resultados Completos</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
          <div className="glass-card p-4 sm:p-6 rounded-xl">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">CV</h2>
            <p className="text-sm sm:text-base text-gray-600 mb-2">Score: <span className="font-bold text-blue-600">{profile?.score || 0}%</span></p>
            <p className="text-sm sm:text-base text-gray-600 mb-2">Habilidades: {profile?.skills?.length || 0}</p>
            <p className="text-sm sm:text-base text-gray-600">Estado: {profile?.cvAnalyzed ? '✅ Analizado' : '❌ No analizado'}</p>
          </div>

          <div className="glass-card p-4 sm:p-6 rounded-xl">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">Entrevista</h2>
            <p className="text-sm sm:text-base text-gray-600 mb-2">Score: <span className="font-bold text-green-600">{profile?.interviewScore || 0}%</span></p>
            <p className="text-sm sm:text-base text-gray-600">Estado: {profile?.interviewCompleted ? '✅ Completada' : '❌ No completada'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Results;

