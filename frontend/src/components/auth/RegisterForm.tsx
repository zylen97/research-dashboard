import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Space, Divider } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, UserAddOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import { UserCreate } from '../../types';

const { Title, Text } = Typography;

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const { register } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [form] = Form.useForm();

  const handleRegister = async (values: UserCreate) => {
    setIsLoading(true);
    try {
      await register(values);
      // 注册成功后直接跳转到登录
      onSwitchToLogin();
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
          <UserAddOutlined style={{ marginRight: 8, color: '#1890ff' }} />
          注册账号
        </Title>
        <Text type="secondary">创建您的研究协作账号</Text>
      </div>
      
      <Form
        form={form}
        layout="vertical"
        onFinish={handleRegister}
        autoComplete="off"
      >
        <Form.Item
          name="username"
          label="用户名"
          rules={[
            { required: true, message: '请输入用户名' },
            { min: 3, message: '用户名至少3个字符' },
            { max: 50, message: '用户名最多50个字符' },
            { pattern: /^[a-zA-Z0-9_]+$/, message: '用户名只能包含字母、数字和下划线' }
          ]}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder="请输入用户名"
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="email"
          label="邮箱"
          rules={[
            { required: true, message: '请输入邮箱' },
            { type: 'email', message: '请输入有效的邮箱地址' }
          ]}
        >
          <Input
            prefix={<MailOutlined />}
            placeholder="请输入邮箱地址"
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="display_name"
          label="显示名称"
          rules={[
            { required: true, message: '请输入显示名称' },
            { min: 2, message: '显示名称至少2个字符' },
            { max: 100, message: '显示名称最多100个字符' }
          ]}
        >
          <Input
            placeholder="请输入显示名称"
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

        <Form.Item
          name="confirmPassword"
          label="确认密码"
          dependencies={['password']}
          rules={[
            { required: true, message: '请确认密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('两次输入的密码不一致'));
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="请再次输入密码"
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
            注册
          </Button>
        </Form.Item>
      </Form>

      <Divider />

      <Button type="link" onClick={onSwitchToLogin} block>
        已有账号？立即登录
      </Button>
    </Card>
  );
};

export default RegisterForm;