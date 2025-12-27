import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import ResearchDashboard from './pages/ResearchDashboard';
import CollaboratorManagement from './pages/CollaboratorManagement';
import IdeasManagement from './pages/IdeasManagement';
import DatabaseBackup from './pages/DatabaseBackup';

const App: React.FC = () => {
  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<ResearchDashboard />} />
        <Route path="/research" element={<Navigate to="/dashboard" replace />} />
        <Route path="/collaborators" element={<CollaboratorManagement />} />
        <Route path="/ideas-management" element={<IdeasManagement />} />
        <Route path="/backup" element={<DatabaseBackup />} />
      </Routes>
    </MainLayout>
  );
};

export default App;
