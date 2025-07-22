"""
加密工具类
用于加密和解密敏感配置信息
"""
import base64
import secrets
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import os


class EncryptionUtil:
    """加密工具类"""
    
    def __init__(self, secret_key: str = None):
        """
        初始化加密工具
        
        Args:
            secret_key: 加密密钥，如果不提供则使用环境变量或默认值
        """
        if secret_key is None:
            secret_key = os.getenv("ENCRYPTION_SECRET_KEY", "default-encryption-key-change-in-production")
        
        # 使用PBKDF2从密钥生成Fernet密钥
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b'research-dashboard-salt',  # 在生产环境中应该使用随机盐
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(secret_key.encode()))
        self.cipher_suite = Fernet(key)
    
    def encrypt(self, plaintext: str) -> str:
        """
        加密文本
        
        Args:
            plaintext: 明文
            
        Returns:
            加密后的文本（base64编码）
        """
        if not plaintext:
            return ""
        
        encrypted_bytes = self.cipher_suite.encrypt(plaintext.encode())
        return base64.urlsafe_b64encode(encrypted_bytes).decode()
    
    def decrypt(self, ciphertext: str) -> str:
        """
        解密文本
        
        Args:
            ciphertext: 密文（base64编码）
            
        Returns:
            解密后的明文
        """
        if not ciphertext:
            return ""
        
        try:
            encrypted_bytes = base64.urlsafe_b64decode(ciphertext.encode())
            decrypted_bytes = self.cipher_suite.decrypt(encrypted_bytes)
            return decrypted_bytes.decode()
        except Exception:
            # 如果解密失败，返回原文（可能是未加密的数据）
            return ciphertext
    
    def mask_api_key(self, api_key: str, visible_chars: int = 8) -> str:
        """
        屏蔽API密钥，只显示部分字符
        
        Args:
            api_key: 完整的API密钥
            visible_chars: 显示的字符数
            
        Returns:
            屏蔽后的API密钥
        """
        if not api_key or len(api_key) <= visible_chars:
            return api_key
        
        return f"{api_key[:visible_chars//2]}...{api_key[-visible_chars//2:]}"
    
    @staticmethod
    def generate_secret_key() -> str:
        """
        生成随机密钥
        
        Returns:
            32字节的随机密钥（base64编码）
        """
        return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode()


# 创建默认加密工具实例
encryption_util = EncryptionUtil()