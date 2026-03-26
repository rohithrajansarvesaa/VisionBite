import React, { useCallback, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PrivateRoute, StaffRoute, UserOnlyRoute } from './components/ProtectedRoutes';
import { AppLoadingScreen } from './components/AppLoadingScreen';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import VisionBitePage from './pages/VisionBitePage';
import UserMenuPage from './pages/UserMenuPage';
import CustomerMenuPage from './pages/CustomerMenuPage';
import './index.css';

export const App: React.FC = () => {
  const [isBootComplete, setIsBootComplete] = useState(false);

  const handleBootComplete = useCallback(() => {
    setIsBootComplete(true);
  }, []);

  if (!isBootComplete) {
    return <AppLoadingScreen onComplete={handleBootComplete} />;
  }

  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/dashboard"
            element={
              <StaffRoute>
                <DashboardPage />
              </StaffRoute>
            }
          />
          <Route
            path="/menu"
            element={
              <UserOnlyRoute>
                <UserMenuPage />
              </UserOnlyRoute>
            }
          />
          <Route path="/customer" element={<CustomerMenuPage />} />
                    <Route
                      path="/visionbite"
                      element={
                        <PrivateRoute>
                          <VisionBitePage />
                        </PrivateRoute>
                      }
                    />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
};

export default App;
