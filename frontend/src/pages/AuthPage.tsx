import React from 'react';
import { Layout, Row, Col } from 'antd';
import LoginForm from '../components/auth/LoginForm';

const { Content } = Layout;

const AuthPage: React.FC = () => {
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
        <Row justify="center" style={{ width: '100%' }}>
          <Col xs={24} sm={20} md={12} lg={10} xl={8}>
            <LoginForm />
          </Col>
        </Row>
      </Content>
    </Layout>
  );
};

export default AuthPage;