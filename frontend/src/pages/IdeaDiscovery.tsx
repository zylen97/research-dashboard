import React, { useState } from 'react';
import {
  Card,
  Button,
  Upload,
  Typography,
  Space,
  Steps,
  Progress,
  Alert,
  Divider,
  Row,
  Col,
  Spin,
  Result,
  message,
} from 'antd';
import {
  UploadOutlined,
  FileExcelOutlined,
  RobotOutlined,
  DownloadOutlined,
  BulbOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { ideaDiscoveryApi } from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;

interface ProcessingStage {
  current: number;
  status: 'wait' | 'process' | 'finish' | 'error';
  description: string;
  progress: number;
}

interface UploadedFileInfo {
  file: File;
  fileId: string;
  fileName: string;
  fileSize: number;
  columns: string[];
  rowCount: number;
}

const IdeaDiscovery: React.FC = () => {
  const [uploadedFile, setUploadedFile] = useState<UploadedFileInfo | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processStage, setProcessStage] = useState<ProcessingStage>({
    current: 0,
    status: 'wait',
    description: '等待开始处理...',
    progress: 0
  });
  const [_processingId, setProcessingId] = useState<string | null>(null);
  const [resultFileId, setResultFileId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // 处理文件上传
  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setErrorMessage(null);
    
    try {
      const response = await ideaDiscoveryApi.uploadFile(file);
      
      setUploadedFile({
        file,
        fileId: response.file_id,
        fileName: response.file_name,
        fileSize: response.file_size,
        columns: response.columns,
        rowCount: response.row_count,
      });
      
      setProcessStage({
        current: 0,
        status: 'finish',
        description: '文件上传完成',
        progress: 0
      });
      
      setResultFileId(null);
      message.success('文件上传成功！');
      
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '文件上传失败');
      message.error('文件上传失败');
    } finally {
      setUploading(false);
    }
    
    return false; // 阻止antd的自动上传
  };

  // 开始处理流程
  const handleStartProcessing = async () => {
    if (!uploadedFile) return;

    setProcessing(true);
    setErrorMessage(null);

    try {
      // 启动处理任务
      const response = await ideaDiscoveryApi.startProcessing({
        file_id: uploadedFile.fileId,
        ai_provider: 'openai',
      });

      const newProcessingId = response.data.processing_id;
      setProcessingId(newProcessingId);

      // 开始轮询处理状态
      pollProcessingStatus(newProcessingId);

    } catch (error) {
      setProcessStage({
        current: 0,
        status: 'error',
        description: '启动处理失败',
        progress: 0
      });
      setErrorMessage(error instanceof Error ? error.message : '处理启动失败');
      setProcessing(false);
    }
  };

  // 轮询处理状态
  const pollProcessingStatus = async (procId: string) => {
    const poll = async () => {
      try {
        const status = await ideaDiscoveryApi.getProcessingStatus(procId);
        
        setProcessStage({
          current: status.current_step,
          status: status.status === 'completed' ? 'finish' : 
                  status.status === 'error' ? 'error' : 'process',
          description: status.message,
          progress: status.progress
        });

        if (status.status === 'completed') {
          // 处理完成，提取结果文件ID
          const resultMatch = status.message.match(/结果文件ID: (result_proc_[^)]+)/);
          if (resultMatch && resultMatch[1]) {
            setResultFileId(resultMatch[1]);
          }
          setProcessing(false);
          message.success('处理完成！');
          
        } else if (status.status === 'error') {
          setProcessing(false);
          setErrorMessage(status.message);
          message.error('处理失败');
          
        } else {
          // 继续轮询
          setTimeout(poll, 2000);
        }
        
      } catch (error) {
        setProcessStage({
          current: processStage.current,
          status: 'error',
          description: '获取处理状态失败',
          progress: 0
        });
        setErrorMessage(error instanceof Error ? error.message : '状态查询失败');
        setProcessing(false);
      }
    };

    poll();
  };

  // 下载结果文件
  const handleDownload = async () => {
    if (!resultFileId) return;
    
    try {
      const blob = await ideaDiscoveryApi.downloadResult(resultFileId);
      
      // 创建下载链接
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `enhanced_${uploadedFile?.fileName || 'result.xlsx'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success('文件下载成功！');
    } catch (error) {
      message.error('文件下载失败');
      console.error('下载错误:', error);
    }
  };

  // 重置状态
  const handleReset = async () => {
    // 清理服务器上的临时文件
    if (uploadedFile?.fileId) {
      try {
        await ideaDiscoveryApi.cleanupFile(uploadedFile.fileId);
      } catch (error) {
        console.error('清理文件失败:', error);
      }
    }
    
    setUploadedFile(null);
    setProcessing(false);
    setProcessStage({
      current: 0,
      status: 'wait',
      description: '等待开始处理...',
      progress: 0
    });
    setProcessingId(null);
    setResultFileId(null);
    setErrorMessage(null);
    setUploading(false);
  };

  const steps = [
    {
      title: '上传Excel',
      description: '上传包含研究数据的Excel文件',
      icon: <UploadOutlined />,
    },
    {
      title: '格式转换',
      description: '将Excel转换为CSV格式进行处理',
      icon: <FileExcelOutlined />,
    },
    {
      title: 'AI分析',
      description: '使用AI模型分析数据并生成研究建议',
      icon: <RobotOutlined />,
    },
    {
      title: '生成结果',
      description: '导出包含AI建议的增强Excel文件',
      icon: <DownloadOutlined />,
    },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* 页面标题 */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <Title level={2}>
          <BulbOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
          研究Idea发掘系统
        </Title>
        <Paragraph type="secondary">
          上传Excel文件，让AI帮助您发现新的研究方向和想法
        </Paragraph>
      </div>

      {/* 处理流程步骤 */}
      <Card style={{ marginBottom: '24px' }}>
        <Steps current={processStage.current} status={processStage.status}>
          {steps.map((step, index) => (
            <Step
              key={index}
              title={step.title}
              description={step.description}
              icon={step.icon}
            />
          ))}
        </Steps>
        
        {processing && (
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <Progress type="line" percent={((processStage.current + 1) / steps.length) * 100} />
            <Text type="secondary" style={{ marginTop: '8px', display: 'block' }}>
              {processStage.description}
            </Text>
          </div>
        )}
      </Card>

      <Row gutter={24}>
        {/* 左侧：文件上传区域 */}
        <Col span={12}>
          <Card title="文件上传" style={{ height: '400px' }}>
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <Upload.Dragger
                name="file"
                accept=".xlsx,.xls"
                beforeUpload={handleFileUpload}
                showUploadList={false}
                disabled={processing || uploading}
              >
                <p className="ant-upload-drag-icon">
                  <FileExcelOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
                </p>
                <p className="ant-upload-text">
                  {uploading ? '正在上传...' : '点击或拖拽Excel文件到此区域上传'}
                </p>
                <p className="ant-upload-hint">
                  支持.xlsx和.xls格式文件
                </p>
              </Upload.Dragger>

              {uploadedFile && (
                <div style={{ marginTop: '16px' }}>
                  <Alert
                    message="文件已上传"
                    description={
                      <div>
                        <div>文件名: {uploadedFile.fileName}</div>
                        <div>文件大小: {(uploadedFile.fileSize / 1024).toFixed(2)} KB</div>
                        <div>数据行数: {uploadedFile.rowCount}</div>
                        <div>列数: {uploadedFile.columns.length}</div>
                      </div>
                    }
                    type="success"
                    showIcon
                  />
                </div>
              )}

              <Divider />

              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Button
                  type="primary"
                  size="large"
                  icon={<RobotOutlined />}
                  onClick={handleStartProcessing}
                  disabled={!uploadedFile || processing || uploading}
                  loading={processing}
                  block
                >
                  开始AI分析处理
                </Button>

                <Button
                  onClick={handleReset}
                  disabled={processing || uploading}
                  block
                >
                  重置
                </Button>
              </Space>
            </div>
          </Card>
        </Col>

        {/* 右侧：处理状态和结果 */}
        <Col span={12}>
          <Card title="处理状态" style={{ height: '400px' }}>
            {!processing && !resultFileId && !errorMessage && !uploading && (
              <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                <Text type="secondary">
                  上传Excel文件后点击"开始AI分析处理"开始处理
                </Text>
              </div>
            )}

            {uploading && (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Spin size="large" />
                <div style={{ marginTop: '16px' }}>
                  <Text strong>正在上传文件...</Text>
                </div>
              </div>
            )}

            {processing && (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Spin size="large" />
                <div style={{ marginTop: '16px' }}>
                  <Text strong>{processStage.description}</Text>
                  <Progress
                    percent={processStage.progress}
                    status="active"
                    strokeColor="#1890ff"
                    style={{ marginTop: '12px' }}
                  />
                </div>
              </div>
            )}

            {resultFileId && !processing && (
              <Result
                status="success"
                title="处理完成！"
                subTitle="AI已完成分析并生成增强的Excel文件"
                extra={[
                  <Button
                    key="download"
                    type="primary"
                    icon={<DownloadOutlined />}
                    onClick={handleDownload}
                    size="large"
                  >
                    下载结果文件
                  </Button>,
                  <Button key="reset" onClick={handleReset}>
                    处理新文件
                  </Button>,
                ]}
              />
            )}

            {errorMessage && (
              <Result
                status="error"
                title="处理失败"
                subTitle={errorMessage}
                extra={[
                  <Button key="retry" type="primary" onClick={handleStartProcessing}>
                    重试
                  </Button>,
                  <Button key="reset" onClick={handleReset}>
                    重置
                  </Button>,
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 功能说明 */}
      <Card title="功能说明" style={{ marginTop: '24px' }}>
        <Row gutter={16}>
          <Col span={8}>
            <div style={{ textAlign: 'center', padding: '16px' }}>
              <FileExcelOutlined style={{ fontSize: '32px', color: '#52c41a', marginBottom: '8px' }} />
              <Title level={4}>智能文件处理</Title>
              <Text type="secondary">
                自动解析Excel文件内容，提取关键信息进行结构化处理
              </Text>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center', padding: '16px' }}>
              <RobotOutlined style={{ fontSize: '32px', color: '#1890ff', marginBottom: '8px' }} />
              <Title level={4}>AI智能分析</Title>
              <Text type="secondary">
                运用先进AI模型深度分析研究数据，发现潜在的研究机会和方向
              </Text>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center', padding: '16px' }}>
              <CheckCircleOutlined style={{ fontSize: '32px', color: '#722ed1', marginBottom: '8px' }} />
              <Title level={4}>结果导出</Title>
              <Text type="secondary">
                生成包含AI建议和洞察的增强Excel文件，便于进一步研究
              </Text>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default IdeaDiscovery;