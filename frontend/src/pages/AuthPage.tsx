import React, { useState } from 'react';
import { Layout, Row, Col } from 'antd';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';
import JoinTeamForm from '../components/auth/JoinTeamForm';

const { Content } = Layout;

type AuthMode = 'login' | 'register' | 'join-team';

const AuthPage: React.FC = () => {
  const [authMode, setAuthMode] = useState<AuthMode>('login');

  const renderAuthForm = () => {
    switch (authMode) {
      case 'login':
        return (
          <LoginForm
            onSwitchToRegister={() => setAuthMode('register')}
            onSwitchToJoinTeam={() => setAuthMode('join-team')}
          />
        );
      case 'register':
        return (
          <RegisterForm
            onSwitchToLogin={() => setAuthMode('login')}
            onSwitchToJoinTeam={() => setAuthMode('join-team')}
          />
        );
      case 'join-team':
        return (
          <JoinTeamForm
            onSwitchToLogin={() => setAuthMode('login')}
            onSwitchToRegister={() => setAuthMode('register')}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Content 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '20px'
        }}
      >
        <Row justify="center" align="middle" style={{ width: '100%' }}>
          <Col xs={24} sm={20} md={16} lg={12} xl={8}>
            <div style={{ 
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: 12,
              padding: 20,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              backdropFilter: 'blur(10px)'
            }}>
              {renderAuthForm()}
            </div>
          </Col>
        </Row>
      </Content>
    </Layout>
  );
};

export default AuthPage;