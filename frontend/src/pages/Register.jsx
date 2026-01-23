import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/axios';
import logo from '../assets/logo.png';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    dob: '',
    gender: '',
    academic_level: '',
    program: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Calculate age from date of birth
  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    
    // Validate date is valid
    if (isNaN(birthDate.getTime())) {
      return null;
    }
    
    // Validate date is not in the future
    if (birthDate > today) {
      return null;
    }
    
    // Validate date is reasonable (not before 1900)
    const minYear = 1900;
    if (birthDate.getFullYear() < minYear) {
      return null;
    }
    
    // Validate date is not too old (not more than 120 years)
    const maxAge = 120;
    const minDate = new Date();
    minDate.setFullYear(today.getFullYear() - maxAge);
    if (birthDate < minDate) {
      return null;
    }
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear error when user changes date of birth
    if (e.target.name === 'dob' && error) {
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validate age requirement (must be at least 17 years old)
    if (formData.dob) {
      const age = calculateAge(formData.dob);
      if (age === null) {
        setError('Please enter a valid date of birth. The date must be between 1900 and today, and you must be at least 17 years old.');
        return;
      }
      if (age < 17) {
        setError('You must be at least 17 years old to register.');
        return;
      }
      if (age > 120) {
        setError('Please enter a valid date of birth.');
        return;
      }
    }

    setLoading(true);

    try {
      const result = await api.post('/auth/register', formData);
      if (result.data) {
        // ACTIVACIÓN POR ADMIN - COMENTADO: Mensaje actualizado para registro automático
        // alert('Registration successful. Your account will be activated by an administrator.');
        alert('Registration successful. You can now log in.');
        navigate('/login');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error registering');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-8">
      <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md w-full max-w-md">
        <div className="flex justify-center mb-4">
          <img
            src={logo}
            alt="Mirai Innovation"
            className="h-10 w-auto object-contain"
          />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold mb-6 text-center">Register</h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Full Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
              minLength={6}
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Date of Birth
            </label>
            <input
              type="date"
              name="dob"
              value={formData.dob}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Gender
            </label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            >
              <option value="">Select...</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Academic Level
            </label>
            <select
              name="academic_level"
              value={formData.academic_level}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            >
              <option value="">Select...</option>
              <option value="High School Level">High School Level</option>
              <option value="University Level">University Level</option>
              <option value="Postgraduate Level">Postgraduate Level</option>
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Program
            </label>
            <select
              name="program"
              value={formData.program}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            >
              <option value="">Select...</option>
              <option value="MIRI">MIRI</option>
              <option value="EMFUTECH">EMFUTECH</option>
              <option value="JCTI">JCTI</option>
              <option value="FUTURE_INNOVATORS_JAPAN">Future Innovators Japan selection entry</option>
              <option value="OTHER">OTHER</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm space-y-2">
          <p>
            Already have an account?{' '}
            <a href="/login" className="text-blue-500 hover:underline">
              Sign in here
            </a>
          </p>
          <p>
            <Link to="/" className="text-gray-500 hover:text-gray-700 hover:underline">
              ← Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;

