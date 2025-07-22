import React from 'react';
import { Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

interface ConfirmDeleteModalProps {
  title?: string;
  content?: string;
  onConfirm: () => void | Promise<void>;
  confirmLoading?: boolean;
}

export const confirmDelete = ({
  title = '确认删除',
  content = '您确定要删除吗？此操作不可恢复。',
  onConfirm,
  confirmLoading = false,
}: ConfirmDeleteModalProps) => {
  Modal.confirm({
    title,
    icon: <ExclamationCircleOutlined />,
    content,
    okText: '确认',
    okType: 'danger',
    cancelText: '取消',
    confirmLoading,
    onOk: onConfirm,
  });
};