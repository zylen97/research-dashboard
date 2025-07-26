import React, { useState, useEffect } from 'react';
import {
  Card,
  Input,
  Button,
  Space,
  Typography,
  Select,
  Alert,
  Tooltip,
  Tag
} from 'antd';
import {
  EditOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  CheckOutlined
} from '@ant-design/icons';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;
const { Option } = Select;

// 默认prompt模板
const DEFAULT_PROMPT = `基于提供的文献标题和摘要，请生成一个简洁的研究迁移建议。

要求：
1. 分析该研究的核心技术或方法
2. 建议如何将其应用到其他领域或问题
3. 提出具体的迁移方向或应用场景
4. 建议控制在50-100字内

请直接给出建议内容，不需要格式化或额外说明。`;

// prompt模板库
const PROMPT_TEMPLATES = [
  {
    key: 'default',
    name: '默认模板',
    description: '研究迁移建议生成',
    prompt: DEFAULT_PROMPT
  },
  {
    key: 'innovation',
    name: '创新点分析',
    description: '重点分析研究创新点',
    prompt: `请分析以下文献的主要创新点并提供扩展建议：

分析要求：
1. 识别该研究的核心创新点
2. 评估创新点的应用价值
3. 提出可能的扩展研究方向
4. 建议控制在80-120字内

请提供具体可行的建议。`
  },
  {
    key: 'application',
    name: '应用转化',
    description: '关注实际应用转化',
    prompt: `基于以下文献内容，分析其实际应用转化潜力：

分析角度：
1. 技术成熟度和可行性
2. 市场应用前景
3. 产业化可能性
4. 实施障碍和解决方案
5. 建议控制在100-150字内

请给出务实的转化建议。`
  },
  {
    key: 'interdisciplinary',
    name: '跨学科融合',
    description: '探索跨学科合作机会',
    prompt: `分析以下研究的跨学科融合机会：

融合分析：
1. 识别可融合的相关学科
2. 分析跨学科合作的价值
3. 提出具体的融合研究方向
4. 预估融合研究的影响力
5. 建议控制在80-120字内

请提供跨学科视角的建议。`
  }
];

interface PromptEditorProps {
  onPromptConfirm: (prompt: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
  defaultPrompt?: string;
}

const PromptEditor: React.FC<PromptEditorProps> = ({
  onPromptConfirm,
  onCancel,
  disabled = false,
  defaultPrompt
}) => {
  const [currentPrompt, setCurrentPrompt] = useState<string>(defaultPrompt || DEFAULT_PROMPT);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('default');
  const [isModified, setIsModified] = useState<boolean>(false);

  useEffect(() => {
    if (defaultPrompt) {
      setCurrentPrompt(defaultPrompt);
      setIsModified(false);
    }
  }, [defaultPrompt]);

  // 处理模板选择
  const handleTemplateChange = (templateKey: string) => {
    const template = PROMPT_TEMPLATES.find(t => t.key === templateKey);
    if (template) {
      setCurrentPrompt(template.prompt);
      setSelectedTemplate(templateKey);
      setIsModified(true);
    }
  };

  // 处理prompt修改
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentPrompt(e.target.value);
    setIsModified(true);
  };

  // 重置为默认prompt
  const handleReset = () => {
    setCurrentPrompt(DEFAULT_PROMPT);
    setSelectedTemplate('default');
    setIsModified(true);
  };

  // 确认使用当前prompt
  const handleConfirm = () => {
    onPromptConfirm(currentPrompt);
  };

  // 获取字符统计信息
  const getCharacterStats = () => {
    const length = currentPrompt.length;
    const lines = currentPrompt.split('\n').length;
    return { length, lines };
  };

  const stats = getCharacterStats();

  return (
    <Card
      title={
        <Space>
          <EditOutlined />
          <span>自定义AI交互Prompt</span>
          {isModified && (
            <Tag color="orange">已修改</Tag>
          )}
        </Space>
      }
      size="small"
      extra={
        <Tooltip title="重置为默认prompt">
          <Button 
            icon={<ReloadOutlined />} 
            size="small" 
            onClick={handleReset}
            disabled={disabled}
          >
            重置
          </Button>
        </Tooltip>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        
        {/* 模板选择器 */}
        <div>
          <Text strong>选择模板：</Text>
          <Select
            value={selectedTemplate}
            onChange={handleTemplateChange}
            style={{ width: '100%', marginTop: 8 }}
            disabled={disabled}
          >
            {PROMPT_TEMPLATES.map(template => (
              <Option key={template.key} value={template.key}>
                <div>
                  <div style={{ fontWeight: 'bold' }}>{template.name}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {template.description}
                  </div>
                </div>
              </Option>
            ))}
          </Select>
        </div>

        {/* Prompt编辑区域 */}
        <div>
          <div style={{ marginBottom: 8 }}>
            <Space>
              <Text strong>Prompt内容：</Text>
              <Tooltip title="这里的prompt将用于指导AI如何分析每条文献并生成建议">
                <InfoCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          </div>
          
          <TextArea
            value={currentPrompt}
            onChange={handlePromptChange}
            placeholder="请输入与AI交互的prompt..."
            rows={12}
            disabled={disabled}
            style={{ 
              fontFamily: 'Monaco, Consolas, "Courier New", monospace',
              fontSize: '13px'
            }}
          />
          
          {/* 字符统计 */}
          <div style={{ 
            marginTop: 8, 
            textAlign: 'right', 
            fontSize: '12px', 
            color: '#666' 
          }}>
            字符数: {stats.length} | 行数: {stats.lines}
          </div>
        </div>

        {/* 提示信息 */}
        <Alert
          message="Prompt使用说明"
          description={
            <div>
              <Paragraph style={{ margin: 0, fontSize: '13px' }}>
                • 系统会为每条文献数据自动添加"标题:"和"摘要:"字段<br/>
                • 建议在prompt中明确指定输出格式和字数要求<br/>
                • 可以使用模板快速开始，然后根据需要自定义修改
              </Paragraph>
            </div>
          }
          type="info"
          showIcon
          style={{ fontSize: '12px' }}
        />

        {/* 操作按钮 */}
        <div style={{ textAlign: 'center' }}>
          <Space>
            {onCancel && (
              <Button onClick={onCancel} disabled={disabled}>
                取消
              </Button>
            )}
            <Button 
              type="primary" 
              icon={<CheckOutlined />}
              onClick={handleConfirm}
              disabled={disabled}
              size="large"
            >
              确认使用此Prompt
            </Button>
          </Space>
        </div>
      </Space>
    </Card>
  );
};

export default PromptEditor;