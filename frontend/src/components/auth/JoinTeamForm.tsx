import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Space, Divider } from 'antd';
import { UserOutlined, LockOutlined, TeamOutlined, KeyOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import { TeamJoinRequest } from '../../types';

const { Title, Text } = Typography;

interface JoinTeamFormProps {
  onSwitchToLogin: () => void;
  onSwitchToRegister: () => void;
}

const JoinTeamForm: React.FC<JoinTeamFormProps> = ({ onSwitchToLogin, onSwitchToRegister }) => {
  const { joinTeam } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [form] = Form.useForm();

  const handleSubmit = async (values: TeamJoinRequest) => {
    setIsLoading(true);
    try {
      await joinTeam(values);
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
          <TeamOutlined style={{ marginRight: 8, color: '#1890ff' }} />
          加入团队
        </Title>
        <Text type="secondary">使用邀请码加入现有团队</Text>
      </div>

      <div style={{ 
        background: '#e6f7ff', 
        border: '1px solid #91d5ff',
        borderRadius: 6,
        padding: 16,
        marginBottom: 24 
      }}>
        <Text>
          <KeyOutlined style={{ marginRight: 8 }} />
          请输入团队管理员提供的邀请码以及您的账号信息
        </Text>
      </div>
      
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
      >
        <Form.Item
          name="invite_code"
          label="邀请码"
          rules={[
            { required: true, message: '请输入邀请码' },
            { min: 6, message: '邀请码格式不正确' }
          ]}
        >
          <Input
            prefix={<KeyOutlined />}
            placeholder="请输入团队邀请码"
            size="large"
            style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
            onChange={(e) => {
              // 自动转换为大写
              const value = e.target.value.toUpperCase();
              form.setFieldsValue({ invite_code: value });
            }}
          />
        </Form.Item>

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
            placeholder="请输入您的用户名"
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
            placeholder="请输入您的密码"
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
            加入团队
          </Button>
        </Form.Item>
      </Form>

      <Divider>其他选项</Divider>

      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <Button type="link" onClick={onSwitchToLogin} block>
          返回登录
        </Button>
        <Button type="link" onClick={onSwitchToRegister} block>
          还没有账号？立即注册
        </Button>
      </Space>

      <div style={{ 
        marginTop: 16, 
        padding: 12, 
        background: '#fafafa', 
        borderRadius: 4,
        fontSize: 12 
      }}>
        <Text type="secondary">
          💡 提示：如果您还没有账号，请先注册。如果您是团队创建者，请直接注册并创建团队。
        </Text>
      </div>
    </Card>
  );
};

export default JoinTeamForm;