import React, { useState } from 'react';
import {
  Card,
  Button,
  Upload,
  Typography,
  Alert,
  Spin,
  Result,
  message,
  Select,
  Space,
} from 'antd';
import {
  FileExcelOutlined,
  RobotOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { ideaDiscoveryApi } from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// 处理状态枚举
enum ProcessingState {
  IDLE = 'idle',           // 空闲状态
  UPLOADING = 'uploading', // 上传中
  PROCESSING = 'processing', // 处理中
  COMPLETED = 'completed',   // 完成
  ERROR = 'error'           // 错误
}

const IdeaDiscovery: React.FC = () => {
  const [state, setState] = useState<ProcessingState>(ProcessingState.IDLE);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [aiProvider, setAiProvider] = useState<string>('openai');
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [processingStartTime, setProcessingStartTime] = useState<number>(0);

  // 处理文件选择
  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setResultBlob(null);
    setErrorMessage('');
    setState(ProcessingState.IDLE);
    return false; // 阻止自动上传
  };

  // 开始处理
  const handleStartProcessing = async () => {
    if (!selectedFile) return;

    setState(ProcessingState.PROCESSING);
    setProcessingStartTime(Date.now());
    setErrorMessage('');

    try {
      const blob = await ideaDiscoveryApi.processExcel(selectedFile, aiProvider);
      setResultBlob(blob);
      setState(ProcessingState.COMPLETED);
      message.success('处理完成！');
    } catch (error: any) {
      console.error('处理失败:', error);
      const errorMsg = error.response?.data?.detail || error.message || '处理失败，请重试';
      setErrorMessage(errorMsg);
      setState(ProcessingState.ERROR);
      message.error('处理失败');
    }
  };

  // 下载结果
  const handleDownload = () => {
    if (!resultBlob || !selectedFile) return;

    const url = window.URL.createObjectURL(resultBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `enhanced_${selectedFile.name}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    message.success('文件下载成功！');
  };

  // 重置状态
  const handleReset = () => {
    setSelectedFile(null);
    setResultBlob(null);
    setErrorMessage('');
    setState(ProcessingState.IDLE);
    setProcessingStartTime(0);
  };

  // 获取处理时间
  const getProcessingTime = () => {
    if (processingStartTime === 0) return '';
    const elapsed = Math.round((Date.now() - processingStartTime) / 1000);
    return `耗时: ${elapsed}秒`;
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* 页面标题 */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <Title level={2}>
          <FileExcelOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
          研究Idea发掘
        </Title>
        <Paragraph type="secondary">
          上传包含"摘要"和"标题"列的Excel文件，AI将为每行数据生成研究迁移建议
        </Paragraph>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto' }}>

      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* AI提供商选择 */}
          <div>
            <Text strong>选择AI提供商:</Text>
            <Select
              value={aiProvider}
              onChange={setAiProvider}
              style={{ width: 200, marginLeft: 16 }}
              disabled={state === ProcessingState.PROCESSING}
            >
              <Option value="openai">OpenAI</Option>
              <Option value="anthropic">Anthropic (Claude)</Option>
            </Select>
          </div>

          {/* 文件上传区域 */}
          <Upload.Dragger
            name="file"
            accept=".xlsx,.xls"
            beforeUpload={handleFileSelect}
            showUploadList={false}
            disabled={state === ProcessingState.PROCESSING}
          >
            <p className="ant-upload-drag-icon">
              <FileExcelOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
            </p>
            <p className="ant-upload-text">
              点击或拖拽Excel文件到此区域上传
            </p>
            <p className="ant-upload-hint">
              支持.xlsx和.xls格式，文件需包含"摘要"和"标题"列
            </p>
          </Upload.Dragger>

          {/* 文件信息显示 */}
          {selectedFile && (
            <Alert
              message="文件已选择"
              description={
                <div>
                  <div>文件名: {selectedFile.name}</div>
                  <div>文件大小: {(selectedFile.size / 1024).toFixed(2)} KB</div>
                </div>
              }
              type="info"
              showIcon
            />
          )}

          {/* 处理状态显示 */}
          {state === ProcessingState.PROCESSING && (
            <Card style={{ textAlign: 'center', backgroundColor: '#f0f9ff' }}>
              <Spin size="large" />
              <div style={{ marginTop: '16px' }}>
                <Text strong>正在处理中，请稍候...</Text>
                <div style={{ marginTop: '8px' }}>
                  <Text type="secondary">
                    AI正在逐行分析数据并生成研究迁移建议 {getProcessingTime()}
                  </Text>
                </div>
              </div>
            </Card>
          )}

          {/* 错误显示 */}
          {state === ProcessingState.ERROR && (
            <Result
              status="error"
              title="处理失败"
              subTitle={errorMessage}
              extra={[
                <Button key="retry" type="primary" onClick={handleStartProcessing}>
                  重试
                </Button>,
                <Button key="reset" onClick={handleReset}>
                  重新选择文件
                </Button>,
              ]}
            />
          )}

          {/* 成功完成 */}
          {state === ProcessingState.COMPLETED && (
            <Result
              status="success"
              title="处理完成！"
              subTitle={`AI已完成分析并生成研究迁移建议 ${getProcessingTime()}`}
              extra={[
                <Button
                  key="download"
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleDownload}
                  size="large"
                >
                  下载增强文件
                </Button>,
                <Button key="reset" onClick={handleReset}>
                  处理新文件
                </Button>,
              ]}
            />
          )}

          {/* 操作按钮 */}
          {state === ProcessingState.IDLE && selectedFile && (
            <div style={{ textAlign: 'center' }}>
              <Button
                type="primary"
                size="large"
                icon={<RobotOutlined />}
                onClick={handleStartProcessing}
                style={{ minWidth: '200px' }}
              >
                开始AI分析处理
              </Button>
            </div>
          )}
        </Space>
      </Card>

        {/* 使用说明 */}
        <Card title="使用说明" style={{ marginTop: '24px' }}>
          <div style={{ lineHeight: '1.8' }}>
            <Text>
              <strong>1. 文件要求：</strong>Excel文件必须包含"摘要"和"标题"两列<br />
              <strong>2. 处理流程：</strong>AI将读取每行的标题和摘要，生成研究迁移建议<br />
              <strong>3. 结果文件：</strong>将在原文件基础上新增"迁移意见by[AI模型名]"列<br />
              <strong>4. 注意事项：</strong>处理时间取决于数据行数，请耐心等待
            </Text>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default IdeaDiscovery;