import { useState, useCallback } from 'react';
import { Form } from 'antd';

interface UseModalFormProps<T> {
  onSubmit: (values: T, isEdit: boolean) => Promise<void>;
}

export function useModalForm<T = any>({ onSubmit }: UseModalFormProps<T>) {
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<T | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openModal = useCallback((item?: T) => {
    if (item) {
      setEditingItem(item);
      form.setFieldsValue(item);
    } else {
      setEditingItem(null);
      form.resetFields();
    }
    setModalVisible(true);
  }, [form]);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setEditingItem(null);
    form.resetFields();
  }, [form]);

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await onSubmit(values, !!editingItem);
      closeModal();
    } catch (error) {
      console.error('Form validation failed:', error);
    } finally {
      setSubmitting(false);
    }
  }, [form, editingItem, onSubmit, closeModal]);

  return {
    form,
    modalVisible,
    editingItem,
    submitting,
    openModal,
    closeModal,
    handleSubmit,
    isEdit: !!editingItem,
  };
}