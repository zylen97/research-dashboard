import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
// 测试Ultra Think修复的智能部署 - 前端修改不应触发后端重启
import MainLayout from './components/MainLayout';
import ResearchDashboard from './pages/ResearchDashboard';
import CollaboratorManagement from './pages/CollaboratorManagement';
import IdeaDiscovery from './pages/IdeaDiscovery';
import IdeasManagementPage from './pages/IdeasManagement';
import AuthPage from './pages/AuthPage';
import DatabaseBackup from './pages/DatabaseBackup';
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
        <Route path="/ideas" element={<IdeaDiscovery />} />
        <Route path="/ideas-management" element={<IdeasManagementPage />} />
        <Route path="/backup" element={<DatabaseBackup />} />
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
