import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Divider } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import { UserLogin } from '../../types';

const { Title, Text } = Typography;

const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [form] = Form.useForm();

  const handleSubmit = async (values: UserLogin) => {
    setIsLoading(true);
    try {
      await login(values);
      form.resetFields();
    } catch (error) {
      // 错误已经在AuthContext中处理
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="auth-card" style={{ width: 400, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <UserOutlined style={{ marginRight: 8, color: '#1890ff' }} />
          研究看板登录
        </Title>
        <Text type="secondary">登录到您的协作平台</Text>
      </div>
      
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
      >
        <Form.Item
          name="username"
          label="用户名"
          rules={[
            { required: true, message: '请输入用户名' },
            { min: 3, message: '用户名至少3个字符' }
          ]}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder="请输入用户名"
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="password"
          label="密码"
          rules={[
            { required: true, message: '请输入密码' },
            { min: 6, message: '密码至少6个字符' }
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="请输入密码"
            size="large"
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={isLoading}
            size="large"
            block
          >
            登录
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default LoginForm;