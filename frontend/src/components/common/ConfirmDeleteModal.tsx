// React import removed as not needed for this component
import { Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

interface ConfirmDeleteModalProps {
  title?: string;
  content?: string;
  onConfirm: () => void | Promise<void>;
}

export const confirmDelete = ({
  title = '确认删除',
  content = '您确定要删除吗？此操作不可恢复。',
  onConfirm,
}: ConfirmDeleteModalProps) => {
  Modal.confirm({
    title,
    icon: <ExclamationCircleOutlined />,
    content,
    okText: '确认',
    okType: 'danger',
    cancelText: '取消',
    onOk: onConfirm,
  });
};