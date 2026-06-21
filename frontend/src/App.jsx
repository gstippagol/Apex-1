import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import StudentDashboard from './pages/StudentDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ExamPage from './pages/ExamPage';
import ResultPage from './pages/ResultPage';
import ExamDetails from './pages/ExamDetails';
import EvaluationPage from './pages/EvaluationPage';
import Account from './pages/Account';
import QuizPage from './pages/QuizPage';
import QuizDetails from './pages/QuizDetails';


const ProtectedRoute = ({ children, role }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) {
    // Allow superadmin to access admin routes
    if (role === 'admin' && user.role === 'superadmin') {
      return children;
    }
    return <Navigate to="/" />;
  }

  return children;
};

import NotificationHandler from './components/NotificationHandler';

function App() {
  return (
    <AuthProvider>
      <Router>
        <NotificationHandler />
        <Toaster position="top-right" />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route path="/student/*" element={
            <ProtectedRoute role="student">
              <StudentDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/evaluate" element={
            <ProtectedRoute role="admin">
              <Navigate to="/admin?tab=evaluate" replace />
            </ProtectedRoute>
          } />



          <Route path="/exam/:id" element={
            <ProtectedRoute role="student">
              <ExamPage />
            </ProtectedRoute>
          } />

          <Route path="/admin/exam/:id" element={
            <ProtectedRoute role="admin">
              <ExamDetails />
            </ProtectedRoute>
          } />

          <Route path="/quiz/:id" element={
            <ProtectedRoute role="student">
              <QuizPage />
            </ProtectedRoute>
          } />

          <Route path="/admin/quiz/:id" element={
            <ProtectedRoute role="admin">
              <QuizDetails />
            </ProtectedRoute>
          } />

          <Route path="/admin/*" element={
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          } />

          <Route path="/result/:id" element={
            <ProtectedRoute>
              <ResultPage />
            </ProtectedRoute>
          } />
          <Route path="/account" element={
            <ProtectedRoute>
              <Account />
            </ProtectedRoute>
          } />
          </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
