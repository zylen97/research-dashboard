import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import ResearchDashboard from './pages/ResearchDashboard';
import CollaboratorManagement from './pages/CollaboratorManagement';
import LiteratureDiscovery from './pages/LiteratureDiscovery';
import IdeaManagement from './pages/IdeaManagement';
import AuthPage from './pages/AuthPage';
import DatabaseBackup from './pages/DatabaseBackup';
import SystemSettings from './pages/SystemSettings';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// 受保护的路由组件
const ProtectedRoutes: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div>正在加载...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<ResearchDashboard />} />
        <Route path="/research" element={<Navigate to="/dashboard" replace />} />
        <Route path="/collaborators" element={<CollaboratorManagement />} />
        <Route path="/literature" element={<LiteratureDiscovery />} />
        <Route path="/ideas" element={<IdeaManagement />} />
        <Route path="/backup" element={<DatabaseBackup />} />
        <Route path="/settings" element={<SystemSettings />} />
        <Route path="/auth" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </MainLayout>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ProtectedRoutes />
    </AuthProvider>
  );
};

export default App;
