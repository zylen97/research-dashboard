import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from 'antd';
import MainLayout from './components/MainLayout';
import ResearchDashboard from './pages/ResearchDashboard';
import CollaboratorManagement from './pages/CollaboratorManagement';
import LiteratureDiscovery from './pages/LiteratureDiscovery';
import IdeaManagement from './pages/IdeaManagement';
import { ThemeProvider } from './theme/ThemeContext';

const { Content } = Layout;

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <MainLayout>
        <Content style={{ margin: '24px 16px', padding: 24, minHeight: 280 }}>
          <Routes>
            <Route path="/" element={<ResearchDashboard />} />
            <Route path="/research" element={<ResearchDashboard />} />
            <Route path="/collaborators" element={<CollaboratorManagement />} />
            <Route path="/literature" element={<LiteratureDiscovery />} />
            <Route path="/ideas" element={<IdeaManagement />} />
          </Routes>
        </Content>
      </MainLayout>
    </ThemeProvider>
  );
};

export default App;
