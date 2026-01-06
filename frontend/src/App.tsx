import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import './styles/resizable-table.css';
import bauHausTheme from './config/theme';
import MainLayout from './components/MainLayout';
import ResearchDashboard from './pages/ResearchDashboard';
import CollaboratorManagement from './pages/CollaboratorManagement';
import IdeasManagement from './pages/IdeasManagement';
import JournalsManagement from './pages/JournalsManagement';
import PapersManagement from './pages/PapersManagement';
import DatabaseBackup from './pages/DatabaseBackup';
import PromptsManagement from './pages/PromptsManagement';

const App: React.FC = () => {
  return (
    <ConfigProvider theme={bauHausTheme} locale={zhCN}>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<ResearchDashboard />} />
          <Route path="/research" element={<Navigate to="/dashboard" replace />} />
          <Route path="/collaborators" element={<CollaboratorManagement />} />
          <Route path="/ideas-management" element={<IdeasManagement />} />
          <Route path="/journals" element={<JournalsManagement />} />
          <Route path="/papers" element={<PapersManagement />} />
          <Route path="/prompts" element={<PromptsManagement />} />
          <Route path="/backup" element={<DatabaseBackup />} />
        </Routes>
      </MainLayout>
    </ConfigProvider>
  );
};

export default App;
