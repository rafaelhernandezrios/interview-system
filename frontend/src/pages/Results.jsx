import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../utils/axios';

const Results = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatedCV, setGeneratedCV] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/users/profile');
      setProfile(response.data);
      if (response.data.generatedCV) {
        setGeneratedCV(response.data.generatedCV);
      }
    } catch (error) {
      console.error('Error obteniendo perfil:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCV = async () => {
    setGenerating(true);
    try {
      const response = await api.post('/users/generate-cv');
      setGeneratedCV(response.data.cv);
      alert('CV generado exitosamente');
    } catch (error) {
      alert('Error al generar el CV');
    } finally {
      setGenerating(false);
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

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Habilidades Blandas</h2>
            {profile?.softSkillsResults ? (
              <>
                <p className="text-gray-600">Score Total: <span className="font-bold">{profile.softSkillsResults.totalScore}/800</span></p>
                <p className="text-gray-600">Nivel: {profile.softSkillsResults.institutionalLevel}</p>
              </>
            ) : (
              <p className="text-gray-600">❌ No completado</p>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Habilidades Duras</h2>
            {profile?.hardSkillsResults ? (
              <>
                <p className="text-gray-600">Score Total: <span className="font-bold">{profile.hardSkillsResults.totalScore}/175</span></p>
              </>
            ) : (
              <p className="text-gray-600">❌ No completado</p>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">CV Mejorado con IA</h2>
          {!generatedCV ? (
            <div>
              <p className="mb-4 text-gray-600">
                Genera un CV mejorado basado en todos tus resultados
              </p>
              <button
                onClick={handleGenerateCV}
                disabled={generating}
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
              >
                {generating ? 'Generando...' : 'Generar CV Mejorado'}
              </button>
            </div>
          ) : (
            <div className="mt-4">
              <div className="bg-gray-50 p-4 rounded whitespace-pre-wrap">
                {generatedCV}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Results;

