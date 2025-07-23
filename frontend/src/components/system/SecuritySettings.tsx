import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  InputNumber, 
  Button, 
  message, 
  Spin, 
  Space, 
  Switch,
  Alert,
  Divider 
} from 'antd';
import { SaveOutlined, SecurityScanOutlined } from '@ant-design/icons';
import api from '../../services/api';

interface SecurityConfig {
  password_min_length: number;
  password_require_uppercase: boolean;
  password_require_lowercase: boolean;
  password_require_numbers: boolean;
  password_require_symbols: boolean;
  login_max_attempts: number;
  login_lockout_duration: number;
  enable_two_factor: boolean;
  force_password_change_days: number;
}

const SecuritySettings: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSecuritySettings = async () => {
    setLoading(true);
    try {
      const response = await api.get('/config/', {
        params: { category: 'security' }
      });
      
      // 将配置数组转换为对象
      const configObj: any = {};
      response.data.forEach((config: any) => {
        configObj[config.key] = config.value;
      });
      
      form.setFieldsValue({
        password_min_length: parseInt(configObj.password_min_length || '6'),
        password_require_uppercase: configObj.password_require_uppercase === 'true',
        password_require_lowercase: configObj.password_require_lowercase === 'true',
        password_require_numbers: configObj.password_require_numbers === 'true',
        password_require_symbols: configObj.password_require_symbols === 'true',
        login_max_attempts: parseInt(configObj.login_max_attempts || '5'),
        login_lockout_duration: parseInt(configObj.login_lockout_duration || '30'),
        enable_two_factor: configObj.enable_two_factor === 'true',
        force_password_change_days: parseInt(configObj.force_password_change_days || '90')
      });
    } catch (error: any) {
      message.error('获取安全配置失败：' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecuritySettings();
  }, []);

  const handleSave = async (values: SecurityConfig) => {
    setSaving(true);
    try {
      // 将表单值转换为配置项
      const configItems = [
        { key: 'password_min_length', value: String(values.password_min_length), category: 'security', description: '密码最小长度' },
        { key: 'password_require_uppercase', value: String(values.password_require_uppercase), category: 'security', description: '密码需要大写字母' },
        { key: 'password_require_lowercase', value: String(values.password_require_lowercase), category: 'security', description: '密码需要小写字母' },
        { key: 'password_require_numbers', value: String(values.password_require_numbers), category: 'security', description: '密码需要数字' },
        { key: 'password_require_symbols', value: String(values.password_require_symbols), category: 'security', description: '密码需要特殊符号' },
        { key: 'login_max_attempts', value: String(values.login_max_attempts), category: 'security', description: '最大登录尝试次数' },
        { key: 'login_lockout_duration', value: String(values.login_lockout_duration), category: 'security', description: '账户锁定时长（分钟）' },
        { key: 'enable_two_factor', value: String(values.enable_two_factor), category: 'security', description: '启用双因素认证' },
        { key: 'force_password_change_days', value: String(values.force_password_change_days), category: 'security', description: '强制密码更改周期（天）' }
      ];

      // 逐个创建或更新配置
      for (const item of configItems) {
        try {
          // 先尝试获取现有配置
          const existing = await api.get('/config/', {
            params: { category: 'security' }
          });
          const existingConfig = existing.data.find((c: any) => c.key === item.key);
          
          if (existingConfig) {
            // 更新现有配置
            await api.put(`/config/${existingConfig.id}`, {
              value: item.value
            });
          } else {
            // 创建新配置
            await api.post('/config/', item);
          }
        } catch (error) {
          console.error(`更新配置项 ${item.key} 失败:`, error);
        }
      }
      
      message.success('安全配置保存成功');
    } catch (error: any) {
      message.error('保存失败：' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <Card title="安全设置" extra={<SecurityScanOutlined />}>
        <Alert
          message="安全提示"
          description="修改安全设置可能会影响系统的安全性和用户体验，请谨慎操作。"
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
        
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          style={{ maxWidth: 600 }}
        >
          <Divider orientation="left">密码策略</Divider>
          
          <Form.Item
            name="password_min_length"
            label="密码最小长度"
            rules={[
              { required: true, message: '请输入密码最小长度' },
              { type: 'number', min: 6, max: 32, message: '长度应在6-32之间' }
            ]}
          >
            <InputNumber min={6} max={32} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="password_require_uppercase"
            label="需要包含大写字母"
            valuePropName="checked"
          >
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>

          <Form.Item
            name="password_require_lowercase"
            label="需要包含小写字母"
            valuePropName="checked"
          >
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>

          <Form.Item
            name="password_require_numbers"
            label="需要包含数字"
            valuePropName="checked"
          >
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>

          <Form.Item
            name="password_require_symbols"
            label="需要包含特殊符号"
            valuePropName="checked"
          >
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>

          <Form.Item
            name="force_password_change_days"
            label="密码强制更改周期（天）"
            tooltip="设置为0表示不强制更改密码"
          >
            <InputNumber min={0} max={365} style={{ width: '100%' }} />
          </Form.Item>

          <Divider orientation="left">登录安全</Divider>

          <Form.Item
            name="login_max_attempts"
            label="最大登录尝试次数"
            tooltip="连续登录失败达到此次数后账户将被锁定"
          >
            <InputNumber min={3} max={10} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="login_lockout_duration"
            label="账户锁定时长（分钟）"
            tooltip="账户被锁定后需要等待的时间"
          >
            <InputNumber min={5} max={1440} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="enable_two_factor"
            label="启用双因素认证"
            valuePropName="checked"
            tooltip="需要用户配置手机验证器"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={saving}
                icon={<SaveOutlined />}
              >
                保存设置
              </Button>
              <Button onClick={() => fetchSecuritySettings()}>
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </Spin>
  );
};

export default SecuritySettings;