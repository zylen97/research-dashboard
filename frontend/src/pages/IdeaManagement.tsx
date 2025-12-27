import React, { useState } from 'react';
import {
  Card,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Typography,
  Space,
  message,
  Statistic,
  Table,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  BulbOutlined,
  ProjectOutlined,
  DeleteOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ideaApi, collaboratorApi } from '../services/api';
import { Idea, IdeaCreate } from '../types';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Search } = Input;

const IdeaManagement: React.FC = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isConvertModalVisible, setIsConvertModalVisible] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [convertingIdea, setConvertingIdea] = useState<Idea | null>(null);
  const [searchText, setSearchText] = useState('');
  const [maturityFilter, setMaturityFilter] = useState<string>('');
  const [form] = Form.useForm();
  const [convertForm] = Form.useForm();
  const queryClient = useQueryClient();

  // 获取idea数据
  const { data: ideas = [], isLoading } = useQuery({
    queryKey: ['ideas', maturityFilter],
    queryFn: () => {
      const params: any = {};
      if (maturityFilter) params.maturity = maturityFilter;
      return ideaApi.getIdeas(params);
    },
  });

  // 获取合作者数据
  const { data: collaborators = [] } = useQuery({
    queryKey: ['collaborators'],
    queryFn: () => collaboratorApi.getCollaborators(),
  });

  // 创建idea mutation
  const createIdeaMutation = useMutation({
    mutationFn: ideaApi.createIdea,
    onSuccess: () => {
      message.success('Idea创建成功！');
      setIsModalVisible(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
    },
    onError: (error: any) => {
      message.error('创建失败：' + error.message);
    },
  });

  // 更新idea mutation
  const updateIdeaMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      ideaApi.updateIdea(id, data),
    onSuccess: () => {
      message.success('Idea更新成功！');
      setIsModalVisible(false);
      setEditingIdea(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
    },
    onError: (error: any) => {
      message.error('更新失败：' + error.message);
    },
  });

  // 删除idea mutation
  const deleteIdeaMutation = useMutation({
    mutationFn: ideaApi.deleteIdea,
    onSuccess: () => {
      message.success('Idea删除成功！');
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
    },
    onError: (error: any) => {
      message.error('删除失败：' + error.message);
    },
  });

  // 转换为项目mutation
  const convertToProjectMutation = useMutation({
    mutationFn: ({ id, collaboratorIds }: { id: number; collaboratorIds: number[] }) =>
      ideaApi.convertToProject(id, collaboratorIds),
    onSuccess: (response) => {
      message.success(`Idea已转换为研究项目！项目ID: ${response.project_id}`);
      setIsConvertModalVisible(false);
      setConvertingIdea(null);
      convertForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
      queryClient.invalidateQueries({ queryKey: ['research-projects'] });
    },
    onError: (error: any) => {
      message.error('转换失败：' + error.message);
    },
  });

  // 处理表单提交
  const handleSubmit = async (values: any) => {
    const data: IdeaCreate = {
      project_name: values.project_name,
      project_description: values.project_description,
      research_method: values.research_method,
      source: values.source,
      responsible_person: values.responsible_person,
      maturity: values.maturity,
    };

    if (editingIdea) {
      updateIdeaMutation.mutate({ id: editingIdea.id, data });
    } else {
      createIdeaMutation.mutate(data);
    }
  };

  // 处理转换提交
  const handleConvert = async (values: { collaborator_ids: number[] }) => {
    if (convertingIdea) {
      convertToProjectMutation.mutate({
        id: convertingIdea.id,
        collaboratorIds: values.collaborator_ids || [],
      });
    }
  };

  // 处理编辑
  const handleEdit = (idea: Idea) => {
    setEditingIdea(idea);
    form.setFieldsValue(idea);
    setIsModalVisible(true);
  };

  // 处理删除
  const handleDelete = (idea: Idea) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除idea"${idea.project_name}"吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => deleteIdeaMutation.mutate(idea.id),
    });
  };

  // 处理转换为项目
  const handleConvertToProject = (idea: Idea) => {
    setConvertingIdea(idea);
    setIsConvertModalVisible(true);
  };

  // 获取成熟度颜色
  const getMaturityColor = (maturity: string) => {
    return maturity === 'mature' ? 'green' : 'orange';
  };

  // 过滤ideas
  const filteredIdeas = ideas.filter(idea => {
    const matchesSearch = searchText === '' ||
      idea.project_name.toLowerCase().includes(searchText.toLowerCase()) ||
      (idea.project_description && idea.project_description.toLowerCase().includes(searchText.toLowerCase())) ||
      idea.research_method.toLowerCase().includes(searchText.toLowerCase()) ||
      idea.responsible_person.toLowerCase().includes(searchText.toLowerCase());

    return matchesSearch;
  });

  // 统计数据
  const stats = {
    total: ideas.length,
    mature: ideas.filter(i => i.maturity === 'mature').length,
    immature: ideas.filter(i => i.maturity === 'immature').length,
  };

  return (
    <div>
      {/* 页面标题和操作按钮 */}
      <div className="page-header">
        <Title level={3} style={{ margin: 0 }}>
          <BulbOutlined style={{ marginRight: 8 }} />
          Idea管理
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingIdea(null);
            form.resetFields();
            setIsModalVisible(true);
          }}
        >
          新增Idea
        </Button>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card className="statistics-card hover-shadow">
            <Statistic
              title="总Ideas"
              value={stats.total}
              prefix={<BulbOutlined style={{ fontSize: 14 }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="statistics-card hover-shadow">
            <Statistic
              title="成熟"
              value={stats.mature}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="statistics-card hover-shadow">
            <Statistic
              title="不成熟"
              value={stats.immature}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 搜索和筛选栏 */}
      <div className="filter-bar">
        <Row gutter={16} align="middle">
          <Col xs={24} sm={12} lg={8}>
            <Search
              placeholder="搜索ideas..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              prefix={<SearchOutlined />}
              allowClear
            />
          </Col>
          <Col xs={24} sm={6} lg={4}>
            <Select
              placeholder="成熟度筛选"
              value={maturityFilter}
              onChange={setMaturityFilter}
              allowClear
              style={{ width: '100%' }}
            >
              <Select.Option value="mature">成熟</Select.Option>
              <Select.Option value="immature">不成熟</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={24} lg={12}>
            <Text type="secondary">
              共 {filteredIdeas.length} 个ideas
            </Text>
          </Col>
        </Row>
      </div>

      {/* Ideas列表 */}
      <div className="table-container">
        <Table
          size="small"
          dataSource={filteredIdeas}
          rowKey="id"
          loading={isLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          scroll={{ x: 1200 }}
          columns={[
            {
              title: '序号',
              key: 'index',
              width: 60,
              render: (_: any, __: any, index: number) => index + 1,
            },
            {
              title: '项目名称',
              dataIndex: 'project_name',
              key: 'project_name',
              width: 200,
              ellipsis: true,
              render: (name: string, record: Idea) => (
                <Space direction="vertical" size={0}>
                  <Text strong style={{ fontSize: '14px' }}>
                    {name}
                  </Text>
                  <Tag color={getMaturityColor(record.maturity)}>
                    {record.maturity === 'mature' ? '成熟' : '不成熟'}
                  </Tag>
                </Space>
              ),
            },
            {
              title: '项目描述',
              dataIndex: 'project_description',
              key: 'project_description',
              width: 250,
              ellipsis: { showTitle: false },
              render: (description: string) => (
                <Text
                  ellipsis={{ tooltip: description }}
                  style={{ color: '#666' }}
                >
                  {description || '-'}
                </Text>
              ),
            },
            {
              title: '研究方法',
              dataIndex: 'research_method',
              key: 'research_method',
              width: 200,
              ellipsis: { showTitle: false },
              render: (method: string) => (
                <Text ellipsis={{ tooltip: method }}>
                  {method}
                </Text>
              ),
            },
            {
              title: '来源',
              dataIndex: 'source',
              key: 'source',
              width: 120,
              render: (source: string) => source || '-',
            },
            {
              title: '负责人',
              dataIndex: 'responsible_person',
              key: 'responsible_person',
              width: 100,
            },
            {
              title: '创建时间',
              dataIndex: 'created_at',
              key: 'created_at',
              width: 110,
              render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
              sorter: (a: Idea, b: Idea) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
            },
            {
              title: '操作',
              key: 'actions',
              width: 140,
              fixed: 'right',
              render: (_: any, idea: Idea) => (
                <Space size="small">
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(idea)}
                    title="编辑"
                    size="small"
                  />
                  <Button
                    type="text"
                    icon={<ProjectOutlined />}
                    onClick={() => handleConvertToProject(idea)}
                    title="转为项目"
                    size="small"
                  />
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(idea)}
                    title="删除"
                    size="small"
                  />
                </Space>
              ),
            },
          ]}
        />
      </div>

      {/* 创建/编辑Idea模态框 */}
      <Modal
        title={editingIdea ? '编辑Idea' : '新增Idea'}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingIdea(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={createIdeaMutation.isPending || updateIdeaMutation.isPending}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            maturity: 'immature',
          }}
        >
          <Form.Item
            name="project_name"
            label="项目名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="请输入项目名称" />
          </Form.Item>

          <Form.Item
            name="project_description"
            label="项目描述"
          >
            <TextArea
              rows={3}
              placeholder="请描述项目的核心内容和目标（可选）"
            />
          </Form.Item>

          <Form.Item
            name="research_method"
            label="研究方法"
            rules={[{ required: true, message: '请输入研究方法' }]}
          >
            <TextArea
              rows={3}
              placeholder="请描述拟采用的研究方法"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="source"
                label="来源"
              >
                <Input placeholder="例如：文献、会议、讨论等" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="responsible_person"
                label="负责人"
                rules={[{ required: true, message: '请输入负责人' }]}
              >
                <Input placeholder="请输入负责人姓名" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="maturity"
            label="成熟度"
            rules={[{ required: true, message: '请选择成熟度' }]}
          >
            <Select>
              <Select.Option value="immature">不成熟</Select.Option>
              <Select.Option value="mature">成熟</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 转换为项目模态框 */}
      <Modal
        title="转换为研究项目"
        open={isConvertModalVisible}
        onCancel={() => {
          setIsConvertModalVisible(false);
          setConvertingIdea(null);
          convertForm.resetFields();
        }}
        onOk={() => convertForm.submit()}
        confirmLoading={convertToProjectMutation.isPending}
      >
        {convertingIdea && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Title level={4}>将要转换的Idea：</Title>
              <Card size="small">
                <Title level={5}>{convertingIdea.project_name}</Title>
                <Paragraph ellipsis={{ rows: 2 }}>
                  {convertingIdea.project_description || '无描述'}
                </Paragraph>
                <Text type="secondary">研究方法：{convertingIdea.research_method}</Text>
              </Card>
            </div>

            <Form
              form={convertForm}
              layout="vertical"
              onFinish={handleConvert}
            >
              <Form.Item
                name="collaborator_ids"
                label="选择合作者"
                tooltip="为这个项目分配合作者，也可以稍后在研究看板中添加"
              >
                <Select
                  mode="multiple"
                  placeholder="选择合作者"
                  showSearch
                  filterOption={(input, option) =>
                    (option?.children?.toString() || '').toLowerCase().indexOf(input.toLowerCase()) >= 0
                  }
                >
                  {collaborators.map((collaborator) => (
                    <Select.Option key={collaborator.id} value={collaborator.id}>
                      {collaborator.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default IdeaManagement;
