import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Card,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Avatar,
  Typography,
  Tag,
  Upload,
  Space,
  Descriptions,
  Table,
  Row,
  Col,
  Radio,
  Statistic,
  Checkbox,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  UploadOutlined,
  TeamOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collaboratorApi, researchApi } from '../services/api';
import { Collaborator, CollaboratorCreate } from '../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

const CollaboratorManagement: React.FC = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [editingCollaborator, setEditingCollaborator] = useState<Collaborator | null>(null);
  const [selectedCollaborator, setSelectedCollaborator] = useState<Collaborator | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50); // 默认50条/页
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  
  // 本地管理小组标记状态（后端支持前的临时方案）
  const [localGroupMarks, setLocalGroupMarks] = useState<Record<number, boolean>>(() => {
    try {
      const saved = localStorage.getItem('collaborator-group-marks');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // 持久化本地小组标记状态
  useEffect(() => {
    localStorage.setItem('collaborator-group-marks', JSON.stringify(localGroupMarks));
  }, [localGroupMarks]);
  
  // 用于跟踪删除类型的ref
  const deleteTypeRef = useRef<'soft' | 'hard'>('soft');
  
  // 格式化文本，在数字后添加换行
  const formatTextWithLineBreaks = (text: string | undefined): React.ReactNode => {
    if (!text) return text;
    
    // 先清理掉所有现有的换行符和多余空格
    const cleaned = text.replace(/\s+/g, ' ').trim();
    
    // 找到所有数字+点的匹配位置
    const matches = Array.from(cleaned.matchAll(/(\d+\.)/g));
    
    if (matches.length === 0) return cleaned;
    
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    
    matches.forEach((match, index) => {
      const matchStart = match.index!;
      const matchText = match[0];
      
      // 添加匹配前的文本
      const beforeText = cleaned.slice(lastIndex, matchStart);
      if (beforeText) {
        parts.push(beforeText);
      }
      
      // 如果不是第一个匹配，添加换行
      if (index > 0) {
        parts.push(<br key={`br-${index}`} />);
      }
      
      parts.push(matchText);
      lastIndex = matchStart + matchText.length;
    });
    
    // 添加最后剩余的文本
    const remainingText = cleaned.slice(lastIndex);
    if (remainingText) {
      parts.push(remainingText);
    }
    
    return parts;
  };

  // 获取合作者数据
  const { data: collaborators = [], isLoading, refetch } = useQuery({
    queryKey: ['collaborators'],
    queryFn: () => collaboratorApi.getCollaborators(),
  });

  // 临时识别小组的函数（后端支持is_group字段前使用）
  const isGroupCollaborator = (collaborator: Collaborator) => {
    // 1. 优先使用本地标记状态
    if (localGroupMarks[collaborator.id] !== undefined) {
      return localGroupMarks[collaborator.id];
    }
    
    // 2. 后端支持is_group字段时直接返回
    if (collaborator.is_group !== undefined) {
      return collaborator.is_group;
    }
    
    // 3. 临时逻辑：根据名称和班级信息判断是否为小组
    const groupIndicators = [
      '小组', '团队', '大创团队', '创新大赛小组', 
      '周佳祺 庄晶涵 范佳伟', '田超 王昊 李思佳 凌文杰'
    ];
    
    return groupIndicators.some(indicator => 
      collaborator.name.includes(indicator) || 
      (collaborator.class_name && collaborator.class_name.includes(indicator))
    );
  };

  // 排序合作者：小组 > 高级合作者 > 女生 > 男生
  const sortedCollaborators = useMemo(() => {
    return [...collaborators].sort((a, b) => {
      const aIsGroup = isGroupCollaborator(a);
      const bIsGroup = isGroupCollaborator(b);
      
      // 1. 小组/团队优先
      if (aIsGroup && !bIsGroup) return -1;
      if (!aIsGroup && bIsGroup) return 1;
      
      // 2. 高级合作者优先
      if (a.is_senior && !b.is_senior) return -1;
      if (!a.is_senior && b.is_senior) return 1;
      
      // 3. 在同级别中，女生优先于男生
      if (a.gender === '女' && b.gender !== '女') return -1;
      if (a.gender !== '女' && b.gender === '女') return 1;
      
      // 4. 同性别或都不是女生时，按名字排序
      return a.name.localeCompare(b.name);
    });
  }, [collaborators]);

  // 获取研究项目数据用于分析合作者参与状态
  const { data: projects = [] } = useQuery({
    queryKey: ['research-projects'],
    queryFn: () => researchApi.getProjects(),
  });

  // 分析合作者参与状态：找出未参与任何项目的合作者
  const collaboratorParticipationStatus = useMemo(() => {
    const participatingCollaboratorIds = new Set<number>();
    
    // 收集所有参与项目的合作者ID
    projects.forEach(project => {
      project.collaborators.forEach(collaborator => {
        participatingCollaboratorIds.add(collaborator.id);
      });
    });
    
    // 创建合作者参与状态映射
    const statusMap = new Map<number, boolean>();
    sortedCollaborators.forEach(collaborator => {
      statusMap.set(collaborator.id, participatingCollaboratorIds.has(collaborator.id));
    });
    
    return statusMap;
  }, [projects, sortedCollaborators]);

  // 统计数据
  const collaboratorStats = useMemo(() => {
    const total = sortedCollaborators.length;
    const participating = Array.from(collaboratorParticipationStatus.values()).filter(Boolean).length;
    const notParticipating = total - participating;
    const senior = sortedCollaborators.filter(c => c.is_senior).length;
    const groups = sortedCollaborators.filter(c => isGroupCollaborator(c)).length;
    
    return {
      total,
      participating,
      notParticipating,
      senior,
      groups,
    };
  }, [sortedCollaborators, collaboratorParticipationStatus]);

  // 创建合作者mutation
  const createCollaboratorMutation = useMutation({
    mutationFn: collaboratorApi.createCollaborator,
    onSuccess: (newCollaborator) => {
      // 如果新建时选择了小组标记，保存到本地状态
      if (pendingGroupStatus) {
        setLocalGroupMarks(prev => ({
          ...prev,
          [newCollaborator.id]: true
        }));
      }
      
      // 重置临时状态
      setPendingGroupStatus(false);
      
      message.success('合作者创建成功！');
      setIsModalVisible(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
    },
    onError: (error) => {
      // 重置临时状态
      setPendingGroupStatus(false);
      message.error('创建失败：' + error.message);
    },
  });

  // 更新合作者mutation
  const updateCollaboratorMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      collaboratorApi.updateCollaborator(id, data),
    onSuccess: () => {
      message.success('合作者信息更新成功！');
      setIsModalVisible(false);
      setEditingCollaborator(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
    },
    onError: (error) => {
      message.error('更新失败：' + error.message);
    },
  });

  // 删除合作者mutation
  const deleteCollaboratorMutation = useMutation({
    mutationFn: collaboratorApi.deleteCollaborator,
    onSuccess: () => {
      message.success('合作者删除成功！');
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
    },
    onError: (error) => {
      message.error('删除失败：' + error.message);
    },
  });

  // 上传文件mutation
  const uploadMutation = useMutation({
    mutationFn: collaboratorApi.uploadCollaboratorsFile,
    onSuccess: (response) => {
      message.success(`成功导入 ${response.imported_count} 条合作者记录`);
      if (response.errors.length > 0) {
        Modal.warning({
          title: '导入警告',
          content: (
            <div>
              <p>部分数据导入失败：</p>
              <ul>
                {response.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          ),
        });
      }
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
    },
    onError: (error) => {
      message.error('文件上传失败：' + error.message);
    },
  });

  // 临时保存新建时的is_group状态
  const [pendingGroupStatus, setPendingGroupStatus] = useState<boolean>(false);

  // 处理表单提交
  const handleSubmit = async (values: CollaboratorCreate) => {
    // 提取is_group字段并在本地管理
    const { is_group, ...apiValues } = values;
    
    if (editingCollaborator) {
      // 更新本地小组标记状态
      setLocalGroupMarks(prev => ({
        ...prev,
        [editingCollaborator.id]: !!is_group
      }));
      
      updateCollaboratorMutation.mutate({ id: editingCollaborator.id, data: apiValues });
    } else {
      // 新建时，先保存is_group状态以便在创建成功后使用
      setPendingGroupStatus(!!is_group);
      createCollaboratorMutation.mutate(apiValues);
    }
  };

  // 处理编辑
  const handleEdit = (collaborator: Collaborator) => {
    setEditingCollaborator(collaborator);
    // 设置表单值，包括当前的小组状态
    form.setFieldsValue({
      ...collaborator,
      is_group: isGroupCollaborator(collaborator)
    });
    setIsModalVisible(true);
  };

  // 处理删除
  const handleDelete = async (collaborator: Collaborator) => {
    try {
      // 先检查依赖关系
      const response = await fetch(`http://localhost:8080/api/validation/collaborator/${collaborator.id}/dependencies`);
      const data = await response.json();
      
      if (!data.valid) {
        message.error(data.error || '无法获取合作者依赖信息');
        return;
      }
      
      const { dependencies, warnings, can_soft_delete, can_hard_delete } = data;
      const hasActiveProjects = dependencies.active_projects > 0;
      
      // 重置删除类型为默认值
      deleteTypeRef.current = 'soft';
      
      Modal.confirm({
        title: '删除合作者确认',
        width: 520,
        content: (
          <div>
            <p>您即将删除合作者：<strong>"{collaborator.name}"</strong></p>
            
            {(dependencies.total_projects > 0 || dependencies.communication_logs > 0) && (
              <>
                <p style={{ marginTop: 16, marginBottom: 8 }}>
                  <strong>当前合作者的相关数据：</strong>
                </p>
                <ul style={{ marginLeft: 20 }}>
                  {dependencies.active_projects > 0 && (
                    <li style={{ color: '#ff4d4f' }}>
                      参与 {dependencies.active_projects} 个进行中的项目
                    </li>
                  )}
                  {dependencies.completed_projects > 0 && (
                    <li>
                      参与 {dependencies.completed_projects} 个已完成的项目
                    </li>
                  )}
                  {dependencies.communication_logs > 0 && (
                    <li>
                      相关交流日志 {dependencies.communication_logs} 条
                    </li>
                  )}
                </ul>
              </>
            )}
            
            {warnings && warnings.length > 0 && (
              <div style={{ marginTop: 16 }}>
                {warnings.map((warning: string, index: number) => (
                  <p key={index} style={{ color: '#faad14' }}>
                    ⚠️ {warning}
                  </p>
                ))}
              </div>
            )}
            
            <div style={{ 
              marginTop: 16, 
              padding: '12px', 
              background: '#f0f2f5', 
              borderRadius: '4px' 
            }}>
              <p style={{ marginBottom: 8, fontWeight: 'bold' }}>删除选项：</p>
              <Radio.Group
                defaultValue="soft"
                onChange={(e) => {
                  deleteTypeRef.current = e.target.value;
                }}
              >
                <Space direction="vertical">
                  <Radio value="soft" disabled={!can_soft_delete}>
                    <span style={{ color: '#1890ff' }}>
                      软删除（推荐） - 可以随时恢复
                    </span>
                  </Radio>
                  <Radio value="hard" disabled={!can_hard_delete}>
                    <span style={{ color: '#ff4d4f' }}>
                      永久删除 - 不可恢复
                      {hasActiveProjects && ' (有活跃项目，不可用)'}
                    </span>
                  </Radio>
                </Space>
              </Radio.Group>
            </div>
          </div>
        ),
        okText: '确认删除',
        cancelText: '取消',
        okType: 'primary',
        onOk: () => {
          if (deleteTypeRef.current === 'hard') {
            // 硬删除：添加force参数
            fetch(`http://localhost:8080/api/collaborators/${collaborator.id}?force=true`, {
              method: 'DELETE',
            }).then(response => {
              if (response.ok) {
                message.success('合作者已永久删除！');
                queryClient.invalidateQueries({ queryKey: ['collaborators'] });
              } else {
                message.error('删除失败，请稍后重试');
              }
            }).catch(error => {
              message.error('删除失败：' + error.message);
            });
          } else {
            // 软删除
            deleteCollaboratorMutation.mutate(collaborator.id);
          }
        },
      });
    } catch (error) {
      message.error('检查合作者依赖关系失败，请稍后重试');
      console.error('Error checking dependencies:', error);
    }
  };

  // 查看详情
  const showDetail = (collaborator: Collaborator) => {
    setSelectedCollaborator(collaborator);
    setIsDetailModalVisible(true);
  };

  // 文件上传配置
  const uploadProps = {
    beforeUpload: (file: File) => {
      const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                     file.type === 'application/vnd.ms-excel';
      if (!isExcel) {
        message.error('只能上传Excel文件！');
        return false;
      }
      uploadMutation.mutate(file);
      return false;
    },
    showUploadList: false,
  };

  // 获取性别标签颜色
  const getGenderColor = (gender?: string) => {
    if (gender === '男') return 'blue';
    if (gender === '女') return 'pink';
    return 'default';
  };

  return (
    <div>
      {/* 小组合作者行样式 */}
      <style>{`
        .group-collaborator-row {
          background-color: #f9f0ff !important;
          border-left: 3px solid #722ed1 !important;
        }
        .group-collaborator-row:hover {
          background-color: #efdbff !important;
        }
      `}</style>
      {/* 页面标题和操作按钮 */}
      <div className="page-header">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <TeamOutlined style={{ marginRight: 8 }} />
            合作者管理
          </Title>
          <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
            <Tag color="purple">小组</Tag> 为团队合作者，<Tag color="gold">高级合作者</Tag> 为特别重要的合作伙伴
          </Text>
        </div>
        <Space>
          <Upload {...uploadProps}>
            <Button icon={<UploadOutlined />} loading={uploadMutation.isPending}>
              导入Excel
            </Button>
          </Upload>
          <Button 
            icon={<ReloadOutlined />}
            onClick={refetch}
            loading={isLoading}
            title="刷新数据"
          >
            刷新
          </Button>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingCollaborator(null);
              setPendingGroupStatus(false);
              form.resetFields();
              setIsModalVisible(true);
            }}
          >
            新增合作者
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} lg={5}>
          <Card className="statistics-card hover-shadow">
            <Statistic 
              title="总合作者" 
              value={collaboratorStats.total} 
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={5}>
          <Card className="statistics-card hover-shadow">
            <Statistic 
              title="小组/团队" 
              value={collaboratorStats.groups} 
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={5}>
          <Card className="statistics-card hover-shadow">
            <Statistic 
              title="已参与项目" 
              value={collaboratorStats.participating} 
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={5}>
          <Card className="statistics-card hover-shadow">
            <Statistic 
              title="未参与项目" 
              value={collaboratorStats.notParticipating} 
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card className="statistics-card hover-shadow">
            <Statistic 
              title="高级合作者" 
              value={collaboratorStats.senior} 
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 合作者列表 */}
      <div className="table-container">
        <Table
          size="small"
          dataSource={sortedCollaborators}
          rowKey="id"
          loading={isLoading}
          onChange={(pagination) => {
            setCurrentPage(pagination.current || 1);
            setPageSize(pagination.pageSize || 50);
          }}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: sortedCollaborators.length,
            pageSizeOptions: ['10', '20', '50', '100'],
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          scroll={{ x: 1000 }}
          rowClassName={(record: Collaborator) => 
            isGroupCollaborator(record) ? 'group-collaborator-row' : ''
          }
        columns={[
          {
            title: '姓名',
            dataIndex: 'name',
            key: 'name',
            width: 150,
            render: (name: string, record) => {
              const isParticipating = collaboratorParticipationStatus.get(record.id) || false;
              const isGroup = isGroupCollaborator(record);
              return (
                <Space>
                  <Avatar 
                    size={32} 
                    icon={isGroup ? <TeamOutlined /> : <UserOutlined />}
                    style={{ 
                      backgroundColor: isGroup ? '#722ed1' : 
                        (record.is_senior ? '#ff4d4f' : (record.gender === '男' ? '#1890ff' : '#eb2f96')),
                    }}
                  />
                  <div>
                    <div>
                      <Text strong style={{ color: isGroup ? '#722ed1' : 'inherit' }}>
                        {isGroup && '👥 '}{name}
                      </Text>
                      {isGroup && (
                        <Tag color="purple" style={{ marginLeft: 8 }}>
                          小组
                        </Tag>
                      )}
                      {record.is_senior && !isGroup && (
                        <Tag color="gold" style={{ marginLeft: 8 }}>
                          高级合作者
                        </Tag>
                      )}
                    </div>
                    {!isParticipating && (
                      <div style={{ marginTop: 4 }}>
                        <Tag color="orange" style={{ fontSize: '12px' }}>
                          未参与项目
                        </Tag>
                      </div>
                    )}
                  </div>
                </Space>
              );
            },
          },
          {
            title: '性别',
            dataIndex: 'gender',
            key: 'gender',
            width: 80,
            render: (gender: string) => 
              gender ? (
                <Tag color={getGenderColor(gender)}>{gender}</Tag>
              ) : '-',
            filters: [
              { text: '男', value: '男' },
              { text: '女', value: '女' },
            ],
            onFilter: (value, record) => record.gender === value,
          },
          {
            title: '班级',
            dataIndex: 'class_name',
            key: 'class_name',
            width: 120,
            render: (className: string) => className || '-',
          },
          {
            title: '未来规划',
            dataIndex: 'future_plan',
            key: 'future_plan',
            width: 200,
            ellipsis: { showTitle: false },
            render: (plan: string) => 
              plan ? (
                <Text ellipsis={{ tooltip: plan }}>{plan}</Text>
              ) : '-',
          },
          {
            title: '背景信息',
            dataIndex: 'background',
            key: 'background',
            width: 250,
            ellipsis: { showTitle: false },
            render: (background: string) => 
              background ? (
                <Text ellipsis={{ tooltip: background }}>{background}</Text>
              ) : '-',
          },
          {
            title: '操作',
            key: 'actions',
            width: 120,
            fixed: 'right',
            render: (_, collaborator) => (
              <Space size="small">
                <Button
                  type="text"
                  icon={<EyeOutlined />}
                  onClick={() => showDetail(collaborator)}
                  title="查看详情"
                />
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(collaborator)}
                  title="编辑"
                />
                <Button
                  type="text"
                  icon={<DeleteOutlined />}
                  danger
                  title="删除"
                  onClick={() => handleDelete(collaborator)}
                />
              </Space>
            ),
          },
        ]}
      />
      </div>

      {/* 创建/编辑合作者模态框 */}
      <Modal
        title={editingCollaborator ? '编辑合作者' : '新增合作者'}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingCollaborator(null);
          setPendingGroupStatus(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={createCollaboratorMutation.isPending || updateCollaboratorMutation.isPending}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="gender"
                label="性别"
              >
                <Select placeholder="请选择性别">
                  <Select.Option value="男">男</Select.Option>
                  <Select.Option value="女">女</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="class_name"
                label="班级"
              >
                <Input placeholder="请输入班级" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="is_group"
                valuePropName="checked"
                style={{ marginTop: 30 }}
              >
                <Checkbox>
                  <Space>
                    <TeamOutlined style={{ color: '#722ed1' }} />
                    <Text style={{ color: '#722ed1' }}>标记为小组/团队</Text>
                  </Space>
                </Checkbox>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="future_plan"
            label="未来规划"
          >
            <TextArea 
              rows={3} 
              placeholder="请输入未来规划"
            />
          </Form.Item>

          <Form.Item
            name="background"
            label="具体情况和背景"
          >
            <TextArea 
              rows={4} 
              placeholder="请输入具体情况和背景信息"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 合作者详情模态框 */}
      <Modal
        title="合作者详情"
        open={isDetailModalVisible}
        onCancel={() => {
          setIsDetailModalVisible(false);
          setSelectedCollaborator(null);
        }}
        footer={[
          <Button key="close" onClick={() => setIsDetailModalVisible(false)}>
            关闭
          </Button>,
          <Button 
            key="edit" 
            type="primary" 
            onClick={() => {
              if (selectedCollaborator) {
                setIsDetailModalVisible(false);
                handleEdit(selectedCollaborator);
              }
            }}
          >
            编辑
          </Button>,
        ]}
        width={600}
      >
        {selectedCollaborator && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              {(() => {
                const isGroup = isGroupCollaborator(selectedCollaborator);
                return (
                  <>
                    <Avatar 
                      size={80} 
                      icon={isGroup ? <TeamOutlined /> : <UserOutlined />}
                      style={{ 
                        backgroundColor: isGroup ? '#722ed1' : 
                          (selectedCollaborator.gender === '男' ? '#1890ff' : '#eb2f96'),
                        marginBottom: 16
                      }}
                    />
                    <Title level={3} style={{ margin: 0, color: isGroup ? '#722ed1' : 'inherit' }}>
                      {isGroup && '👥 '}{selectedCollaborator.name}
                    </Title>
                    <div style={{ marginTop: 8 }}>
                      {isGroup && (
                        <Tag color="purple">
                          小组/团队
                        </Tag>
                      )}
                      {selectedCollaborator.gender && !isGroup && (
                        <Tag color={getGenderColor(selectedCollaborator.gender)}>
                          {selectedCollaborator.gender}
                        </Tag>
                      )}
                      {selectedCollaborator.is_senior && (
                        <Tag color="gold" style={{ marginLeft: 8 }}>
                          高级合作者
                        </Tag>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            <Descriptions column={1} bordered>
              <Descriptions.Item label="姓名">
                {selectedCollaborator.name}
              </Descriptions.Item>
              {selectedCollaborator.gender && (
                <Descriptions.Item label="性别">
                  {selectedCollaborator.gender}
                </Descriptions.Item>
              )}
              {selectedCollaborator.class_name && (
                <Descriptions.Item label="班级">
                  {selectedCollaborator.class_name}
                </Descriptions.Item>
              )}
              {selectedCollaborator.future_plan && (
                <Descriptions.Item label="未来规划">
                  {formatTextWithLineBreaks(selectedCollaborator.future_plan)}
                </Descriptions.Item>
              )}
              {selectedCollaborator.background && (
                <Descriptions.Item label="具体情况和背景">
                  {formatTextWithLineBreaks(selectedCollaborator.background)}
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CollaboratorManagement;