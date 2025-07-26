import React, { useState, useRef, useEffect } from 'react';
import {
  Card,
  Input,
  Button,
  Space,
  Typography,
  Alert,
  Spin,
  List,
  Avatar,
  message,
  Tooltip,
  Empty
} from 'antd';
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  ClearOutlined,
  MessageOutlined,
  ReloadOutlined
} from '@ant-design/icons';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

// 消息类型
interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'success' | 'error';
  error?: string;
}

interface ChatPanelProps {
  onSendMessage?: (message: string) => Promise<string>;
  disabled?: boolean;
  placeholder?: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  onSendMessage,
  disabled = false,
  placeholder = '输入消息测试AI对话...'
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 发送消息
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || disabled) {
      return;
    }

    if (!onSendMessage) {
      message.error('聊天功能未配置，请先设置AI配置');
      return;
    }

    const userMessageId = `user_${Date.now()}`;
    const aiMessageId = `ai_${Date.now()}`;
    
    // 添加用户消息
    const userMessage: ChatMessage = {
      id: userMessageId,
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
      status: 'success'
    };

    // 添加AI消息占位符
    const aiMessage: ChatMessage = {
      id: aiMessageId,
      type: 'ai',
      content: '',
      timestamp: new Date(),
      status: 'sending'
    };

    setMessages(prev => [...prev, userMessage, aiMessage]);
    const currentInput = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    try {
      // 调用AI服务
      const aiResponse = await onSendMessage(currentInput);
      
      // 更新AI消息
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
          ? { ...msg, content: aiResponse, status: 'success' }
          : msg
      ));
    } catch (error: any) {
      console.error('聊天请求失败:', error);
      const errorMessage = error.message || '请求失败，请重试';
      
      // 更新AI消息为错误状态
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
          ? { 
              ...msg, 
              content: '抱歉，AI服务暂时不可用，请检查配置或稍后重试',
              status: 'error',
              error: errorMessage
            }
          : msg
      ));
      
      message.error(`聊天失败: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 重试发送消息
  const handleRetryMessage = async (messageId: string) => {
    const targetMessage = messages.find(msg => msg.id === messageId);
    if (!targetMessage || targetMessage.type !== 'ai') return;

    // 找到对应的用户消息
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    const userMessage = messageIndex > 0 ? messages[messageIndex - 1] : null;
    
    if (!userMessage || userMessage.type !== 'user') return;

    // 重置AI消息状态
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const { error, ...msgWithoutError } = msg;
        return { ...msgWithoutError, status: 'sending' as const, content: '' };
      }
      return msg;
    }));

    setIsLoading(true);

    try {
      const aiResponse = await onSendMessage!(userMessage.content);
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, content: aiResponse, status: 'success' }
          : msg
      ));
    } catch (error: any) {
      const errorMessage = error.message || '请求失败，请重试';
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { 
              ...msg, 
              content: '抱歉，AI服务暂时不可用，请检查配置或稍后重试',
              status: 'error',
              error: errorMessage
            }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  // 清空聊天记录
  const handleClearChat = () => {
    setMessages([]);
    message.success('聊天记录已清空');
  };

  // 处理回车发送
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 渲染消息项
  const renderMessage = (msg: ChatMessage) => {
    const isUser = msg.type === 'user';
    const isError = msg.status === 'error';
    const isSending = msg.status === 'sending';

    return (
      <List.Item
        key={msg.id}
        style={{
          padding: '12px 0',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          border: 'none'
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: isUser ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            maxWidth: '80%',
            gap: '8px'
          }}
        >
          <Avatar
            icon={isUser ? <UserOutlined /> : <RobotOutlined />}
            style={{
              backgroundColor: isUser ? '#1890ff' : (isError ? '#ff4d4f' : '#52c41a'),
              flexShrink: 0
            }}
          />
          <div
            style={{
              backgroundColor: isUser ? '#e6f7ff' : (isError ? '#fff2f0' : '#f6ffed'),
              padding: '8px 12px',
              borderRadius: '8px',
              border: `1px solid ${isUser ? '#91d5ff' : (isError ? '#ffccc7' : '#b7eb8f')}`,
              position: 'relative'
            }}
          >
            {isSending ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Spin size="small" />
                <Text type="secondary">AI正在思考中...</Text>
              </div>
            ) : (
              <Paragraph 
                style={{ 
                  margin: 0, 
                  whiteSpace: 'pre-wrap',
                  color: isError ? '#ff4d4f' : undefined
                }}
              >
                {msg.content}
              </Paragraph>
            )}
            
            {/* 重试按钮 */}
            {isError && (
              <div style={{ marginTop: '8px', textAlign: 'right' }}>
                <Button 
                  size="small" 
                  type="link" 
                  icon={<ReloadOutlined />}
                  onClick={() => handleRetryMessage(msg.id)}
                  disabled={isLoading}
                >
                  重试
                </Button>
              </div>
            )}
            
            {/* 时间戳 */}
            <div style={{ 
              fontSize: '11px', 
              color: '#999', 
              marginTop: '4px',
              textAlign: isUser ? 'right' : 'left'
            }}>
              {msg.timestamp.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </List.Item>
    );
  };

  return (
    <Card 
      title={
        <Space>
          <MessageOutlined />
          <span>AI聊天测试</span>
        </Space>
      }
      size="small"
      extra={
        <Tooltip title="清空聊天记录">
          <Button 
            icon={<ClearOutlined />} 
            size="small"
            onClick={handleClearChat}
            disabled={messages.length === 0 || isLoading}
          >
            清空
          </Button>
        </Tooltip>
      }
      style={{ height: '600px', display: 'flex', flexDirection: 'column' }}
      bodyStyle={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        padding: '16px'
      }}
    >
      {/* 聊天消息列表 */}
      <div 
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          marginBottom: '16px',
          border: '1px solid #f0f0f0',
          borderRadius: '6px',
          padding: '8px'
        }}
      >
        {messages.length === 0 ? (
          <Empty 
            description="暂无对话记录，开始与AI聊天吧"
            style={{ margin: '60px 0' }}
          />
        ) : (
          <List
            dataSource={messages}
            renderItem={renderMessage}
            split={false}
          />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div>
        {disabled && (
          <Alert
            message="请先配置并测试AI连接"
            type="warning"
            showIcon
            style={{ marginBottom: '12px' }}
          />
        )}
        
        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            autoSize={{ minRows: 1, maxRows: 4 }}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSendMessage}
            disabled={disabled || isLoading || !inputMessage.trim()}
            loading={isLoading}
          >
            发送
          </Button>
        </Space.Compact>
        
        <div style={{ 
          fontSize: '12px', 
          color: '#999', 
          marginTop: '8px',
          textAlign: 'center'
        }}>
          按 Enter 发送消息，Shift + Enter 换行
        </div>
      </div>
    </Card>
  );
};

export default ChatPanel;