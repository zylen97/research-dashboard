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
  Space,
  Row,
  Col,
} from 'antd';
import {
  FileExcelOutlined,
  RobotOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { ideaDiscoveryApi } from '../services/api';
import EmbeddedAIConfig from '../components/idea/EmbeddedAIConfig';

const { Title, Text, Paragraph } = Typography;

// 处理状态枚举
enum ProcessingState {
  IDLE = 'idle',           // 空闲状态
  UPLOADING = 'uploading', // 上传中
  PROCESSING = 'processing', // 处理中
  COMPLETED = 'completed',   // 完成
  ERROR = 'error'           // 错误
}

interface AIConfig {
  provider: string;
  api_key: string;
  api_url?: string;
  model?: string;
  is_connected?: boolean;
}

const IdeaDiscovery: React.FC = () => {
  const [state, setState] = useState<ProcessingState>(ProcessingState.IDLE);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
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
    if (!selectedFile) {
      message.error('请先选择文件');
      return;
    }

    if (!aiConfig || !aiConfig.is_connected) {
      message.error('请先配置并测试AI连接');
      return;
    }

    setState(ProcessingState.PROCESSING);
    setProcessingStartTime(Date.now());
    setErrorMessage('');

    try {
      // 使用系统配置的AI提供商（自动模式）
      const blob = await ideaDiscoveryApi.processExcel(selectedFile);
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
    <div style={{ padding: '24px', maxWidth: 'none', width: '100%' }}>
      {/* 页面标题 */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <Title level={2}>
          <FileExcelOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
          研究Idea发掘与AI配置中心
        </Title>
        <Paragraph type="secondary">
          配置AI提供商，上传包含"摘要"和"标题"列的Excel文件，AI将为每行数据生成研究迁移建议
        </Paragraph>
      </div>

      <Row gutter={[32, 32]} style={{ width: '100%' }}>
        {/* 左侧：AI配置面板 */}
        <Col xs={24} md={8} lg={6} xl={5}>
          <EmbeddedAIConfig onConfigChange={setAiConfig} />
        </Col>

        {/* 右侧：文件处理面板 */}
        <Col xs={24} md={16} lg={18} xl={19}>
          <Card title="Excel文件处理">
            <Space direction="vertical" size="large" style={{ width: '100%' }}>

              {/* 文件上传区域 */}
              <Upload.Dragger
                name="file"
                accept=".xlsx,.xls"
                beforeUpload={handleFileSelect}
                showUploadList={false}
                disabled={state === ProcessingState.PROCESSING}
                style={{ padding: '60px 40px' }}
              >
                <p className="ant-upload-drag-icon">
                  <FileExcelOutlined style={{ fontSize: '64px', color: '#1890ff' }} />
                </p>
                <p className="ant-upload-text" style={{ fontSize: '18px', marginBottom: '8px' }}>
                  点击或拖拽Excel文件到此区域上传
                </p>
                <p className="ant-upload-hint" style={{ fontSize: '14px' }}>
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
                    disabled={!aiConfig || !aiConfig.is_connected}
                  >
                    开始AI分析处理
                  </Button>
                  {(!aiConfig || !aiConfig.is_connected) && (
                    <div style={{ marginTop: '8px' }}>
                      <Text type="secondary">请先在左侧配置并测试AI连接</Text>
                    </div>
                  )}
                </div>
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 使用说明 */}
      <Card title="使用说明" style={{ marginTop: '32px' }}>
        <Row gutter={[32, 16]}>
          <Col xs={24} md={12} lg={12}>
            <div style={{ lineHeight: '2' }}>
              <Text>
                <strong>1. AI配置：</strong>在左侧配置AI提供商，填写API密钥并测试连接<br />
                <strong>2. 文件要求：</strong>Excel文件必须包含"摘要"和"标题"两列<br />
                <strong>3. 处理流程：</strong>系统将使用已配置的AI读取每行数据，生成研究迁移建议<br />
              </Text>
            </div>
          </Col>
          <Col xs={24} md={12} lg={12}>
            <div style={{ lineHeight: '2' }}>
              <Text>
                <strong>4. 结果文件：</strong>将在原文件基础上新增"迁移意见by[AI模型名]"列<br />
                <strong>5. 注意事项：</strong>处理时间取决于数据行数和AI响应速度，请耐心等待
              </Text>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default IdeaDiscovery;