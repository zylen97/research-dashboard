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
  Select,
} from 'antd';
import {
  FileExcelOutlined,
  RobotOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { ideaDiscoveryApi, promptsApi } from '../services/api';
import EmbeddedAIConfig from '../components/idea/EmbeddedAIConfig';
import PromptManagement from '../components/idea/PromptManagement';
import { Prompt } from '../types';

const { Title, Text, Paragraph } = Typography;

// 处理状态枚举
enum ProcessingState {
  IDLE = 'idle',           // 空闲状态
  PROCESSING = 'processing', // 处理中
  COMPLETED = 'completed',   // 完成
  ERROR = 'error'           // 错误  
}

interface AIConfig {
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
  
  // Prompts相关状态
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<number | undefined>(undefined);
  const [promptsLoading, setPromptsLoading] = useState(false);

  // 加载prompts列表
  const loadPrompts = async () => {
    setPromptsLoading(true);
    try {
      const data = await promptsApi.getPrompts();
      setPrompts(data);
      // 默认选择第一个prompt
      if (data.length > 0 && data[0] && !selectedPromptId) {
        setSelectedPromptId(data[0].id);
      }
    } catch (error: any) {
      console.error('加载Prompt列表失败:', error);
      message.error('加载Prompt列表失败');
    } finally {
      setPromptsLoading(false);
    }
  };

  // 组件挂载时加载prompts
  React.useEffect(() => {
    loadPrompts();
  }, []);

  // 处理文件选择
  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setResultBlob(null);
    setErrorMessage('');
    setState(ProcessingState.IDLE); // 文件选择后回到空闲状态，等待用户点击处理按钮
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

    if (!selectedPromptId) {
      message.error('请选择要使用的Prompt');
      return;
    }

    setState(ProcessingState.PROCESSING);
    setProcessingStartTime(Date.now());
    setErrorMessage('');

    try {
      // 使用系统配置的AI提供商（自动模式），传入选择的prompt_id
      const blob = await ideaDiscoveryApi.processExcel(selectedFile, selectedPromptId);
      setResultBlob(blob);
      setState(ProcessingState.COMPLETED);
      message.success('处理完成！');
    } catch (error: any) {
      console.error('处理失败:', error);
      let errorMsg = '处理失败，请重试';
      
      if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      console.log('错误详情:', { 
        status: error.response?.status,
        detail: error.response?.data?.detail,
        message: error.message,
        fullError: error
      });
      
      setErrorMessage(errorMsg);
      setState(ProcessingState.ERROR);
      message.error('AI文本生成失败：' + errorMsg);
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
    // 重置prompt选择为第一个可用的prompt
    if (prompts.length > 0 && prompts[0]) {
      setSelectedPromptId(prompts[0].id);
    }
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
          研究Idea发掘与配置面板
        </Title>
        <Paragraph type="secondary">
          管理Prompt模板，配置AI，处理Excel文件，AI将为每行数据生成研究迁移建议
        </Paragraph>
      </div>

      <Row gutter={[16, 32]} style={{ width: '100%' }}>
        {/* 第1栏：Prompt管理面板 */}
        <Col xs={24} md={12} lg={8} xl={8}>
          <PromptManagement height="500px" />
        </Col>

        {/* 第2栏：AI配置面板 */}
        <Col xs={24} md={12} lg={8} xl={8}>
          <EmbeddedAIConfig 
            onConfigChange={setAiConfig}
          />
        </Col>

        {/* 第3栏：文件处理面板 */}
        <Col xs={24} md={12} lg={8} xl={8}>
          <Card title="Excel文件处理">
            <Space direction="vertical" size="large" style={{ width: '100%' }}>

              {/* Prompt选择区域 */}
              <div>
                <Text strong style={{ marginBottom: '8px', display: 'block' }}>选择Prompt模板：</Text>
                <Select
                  value={selectedPromptId}
                  onChange={setSelectedPromptId}
                  style={{ width: '100%' }}
                  placeholder="请选择Prompt模板"
                  loading={promptsLoading}
                  disabled={state === ProcessingState.PROCESSING}
                  optionFilterProp="children"
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={prompts.map(prompt => ({
                    value: prompt.id,
                    label: prompt.name,
                    title: prompt.content.substring(0, 100) + (prompt.content.length > 100 ? '...' : '')
                  }))}
                />
              </div>

              {/* 文件上传区域 */}
              <Upload.Dragger
                name="file"
                accept=".xlsx,.xls"
                beforeUpload={handleFileSelect}
                showUploadList={false}
                disabled={state === ProcessingState.PROCESSING}
                style={{ padding: '40px 20px' }}
              >
                <p className="ant-upload-drag-icon">
                  <FileExcelOutlined style={{ fontSize: '64px', color: '#1890ff' }} />
                </p>
                <p className="ant-upload-text" style={{ fontSize: '16px', marginBottom: '8px' }}>
                  点击或拖拽Excel文件到此区域上传
                </p>
                <p className="ant-upload-hint" style={{ fontSize: '12px' }}>
                  支持.xlsx和.xls格式，需包含"摘要"和"标题"列
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
                      <div style={{ marginTop: 8, color: '#1890ff' }}>
                        已选择Prompt: {prompts.find(p => p.id === selectedPromptId)?.name || '未选择'}
                      </div>
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
              {selectedFile && (
                <div style={{ textAlign: 'center' }}>
                  <Space>
                    <Button
                      type="primary"
                      size="large"
                      icon={<RobotOutlined />}
                      onClick={handleStartProcessing}
                      style={{ minWidth: '180px' }}
                      disabled={!aiConfig || !aiConfig.is_connected || !selectedPromptId || state === ProcessingState.PROCESSING}
                      loading={state === ProcessingState.PROCESSING}
                    >
                      开始AI分析处理
                    </Button>
                    <Button onClick={handleReset} disabled={state === ProcessingState.PROCESSING}>
                      重新选择
                    </Button>
                  </Space>
                  {(!aiConfig || !aiConfig.is_connected) && (
                    <div style={{ marginTop: '8px' }}>
                      <Text type="secondary">请先在第2栏配置并测试AI连接</Text>
                    </div>
                  )}
                  {!selectedPromptId && (
                    <div style={{ marginTop: '8px' }}>
                      <Text type="secondary">请先选择Prompt模板</Text>
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
                <strong>1. Prompt管理：</strong>在第1栏管理和创建Prompt模板<br />
                <strong>2. AI配置：</strong>在第2栏填写API密钥和地址并测试连接<br />
                <strong>3. 文件处理：</strong>在第3栏选择Prompt模板，上传Excel文件并开始处理<br />
              </Text>
            </div>
          </Col>
          <Col xs={24} md={12} lg={12}>
            <div style={{ lineHeight: '2' }}>
              <Text>
                <strong>4. 文件要求：</strong>Excel文件必须包含"摘要"和"标题"两列<br />
                <strong>5. 结果文件：</strong>将在原文件基础上新增"迁移意见by[AI模型名]"列<br />
                <strong>6. 注意事项：</strong>处理时间取决于数据行数和AI响应速度，请耐心等待
              </Text>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default IdeaDiscovery;