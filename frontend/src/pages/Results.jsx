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
    <div>
      <Navbar />
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Resultados Completos</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">CV</h2>
            <p className="text-gray-600">Score: <span className="font-bold text-blue-600">{profile?.score || 0}%</span></p>
            <p className="text-gray-600">Habilidades: {profile?.skills?.length || 0}</p>
            <p className="text-gray-600">Estado: {profile?.cvAnalyzed ? '✅ Analizado' : '❌ No analizado'}</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Entrevista</h2>
            <p className="text-gray-600">Score: <span className="font-bold text-green-600">{profile?.interviewScore || 0}%</span></p>
            <p className="text-gray-600">Estado: {profile?.interviewCompleted ? '✅ Completada' : '❌ No completada'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Results;

