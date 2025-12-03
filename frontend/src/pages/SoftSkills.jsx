import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../utils/axios';

const SoftSkills = () => {
  const [responses, setResponses] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      const response = await api.get('/users/profile');
      if (response.data.softSkillsResults) {
        setResults(response.data.softSkillsResults);
      }
    } catch (error) {
      console.error('Error obteniendo resultados:', error);
    }
  };

  const handleChange = (questionNum, value) => {
    setResponses({
      ...responses,
      [questionNum]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const response = await api.post('/users/submit-soft-skills', { responses });
      setMessage('Encuesta enviada exitosamente');
      setResults(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al enviar la encuesta');
    } finally {
      setSubmitting(false);
    }
  };

  if (results) {
    return (
      <div>
        <Navbar />
        <div className="container mx-auto p-6">
          <h1 className="text-3xl font-bold mb-6">Resultados - Habilidades Blandas</h1>
          <div className="bg-white p-6 rounded-lg shadow mb-4">
            <p className="text-2xl font-bold text-blue-600">
              Score Total: {results.totalScore}/800
            </p>
            <p className="text-lg font-semibold mt-2">
              Nivel Institucional: {results.institutionalLevel}
            </p>
          </div>
          {results.results && Object.entries(results.results).map(([competency, data]) => (
            <div key={competency} className="bg-white p-6 rounded-lg shadow mb-4">
              <h3 className="text-xl font-semibold mb-2">{competency}</h3>
              <p className="text-gray-600">Score: {data.score}</p>
              <p className="text-gray-600">Nivel: {data.level}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Cuestionario de Habilidades Blandas</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow">
          <p className="mb-4 text-gray-600">
            Responde cada pregunta con una escala del 1 al 5 (1 = Muy bajo, 5 = Muy alto)
          </p>
          {Array.from({ length: 160 }, (_, i) => i + 1).map((num) => (
            <div key={num} className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Pregunta {num}
              </label>
              <select
                value={responses[num] || ''}
                onChange={(e) => handleChange(num, e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                required
              >
                <option value="">Selecciona...</option>
                <option value="1">1 - Muy bajo</option>
                <option value="2">2 - Bajo</option>
                <option value="3">3 - Medio</option>
                <option value="4">4 - Alto</option>
                <option value="5">5 - Muy alto</option>
              </select>
            </div>
          ))}
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            {submitting ? 'Enviando...' : 'Enviar Respuestas'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SoftSkills;

