import React, { useState, useMemo } from 'react';
import {
  Tree,
  Input,
  Button,
  Modal,
  Form,
  message,
  Dropdown,
  Space,
  Typography,
  Badge,
} from 'antd';
import {
  FolderOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { folderApi } from '../../services/api';
import { FolderTreeNode, LiteratureFolderCreate, LiteratureFolderUpdate } from '../../types';
import type { TreeProps, TreeDataNode } from 'antd';

const { Search } = Input;
const { Text } = Typography;

interface FolderTreeProps {
  selectedFolderId?: number | null;
  onFolderSelect?: (folderId: number | null, folderData?: FolderTreeNode) => void;
  showLiteratureCount?: boolean;
  allowEdit?: boolean;
  height?: number;
}

const FolderTree: React.FC<FolderTreeProps> = ({
  selectedFolderId,
  onFolderSelect,
  showLiteratureCount = true,
  allowEdit = true,
  height = 400,
}) => {
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderTreeNode | null>(null);
  const [parentFolder, setParentFolder] = useState<FolderTreeNode | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // 获取文件夹树数据
  const { data: folderTree = [], isLoading } = useQuery({
    queryKey: ['folder-tree'],
    queryFn: folderApi.getFolderTree,
  });

  // 创建文件夹mutation
  const createFolderMutation = useMutation({
    mutationFn: folderApi.createFolder,
    onSuccess: () => {
      message.success('文件夹创建成功！');
      setIsModalVisible(false);
      setParentFolder(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['folder-tree'] });
    },
    onError: (error) => {
      message.error('创建失败：' + error.message);
    },
  });

  // 更新文件夹mutation
  const updateFolderMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: LiteratureFolderUpdate }) =>
      folderApi.updateFolder(id, data),
    onSuccess: () => {
      message.success('文件夹更新成功！');
      setIsModalVisible(false);
      setEditingFolder(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['folder-tree'] });
    },
    onError: (error) => {
      message.error('更新失败：' + error.message);
    },
  });

  // 删除文件夹mutation
  const deleteFolderMutation = useMutation({
    mutationFn: ({ id, moveToParent }: { id: number; moveToParent: boolean }) =>
      folderApi.deleteFolder(id, moveToParent),
    onSuccess: () => {
      message.success('文件夹删除成功！');
      queryClient.invalidateQueries({ queryKey: ['folder-tree'] });
      // 如果删除的是当前选中的文件夹，清空选中状态
      if (selectedFolderId && onFolderSelect) {
        onFolderSelect(null);
      }
    },
    onError: (error) => {
      message.error('删除失败：' + error.message);
    },
  });

  // 将FolderTreeNode转换为TreeDataNode
  const convertToTreeData = React.useCallback((folders: FolderTreeNode[], searchValue: string = ''): TreeDataNode[] => {
    return folders.map((folder) => {
      const node: TreeDataNode & { data?: FolderTreeNode } = {
        key: folder.id,
        title: folder.name,
        icon: folder.children.length > 0 ? <FolderOutlined /> : <FileTextOutlined />,
        isLeaf: folder.children.length === 0,
        data: folder, // 存储原始数据
      };
      
      if (folder.children.length > 0) {
        node.children = convertToTreeData(folder.children, searchValue);
      }
      
      return node;
    });
  }, []);

  // 搜索过滤
  const filteredTreeData = useMemo(() => {
    if (!searchValue) {
      return convertToTreeData(folderTree);
    }
    
    const filterTree = (nodes: FolderTreeNode[]): FolderTreeNode[] => {
      const filtered: FolderTreeNode[] = [];
      
      for (const node of nodes) {
        const matchesSearch = node.name.toLowerCase().includes(searchValue.toLowerCase());
        const filteredChildren = filterTree(node.children);
        
        if (matchesSearch || filteredChildren.length > 0) {
          filtered.push({
            ...node,
            children: filteredChildren,
          });
        }
      }
      
      return filtered;
    };

    const filtered = filterTree(folderTree);
    return convertToTreeData(filtered, searchValue);
  }, [folderTree, searchValue, convertToTreeData]);

  // 自动展开搜索结果
  React.useEffect(() => {
    if (searchValue) {
      const getAllKeys = (data: TreeDataNode[]): React.Key[] => {
        const keys: React.Key[] = [];
        const traverse = (nodes: TreeDataNode[]) => {
          nodes.forEach((node) => {
            keys.push(node.key);
            if (node.children) {
              traverse(node.children);
            }
          });
        };
        traverse(data);
        return keys;
      };
      setExpandedKeys(getAllKeys(filteredTreeData));
    }
  }, [searchValue]);

  // 处理文件夹选择
  const handleSelect: TreeProps['onSelect'] = (selectedKeys) => {
    const folderId = selectedKeys[0] as number | undefined;
    const folderData = findFolderById(folderTree, folderId);
    onFolderSelect?.(folderId || null, folderData);
  };

  // 查找文件夹数据
  const findFolderById = (folders: FolderTreeNode[], id?: number): FolderTreeNode | undefined => {
    if (!id) return undefined;
    
    for (const folder of folders) {
      if (folder.id === id) {
        return folder;
      }
      const found = findFolderById(folder.children, id);
      if (found) return found;
    }
    return undefined;
  };

  // 处理创建根文件夹
  const handleCreateRootFolder = () => {
    setParentFolder(null);
    setEditingFolder(null);
    setIsModalVisible(true);
  };

  // 处理创建子文件夹
  const handleCreateSubfolder = (parent: FolderTreeNode) => {
    setParentFolder(parent);
    setEditingFolder(null);
    setIsModalVisible(true);
  };

  // 处理编辑文件夹
  const handleEditFolder = (folder: FolderTreeNode) => {
    setEditingFolder(folder);
    setParentFolder(null);
    form.setFieldsValue({
      name: folder.name,
      description: folder.description,
    });
    setIsModalVisible(true);
  };

  // 处理删除文件夹
  const handleDeleteFolder = (folder: FolderTreeNode) => {
    if (folder.is_root) {
      message.warning('根文件夹不能删除');
      return;
    }

    Modal.confirm({
      title: '删除文件夹',
      content: (
        <div>
          <p>确定要删除文件夹 "{folder.name}" 吗？</p>
          {folder.literature_count > 0 && (
            <p style={{ color: '#faad14' }}>
              该文件夹包含 {folder.literature_count} 篇文献，删除后文献将移到父文件夹。
            </p>
          )}
          {folder.children.length > 0 && (
            <p style={{ color: '#faad14' }}>
              该文件夹包含 {folder.children.length} 个子文件夹，它们将移到父文件夹。
            </p>
          )}
        </div>
      ),
      onOk: () => {
        deleteFolderMutation.mutate({ id: folder.id, moveToParent: true });
      },
    });
  };

  // 处理表单提交
  const handleSubmit = (values: any) => {
    const data: LiteratureFolderCreate = {
      name: values.name,
      description: values.description,
      sort_order: 0,
    };
    
    if (parentFolder?.id) {
      data.parent_id = parentFolder.id;
    }

    if (editingFolder) {
      updateFolderMutation.mutate({
        id: editingFolder.id,
        data: {
          name: values.name,
          description: values.description,
        },
      });
    } else {
      createFolderMutation.mutate(data);
    }
  };

  return (
    <div style={{ height }}>
      {/* 搜索框和操作按钮 */}
      <div style={{ marginBottom: 12 }}>
        <Search
          placeholder="搜索文件夹"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          style={{ marginBottom: 8 }}
          allowClear
        />
        
        {allowEdit && (
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={handleCreateRootFolder}
            style={{ width: '100%' }}
            size="small"
          >
            新建文件夹
          </Button>
        )}
      </div>

      {/* 文件夹树 */}
      <div style={{ height: height - 80, overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 6, padding: 8 }}>
        <Tree
          showIcon
          blockNode
          expandedKeys={expandedKeys}
          selectedKeys={selectedFolderId ? [selectedFolderId] : []}
          treeData={filteredTreeData}
          onExpand={(keys) => setExpandedKeys(keys)}
          onSelect={handleSelect}
          style={{ fontSize: '13px' }}
          titleRender={(nodeData) => {
            const folder = (nodeData as any).data as FolderTreeNode;
            if (!folder) return nodeData.title as React.ReactNode;
            
            return (
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '2px 0'
                }}
              >
                <Space size={4}>
                  <Text 
                    style={{ 
                      color: searchValue && folder.name.toLowerCase().includes(searchValue.toLowerCase()) 
                        ? '#1890ff' : undefined 
                    }}
                  >
                    {folder.name}
                  </Text>
                  {showLiteratureCount && (
                    <Badge 
                      count={folder.literature_count} 
                      size="small" 
                      style={{ backgroundColor: '#f0f0f0', color: '#666' }}
                      showZero
                    />
                  )}
                </Space>
                
                {allowEdit && (
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'add-subfolder',
                          icon: <PlusOutlined />,
                          label: '新建子文件夹',
                          onClick: () => handleCreateSubfolder(folder),
                        },
                        {
                          key: 'edit',
                          icon: <EditOutlined />,
                          label: '编辑',
                          onClick: () => handleEditFolder(folder),
                        },
                        {
                          key: 'delete',
                          icon: <DeleteOutlined />,
                          label: '删除',
                          danger: true,
                          disabled: folder.is_root,
                          onClick: () => handleDeleteFolder(folder),
                        },
                      ],
                    }}
                    trigger={['click']}
                    placement="bottomRight"
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={<MoreOutlined />}
                      style={{ 
                        opacity: 0.6,
                        padding: '0 4px',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Dropdown>
                )}
              </div>
            );
          }}
        />

        {filteredTreeData.length === 0 && !isLoading && (
          <div 
            style={{ 
              textAlign: 'center', 
              padding: '40px 20px',
              color: '#999',
              fontSize: '13px'
            }}
          >
            {searchValue ? '未找到匹配的文件夹' : '暂无文件夹'}
          </div>
        )}
      </div>

      {/* 创建/编辑文件夹模态框 */}
      <Modal
        title={editingFolder ? '编辑文件夹' : `新建${parentFolder ? '子' : ''}文件夹`}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingFolder(null);
          setParentFolder(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={createFolderMutation.isPending || updateFolderMutation.isPending}
      >
        {parentFolder && (
          <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
            <Text type="secondary">父文件夹：</Text>
            <Text strong>{parentFolder.name}</Text>
          </div>
        )}
        
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="文件夹名称"
            rules={[{ required: true, message: '请输入文件夹名称' }]}
          >
            <Input placeholder="请输入文件夹名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea
              rows={3}
              placeholder="请输入文件夹描述（可选）"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FolderTree;