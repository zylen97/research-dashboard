import React from 'react';
import { Table, Button, Space, Tag, Avatar, Input } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  UserOutlined,
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
  onPageChange: (page: number, pageSize?: number) => void;
  onEdit: (collaborator: Collaborator) => void;
  onDelete: (collaborator: Collaborator) => void;
  onView: (collaborator: Collaborator) => void;
  onSearch: (selectedKeys: string[], confirm: () => void, dataIndex: string) => void;
  onReset: (clearFilters: () => void) => void;
}

/**
 * 合作者表格组件（简化版）
 * 只显示：姓名、背景、联系方式、项目数、状态、操作
 */
export const CollaboratorTable: React.FC<CollaboratorTableProps> = ({
  data,
  loading,
  currentPage,
  pageSize,
  total,
  searchText,
  searchedColumn,
  onPageChange,
  onEdit,
  onDelete,
  onView,
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
    onFilter: (value, record) => {
      const fieldValue = (record as any)[dataIndex];
      return fieldValue
        ? fieldValue
            .toString()
            .toLowerCase()
            .includes((value as string).toLowerCase())
        : false;
    },
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
      width: 150,
      fixed: 'left',
      ...getColumnSearchProps('name'),
      render: (text, record) => (
        <Space>
          <Avatar
            style={{
              backgroundColor: record.is_senior ? '#f56a00' : '#87d068',
            }}
            icon={<UserOutlined />}
            size="small"
          />
          <span style={{ fontWeight: record.is_senior ? 'bold' : 'normal' }}>
            {text}
          </span>
        </Space>
      ),
    },
    {
      title: '背景信息',
      dataIndex: 'background',
      key: 'background',
      width: 250,
      ellipsis: true,
      ...getColumnSearchProps('background'),
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
      onFilter: (value, record) => record.is_senior === value,
      render: (_, record) => (
        <Tag color={record.is_senior ? 'gold' : 'green'}>
          {record.is_senior ? '高级合作者' : '普通合作者'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => onView(record)}
            title="查看详情"
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => onEdit(record)}
            title="编辑"
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onDelete(record)}
            title="删除"
          />
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
      pagination={{
        current: currentPage,
        pageSize: pageSize,
        total: total,
        onChange: onPageChange,
        showSizeChanger: true,
        showQuickJumper: true,
        pageSizeOptions: ['10', '20', '50', '100'],
        showTotal: (total) => `共 ${total} 条`,
      }}
      scroll={{ x: 1000 }}
      size="small"
    />
  );
};

export default CollaboratorTable;
