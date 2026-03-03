import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import CVUpload from './pages/CVUpload';
import Interview from './pages/Interview';
import Results from './pages/Results';
import AdminPanel from './pages/AdminPanel';
import AdminInvoiceStats from './pages/AdminInvoiceStats';
import ApplicationForm from './pages/ApplicationForm';
import ScheduleScreening from './pages/ScheduleScreening';
import ReportProblem from './pages/ReportProblem';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/application-form"
            element={
              <PrivateRoute>
                <ApplicationForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/schedule-screening"
            element={
              <PrivateRoute>
                <ScheduleScreening />
              </PrivateRoute>
            }
          />
          <Route
            path="/cv-upload"
            element={
              <PrivateRoute>
                <CVUpload />
              </PrivateRoute>
            }
          />
          <Route
            path="/interview"
            element={
              <PrivateRoute>
                <Interview />
              </PrivateRoute>
            }
          />
          <Route
            path="/results"
            element={
              <PrivateRoute>
                <Results />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminPanel />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/invoice-stats"
            element={
              <AdminRoute>
                <AdminInvoiceStats />
              </AdminRoute>
            }
          />
          <Route
            path="/report"
            element={
              <PrivateRoute>
                <ReportProblem />
              </PrivateRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

