import { Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

// Managers and admins can open manager pages; everyone else goes to their dashboard
const ManagerRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!['manager', 'admin'].includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ManagerRoute;
