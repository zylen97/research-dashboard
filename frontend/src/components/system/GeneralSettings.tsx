import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Spin, Space, Switch } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import api from '../../services/api';

interface GeneralConfig {
  system_name: string;
  system_description?: string;
  maintenance_mode: boolean;
  max_file_size: number;
  session_timeout: number;
}

const GeneralSettings: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchGeneralSettings();
  }, []);

  const fetchGeneralSettings = async () => {
    setLoading(true);
    try {
      const response = await api.get('/config/', {
        params: { category: 'system' }
      });
      
      // 将配置数组转换为对象
      const configObj: any = {};
      response.data.forEach((config: any) => {
        configObj[config.key] = config.value;
      });
      
      form.setFieldsValue({
        system_name: configObj.system_name || 'USTS科研管理系统',
        system_description: configObj.system_description || '',
        maintenance_mode: configObj.maintenance_mode === 'true',
        max_file_size: parseInt(configObj.max_file_size || '10'),
        session_timeout: parseInt(configObj.session_timeout || '30')
      });
    } catch (error: any) {
      message.error('获取系统配置失败：' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values: GeneralConfig) => {
    setSaving(true);
    try {
      // 将表单值转换为配置项
      const configItems = [
        { key: 'system_name', value: values.system_name, category: 'system', description: '系统名称' },
        { key: 'system_description', value: values.system_description || '', category: 'system', description: '系统描述' },
        { key: 'maintenance_mode', value: String(values.maintenance_mode), category: 'system', description: '维护模式' },
        { key: 'max_file_size', value: String(values.max_file_size), category: 'system', description: '最大文件大小(MB)' },
        { key: 'session_timeout', value: String(values.session_timeout), category: 'system', description: '会话超时时间(分钟)' }
      ];

      // 逐个创建或更新配置
      for (const item of configItems) {
        try {
          // 先尝试获取现有配置
          const existing = await api.get('/config/', {
            params: { category: 'system' }
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
      
      message.success('系统配置保存成功');
    } catch (error: any) {
      message.error('保存失败：' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <Card title="通用设置">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          style={{ maxWidth: 600 }}
        >
          <Form.Item
            name="system_name"
            label="系统名称"
            rules={[{ required: true, message: '请输入系统名称' }]}
          >
            <Input placeholder="输入系统名称" />
          </Form.Item>

          <Form.Item
            name="system_description"
            label="系统描述"
          >
            <Input.TextArea 
              rows={3}
              placeholder="输入系统描述信息"
            />
          </Form.Item>

          <Form.Item
            name="maintenance_mode"
            label="维护模式"
            valuePropName="checked"
            tooltip="开启后，除管理员外的用户将无法访问系统"
          >
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>

          <Form.Item
            name="max_file_size"
            label="最大文件上传大小（MB）"
            rules={[
              { required: true, message: '请输入最大文件大小' },
              { type: 'number', min: 1, max: 100, message: '文件大小应在1-100MB之间' }
            ]}
          >
            <Input type="number" suffix="MB" />
          </Form.Item>

          <Form.Item
            name="session_timeout"
            label="会话超时时间（分钟）"
            rules={[
              { required: true, message: '请输入会话超时时间' },
              { type: 'number', min: 5, max: 1440, message: '超时时间应在5-1440分钟之间' }
            ]}
          >
            <Input type="number" suffix="分钟" />
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
              <Button onClick={() => fetchGeneralSettings()}>
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </Spin>
  );
};

export default GeneralSettings;