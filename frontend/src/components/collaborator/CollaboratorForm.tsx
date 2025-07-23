import React from 'react';
import { Form, Input, Select, FormInstance } from 'antd';

const { TextArea } = Input;
const { Option } = Select;

interface CollaboratorFormProps {
  form: FormInstance;
}

export const CollaboratorForm: React.FC<CollaboratorFormProps> = ({ form }) => {
  return (
    <Form form={form} layout="vertical">
      <Form.Item
        name="name"
        label="姓名"
        rules={[{ required: true, message: '请输入姓名' }]}
      >
        <Input placeholder="请输入合作者姓名" />
      </Form.Item>

      <Form.Item
        name="gender"
        label="性别"
        rules={[{ required: true, message: '请选择性别' }]}
      >
        <Select placeholder="请选择性别">
          <Option value="男">男</Option>
          <Option value="女">女</Option>
        </Select>
      </Form.Item>

      <Form.Item
        name="class_name"
        label="班级"
        rules={[{ required: true, message: '请输入班级' }]}
      >
        <Input placeholder="请输入班级，如：计科221" />
      </Form.Item>

      <Form.Item
        name="student_id"
        label="学号"
        rules={[{ required: true, message: '请输入学号' }]}
      >
        <Input placeholder="请输入学号" />
      </Form.Item>

      <Form.Item
        name="phone"
        label="电话"
      >
        <Input placeholder="请输入电话号码" />
      </Form.Item>

      <Form.Item
        name="email"
        label="邮箱"
        rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
      >
        <Input placeholder="请输入邮箱地址" />
      </Form.Item>

      <Form.Item
        name="qq"
        label="QQ"
      >
        <Input placeholder="请输入QQ号" />
      </Form.Item>

      <Form.Item
        name="wechat"
        label="微信"
      >
        <Input placeholder="请输入微信号" />
      </Form.Item>

      <Form.Item
        name="skills"
        label="技能专长"
      >
        <TextArea rows={3} placeholder="请输入技能专长，如：Python, React, 数据分析等" />
      </Form.Item>

      <Form.Item
        name="research_interests"
        label="研究兴趣"
      >
        <TextArea rows={3} placeholder="请输入研究兴趣领域" />
      </Form.Item>

      <Form.Item
        name="future_plans"
        label="未来规划"
      >
        <TextArea rows={4} placeholder="请输入未来规划，使用数字序号分点描述，如：\n1. 考研到985高校\n2. 发表高质量论文\n3. 参与开源项目" />
      </Form.Item>

      <Form.Item
        name="background"
        label="背景资料"
      >
        <TextArea rows={4} placeholder="请输入背景资料，如教育经历、实习经验、获奖情况等" />
      </Form.Item>

      <Form.Item
        name="is_advanced"
        label="高级合作者"
        valuePropName="checked"
      >
        <Select placeholder="请选择是否为高级合作者" defaultValue={false}>
          <Option value={true}>是</Option>
          <Option value={false}>否</Option>
        </Select>
      </Form.Item>
    </Form>
  );
};