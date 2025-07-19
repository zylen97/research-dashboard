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
  Tooltip,
  message,
  Rate,
  Statistic,
  Dropdown,
  Table,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  BulbOutlined,
  ProjectOutlined,
  MoreOutlined,
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
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [form] = Form.useForm();
  const [convertForm] = Form.useForm();
  const queryClient = useQueryClient();

  // 获取idea数据
  const { data: ideas = [], isLoading } = useQuery({
    queryKey: ['ideas', statusFilter, priorityFilter],
    queryFn: () => ideaApi.getIdeas({
      status_filter: statusFilter || undefined,
      priority_filter: priorityFilter || undefined,
    }),
  });

  // 获取统计数据
  const { data: summary } = useQuery({
    queryKey: ['ideas-summary'],
    queryFn: () => ideaApi.getSummary(),
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
      queryClient.invalidateQueries({ queryKey: ['ideas-summary'] });
    },
    onError: (error) => {
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
    onError: (error) => {
      message.error('更新失败：' + error.message);
    },
  });

  // 删除idea mutation
  const deleteIdeaMutation = useMutation({
    mutationFn: ideaApi.deleteIdea,
    onSuccess: () => {
      message.success('Idea删除成功！');
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
      queryClient.invalidateQueries({ queryKey: ['ideas-summary'] });
    },
    onError: (error) => {
      message.error('删除失败：' + error.message);
    },
  });

  // 更新优先级mutation
  const updatePriorityMutation = useMutation({
    mutationFn: ({ id, priority }: { id: number; priority: string }) =>
      ideaApi.updatePriority(id, priority),
    onSuccess: () => {
      message.success('优先级更新成功！');
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
    },
    onError: (error) => {
      message.error('更新失败：' + error.message);
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
    onError: (error) => {
      message.error('转换失败：' + error.message);
    },
  });

  // 处理表单提交
  const handleSubmit = async (values: IdeaCreate) => {
    if (editingIdea) {
      updateIdeaMutation.mutate({ id: editingIdea.id, data: values });
    } else {
      createIdeaMutation.mutate(values);
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
    form.setFieldsValue({
      ...idea,
      tags: idea.tags ? idea.tags.split(',') : [],
    });
    setIsModalVisible(true);
  };

  // 处理删除
  const handleDelete = (idea: Idea) => {
    deleteIdeaMutation.mutate(idea.id);
  };

  // 处理转换为项目
  const handleConvertToProject = (idea: Idea) => {
    setConvertingIdea(idea);
    setIsConvertModalVisible(true);
  };

  // 处理优先级更新
  const handlePriorityUpdate = (idea: Idea, priority: string) => {
    updatePriorityMutation.mutate({ id: idea.id, priority });
  };

  // 获取优先级颜色
  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      high: 'red',
      medium: 'orange',
      low: 'green',
    };
    return colors[priority] || 'default';
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pool: 'default',
      in_development: 'processing',
      converted_to_project: 'success',
    };
    return colors[status] || 'default';
  };

  // 获取难度等级显示
  const getDifficultyDisplay = (level?: string) => {
    const levels: Record<string, { stars: number; color: string }> = {
      easy: { stars: 1, color: '#52c41a' },
      medium: { stars: 2, color: '#fa8c16' },
      hard: { stars: 3, color: '#f5222d' },
    };
    return levels[level || 'medium'];
  };

  // 过滤ideas
  const filteredIdeas = ideas.filter(idea => {
    const matchesSearch = searchText === '' || 
      idea.title.toLowerCase().includes(searchText.toLowerCase()) ||
      idea.description.toLowerCase().includes(searchText.toLowerCase()) ||
      (idea.tags && idea.tags.toLowerCase().includes(searchText.toLowerCase()));
    
    return matchesSearch;
  });

  // 按优先级和状态排序
  const sortedIdeas = [...filteredIdeas].sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
    
    if (aPriority !== bPriority) {
      return bPriority - aPriority; // 高优先级在前
    }
    
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // 新的在前
  });

  return (
    <div>
      {/* 页面标题和操作按钮 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 24 
      }}>
        <Title level={2} style={{ margin: 0 }}>
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
      {summary && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic 
                title="总Ideas" 
                value={summary.total_ideas} 
                prefix={<BulbOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic 
                title="待开发" 
                value={summary.status_breakdown.pool || 0} 
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic 
                title="开发中" 
                value={summary.status_breakdown.in_development || 0} 
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic 
                title="已转换" 
                value={summary.status_breakdown.converted_to_project || 0} 
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 搜索和筛选栏 */}
      <Card style={{ marginBottom: 24 }}>
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
              placeholder="状态筛选"
              value={statusFilter}
              onChange={setStatusFilter}
              allowClear
              style={{ width: '100%' }}
            >
              <Select.Option value="pool">idea池</Select.Option>
              <Select.Option value="in_development">开发中</Select.Option>
              <Select.Option value="converted_to_project">已转换</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={6} lg={4}>
            <Select
              placeholder="优先级筛选"
              value={priorityFilter}
              onChange={setPriorityFilter}
              allowClear
              style={{ width: '100%' }}
            >
              <Select.Option value="high">高优先级</Select.Option>
              <Select.Option value="medium">中优先级</Select.Option>
              <Select.Option value="low">低优先级</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={24} lg={8}>
            <Text type="secondary">
              共 {filteredIdeas.length} 个ideas
            </Text>
          </Col>
        </Row>
      </Card>

      {/* Ideas列表 */}
      <Table
        dataSource={sortedIdeas}
        rowKey="id"
        loading={isLoading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
        }}
        scroll={{ x: 1400 }}
        columns={[
          {
            title: 'Idea标题',
            dataIndex: 'title',
            key: 'title',
            width: 200,
            ellipsis: true,
            render: (title: string, record) => (
              <Space direction="vertical" size={0}>
                <Text strong style={{ fontSize: '14px' }}>
                  {title}
                </Text>
                <Tag color={getPriorityColor(record.priority)}>
                  {record.priority}优先级
                </Tag>
              </Space>
            ),
          },
          {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
            width: 300,
            ellipsis: { showTitle: false },
            render: (description: string) => (
              <Text
                ellipsis={{ tooltip: description }}
                style={{ color: '#666' }}
              >
                {description}
              </Text>
            ),
          },
          {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (status: string) => (
              <Tag color={getStatusColor(status)}>
                {status === 'pool' ? 'idea池' :
                 status === 'in_development' ? '开发中' : '已转换'}
              </Tag>
            ),
            filters: [
              { text: 'idea池', value: 'pool' },
              { text: '开发中', value: 'in_development' },
              { text: '已转换', value: 'converted_to_project' },
            ],
            onFilter: (value, record) => record.status === value,
          },
          {
            title: '难度',
            dataIndex: 'difficulty_level',
            key: 'difficulty_level',
            width: 100,
            render: (level: string) => {
              if (!level) return '-';
              const difficultyDisplay = getDifficultyDisplay(level);
              return (
                <Tooltip title={level}>
                  <Rate 
                    disabled 
                    count={3} 
                    value={difficultyDisplay.stars}
                    style={{ fontSize: '12px', color: difficultyDisplay.color }}
                  />
                </Tooltip>
              );
            },
          },
          {
            title: '预计时长',
            dataIndex: 'estimated_duration',
            key: 'estimated_duration',
            width: 120,
            render: (duration: string) => duration || '-',
          },
          {
            title: '潜在影响',
            dataIndex: 'potential_impact',
            key: 'potential_impact',
            width: 100,
            render: (impact: string) => 
              impact ? (
                <Tag color={impact === 'high' ? 'red' : 
                           impact === 'medium' ? 'orange' : 'green'}>
                  {impact}
                </Tag>
              ) : '-',
          },
          {
            title: '标签',
            dataIndex: 'tags',
            key: 'tags',
            width: 150,
            render: (tags: string) => {
              if (!tags) return '-';
              const tagList = tags.split(',').slice(0, 2); // 只显示前2个标签
              return (
                <Space wrap size={[0, 4]}>
                  {tagList.map((tag, index) => (
                    <Tag key={index}>
                      {tag.trim()}
                    </Tag>
                  ))}
                  {tags.split(',').length > 2 && (
                    <Tooltip title={tags}>
                      <Tag>...</Tag>
                    </Tooltip>
                  )}
                </Space>
              );
            },
          },
          {
            title: '创建时间',
            dataIndex: 'created_at',
            key: 'created_at',
            width: 110,
            render: (date: string) => dayjs(date).format('MM-DD'),
            sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
          },
          {
            title: '操作',
            key: 'actions',
            width: 160,
            fixed: 'right',
            render: (_, idea) => (
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
                  disabled={idea.status === 'converted_to_project'}
                  title="转为项目"
                  size="small"
                />
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: 'high',
                        label: '高优先级',
                        onClick: () => handlePriorityUpdate(idea, 'high'),
                      },
                      {
                        key: 'medium',
                        label: '中优先级',
                        onClick: () => handlePriorityUpdate(idea, 'medium'),
                      },
                      {
                        key: 'low',
                        label: '低优先级',
                        onClick: () => handlePriorityUpdate(idea, 'low'),
                      },
                      { type: 'divider' },
                      {
                        key: 'delete',
                        label: '删除',
                        danger: true,
                        onClick: () => {
                          Modal.confirm({
                            title: '确认删除',
                            content: `确定要删除idea"${idea.title}"吗？`,
                            okText: '删除',
                            okType: 'danger',
                            cancelText: '取消',
                            onOk: () => handleDelete(idea),
                          });
                        },
                      },
                    ],
                  }}
                  trigger={['click']}
                >
                  <Button
                    type="text"
                    icon={<MoreOutlined />}
                    size="small"
                    title="更多操作"
                  />
                </Dropdown>
              </Space>
            ),
          },
        ]}
      />

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
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="title"
            label="Idea标题"
            rules={[{ required: true, message: '请输入idea标题' }]}
          >
            <Input placeholder="请输入idea标题" />
          </Form.Item>

          <Form.Item
            name="description"
            label="详细描述"
            rules={[{ required: true, message: '请输入详细描述' }]}
          >
            <TextArea 
              rows={4} 
              placeholder="请详细描述这个idea的核心内容、目标和价值"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="source"
                label="来源"
                initialValue="manual"
                rules={[{ required: true, message: '请选择来源' }]}
              >
                <Select>
                  <Select.Option value="manual">手动创建</Select.Option>
                  <Select.Option value="literature">文献转换</Select.Option>
                  <Select.Option value="other">其他</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="priority"
                label="优先级"
                initialValue="medium"
              >
                <Select>
                  <Select.Option value="high">高</Select.Option>
                  <Select.Option value="medium">中</Select.Option>
                  <Select.Option value="low">低</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="difficulty_level"
                label="难度等级"
              >
                <Select placeholder="选择难度">
                  <Select.Option value="easy">简单</Select.Option>
                  <Select.Option value="medium">中等</Select.Option>
                  <Select.Option value="hard">困难</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="estimated_duration"
                label="预计耗时"
              >
                <Input placeholder="例如：3个月、半年等" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="potential_impact"
                label="潜在影响"
              >
                <Select placeholder="选择潜在影响">
                  <Select.Option value="low">低</Select.Option>
                  <Select.Option value="medium">中</Select.Option>
                  <Select.Option value="high">高</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="required_skills"
            label="所需技能"
          >
            <TextArea 
              rows={2} 
              placeholder="描述完成这个idea需要的技能和知识"
            />
          </Form.Item>

          <Form.Item
            name="tags"
            label="标签"
          >
            <Select
              mode="tags"
              placeholder="输入标签，按回车添加"
              style={{ width: '100%' }}
            />
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
                <Title level={5}>{convertingIdea.title}</Title>
                <Paragraph ellipsis={{ rows: 2 }}>
                  {convertingIdea.description}
                </Paragraph>
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