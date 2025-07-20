import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Space, Divider } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, TeamOutlined, UserAddOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import { UserCreate, TeamCreateRequest } from '../../types';

const { Title, Text } = Typography;

interface RegisterFormProps {
  onSwitchToLogin: () => void;
  onSwitchToJoinTeam: () => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin, onSwitchToJoinTeam }) => {
  const { register, createTeam } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [registrationStep, setRegistrationStep] = useState<'register' | 'create-team' | 'success'>('register');
  const [userData, setUserData] = useState<UserCreate | null>(null);
  const [inviteCode, setInviteCode] = useState<string>('');
  const [form] = Form.useForm();
  const [teamForm] = Form.useForm();

  const handleRegister = async (values: UserCreate) => {
    setIsLoading(true);
    try {
      await register(values);
      setUserData(values);
      setRegistrationStep('create-team');
    } catch (error) {
      // 错误已经在AuthContext中处理
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTeam = async (values: any) => {
    if (!userData) return;
    
    setIsLoading(true);
    try {
      const teamData: TeamCreateRequest = {
        ...values,
        username: userData.username,
        password: userData.password,
      };
      
      const result = await createTeam(teamData);
      setInviteCode(result.invite_code);
      setRegistrationStep('success');
    } catch (error) {
      // 错误已经在AuthContext中处理
    } finally {
      setIsLoading(false);
    }
  };

  const copyInviteCode = () => {
    navigator.clipboard.writeText(inviteCode);
  };

  if (registrationStep === 'success') {
    return (
      <Card className="auth-card" style={{ width: 400, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0, color: '#52c41a' }}>
            🎉 注册成功！
          </Title>
          <Text type="secondary">您的团队已创建完成</Text>
        </div>

        <div style={{ 
          background: '#f6ffed', 
          border: '1px solid #b7eb8f',
          borderRadius: 6,
          padding: 16,
          marginBottom: 24,
          textAlign: 'center'
        }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            团队邀请码
          </Text>
          <Text copyable={{ onCopy: copyInviteCode }} style={{ 
            fontSize: 18, 
            fontFamily: 'monospace',
            color: '#389e0d',
            fontWeight: 'bold'
          }}>
            {inviteCode}
          </Text>
          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              分享此邀请码给团队成员，他们可以使用此码加入您的团队
            </Text>
          </div>
        </div>

        <Button
          type="primary"
          size="large"
          block
          onClick={onSwitchToLogin}
        >
          返回登录
        </Button>
      </Card>
    );
  }

  if (registrationStep === 'create-team') {
    return (
      <Card className="auth-card" style={{ width: 400, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0 }}>
            <TeamOutlined style={{ marginRight: 8, color: '#1890ff' }} />
            创建团队
          </Title>
          <Text type="secondary">为您的协作研究创建一个团队</Text>
        </div>
        
        <Form
          form={teamForm}
          layout="vertical"
          onFinish={handleCreateTeam}
          autoComplete="off"
        >
          <Form.Item
            name="name"
            label="团队名称"
            rules={[
              { required: true, message: '请输入团队名称' },
              { min: 2, message: '团队名称至少2个字符' }
            ]}
          >
            <Input
              prefix={<TeamOutlined />}
              placeholder="例如：AI研究小组"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="团队描述（可选）"
          >
            <Input.TextArea
              placeholder="简单介绍一下您的研究团队..."
              rows={3}
            />
          </Form.Item>

          <Form.Item
            name="max_members"
            label="最大成员数"
            initialValue={10}
            rules={[{ required: true, message: '请设置最大成员数' }]}
          >
            <Input
              type="number"
              min={2}
              max={50}
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
              创建团队
            </Button>
          </Form.Item>
        </Form>

        <Button type="link" onClick={onSwitchToLogin} block>
          返回登录
        </Button>
      </Card>
    );
  }

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

      <Divider>其他选项</Divider>

      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <Button type="link" onClick={onSwitchToLogin} block>
          已有账号？立即登录
        </Button>
        <Button type="link" onClick={onSwitchToJoinTeam} block>
          有邀请码？加入团队
        </Button>
      </Space>
    </Card>
  );
};

export default RegisterForm;