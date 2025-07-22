import React from 'react';
import { Table, Button, Space, Tag, Avatar, Checkbox, Input } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  UserOutlined,
  TeamOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { ColumnType } from 'antd/es/table';
import { Collaborator } from '../../types';
import Highlighter from 'react-highlight-words';

interface CollaboratorTableProps {
  data: Collaborator[];
  loading: boolean;
  currentPage: number;
  pageSize: number;
  total: number;
  searchText: string;
  searchedColumn: string;
  localGroupMarks: Record<number, boolean>;
  onPageChange: (page: number, pageSize?: number) => void;
  onEdit: (collaborator: Collaborator) => void;
  onDelete: (collaborator: Collaborator) => void;
  onView: (collaborator: Collaborator) => void;
  onGroupToggle: (collaboratorId: number) => void;
  onSearch: (selectedKeys: string[], confirm: () => void, dataIndex: string) => void;
  onReset: (clearFilters: () => void) => void;
}

export const CollaboratorTable: React.FC<CollaboratorTableProps> = ({
  data,
  loading,
  currentPage,
  pageSize,
  total,
  searchText,
  searchedColumn,
  localGroupMarks,
  onPageChange,
  onEdit,
  onDelete,
  onView,
  onGroupToggle,
  onSearch,
  onReset,
}) => {
  const getColumnSearchProps = (dataIndex: string): ColumnType<Collaborator> => ({
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
      <div style={{ padding: 8 }}>
        <Input
          placeholder={`搜索 ${dataIndex}`}
          value={selectedKeys[0]}
          onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
          onPressEnter={() => onSearch(selectedKeys as string[], confirm, dataIndex)}
          style={{ marginBottom: 8, display: 'block' }}
        />
        <Space>
          <Button
            type="primary"
            onClick={() => onSearch(selectedKeys as string[], confirm, dataIndex)}
            icon={<SearchOutlined />}
            size="small"
            style={{ width: 90 }}
          >
            搜索
          </Button>
          <Button
            onClick={() => clearFilters && onReset(clearFilters)}
            size="small"
            style={{ width: 90 }}
          >
            重置
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered: boolean) => (
      <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />
    ),
    onFilter: (value, record) =>
      record[dataIndex]
        ? record[dataIndex]
            .toString()
            .toLowerCase()
            .includes((value as string).toLowerCase())
        : '',
    render: text =>
      searchedColumn === dataIndex ? (
        <Highlighter
          highlightStyle={{ backgroundColor: '#ffc069', padding: 0 }}
          searchWords={[searchText]}
          autoEscape
          textToHighlight={text ? text.toString() : ''}
        />
      ) : (
        text
      ),
  });

  const columns: ColumnType<Collaborator>[] = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 120,
      fixed: 'left',
      ...getColumnSearchProps('name'),
      render: (text, record) => (
        <Space>
          <Avatar
            style={{
              backgroundColor: record.is_advanced ? '#f56a00' : '#87d068',
            }}
            icon={<UserOutlined />}
            size="small"
          />
          <span style={{ fontWeight: record.is_advanced ? 'bold' : 'normal' }}>
            {text}
          </span>
          {localGroupMarks[record.id] && (
            <TeamOutlined style={{ color: '#1890ff' }} />
          )}
        </Space>
      ),
    },
    {
      title: '性别',
      dataIndex: 'gender',
      key: 'gender',
      width: 80,
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
      ...getColumnSearchProps('class_name'),
    },
    {
      title: '学号',
      dataIndex: 'student_id',
      key: 'student_id',
      width: 120,
      ...getColumnSearchProps('student_id'),
    },
    {
      title: '联系方式',
      key: 'contact',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size="small">
          {record.phone && <span>📱 {record.phone}</span>}
          {record.email && <span>📧 {record.email}</span>}
          {record.qq && <span>QQ: {record.qq}</span>}
          {record.wechat && <span>微信: {record.wechat}</span>}
        </Space>
      ),
    },
    {
      title: '技能专长',
      dataIndex: 'skills',
      key: 'skills',
      width: 200,
      ellipsis: true,
      ...getColumnSearchProps('skills'),
    },
    {
      title: '研究兴趣',
      dataIndex: 'research_interests',
      key: 'research_interests',
      width: 200,
      ellipsis: true,
    },
    {
      title: '项目数',
      dataIndex: 'project_count',
      key: 'project_count',
      width: 100,
      sorter: (a, b) => (a.project_count || 0) - (b.project_count || 0),
      render: count => <Tag color="blue">{count || 0}</Tag>,
    },
    {
      title: '状态',
      key: 'status',
      width: 150,
      filters: [
        { text: '高级合作者', value: true },
        { text: '普通合作者', value: false },
      ],
      onFilter: (value, record) => record.is_advanced === value,
      render: (_, record) => (
        <Space>
          {record.is_advanced ? (
            <Tag color="gold">高级合作者</Tag>
          ) : (
            <Tag color="green">普通合作者</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '小组',
      key: 'group',
      width: 80,
      render: (_, record) => (
        <Checkbox
          checked={localGroupMarks[record.id] || false}
          onChange={() => onGroupToggle(record.id)}
        >
          小组
        </Checkbox>
      ),
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => onView(record)}
            size="small"
          >
            查看
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => onEdit(record)}
            size="small"
          >
            编辑
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onDelete(record)}
            size="small"
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={data}
      rowKey="id"
      loading={loading}
      scroll={{ x: 1500 }}
      pagination={{
        current: currentPage,
        pageSize: pageSize,
        total: total,
        onChange: onPageChange,
        showSizeChanger: true,
        showTotal: (total) => `共 ${total} 条`,
        pageSizeOptions: ['10', '20', '50', '100'],
      }}
    />
  );
};