import os
import logging
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)

class EncryptionService:
    _cipher_suite = None

    @classmethod
    def get_cipher(cls):
        if cls._cipher_suite:
            return cls._cipher_suite
        
        # Try to get key from env
        key = os.getenv('CHAT_ENCRYPTION_KEY')
        
        if not key:
            # Check if we can use FLASK_SECRET_KEY/SECRET_KEY if it happens to be valid Fernet key
            # Otherwise generate temporary
            key = os.getenv('SECRET_KEY')
            
        # Validate or generate
        try:
            # Try initializing with found key
            if key:
                if isinstance(key, str):
                    key = key.encode()
                Fernet(key) # Test validity
            else:
                raise ValueError("No key found")
        except Exception:
            # Generate new key if missing or invalid
            key = Fernet.generate_key()
            logger.warning(f"CHAT_ENCRYPTION_KEY not set or invalid. Generated temporary key: {key.decode()}. WARNING: ENCRYPTED MESSAGES WILL BE UNREADABLE AFTER RESTART IF KEY IS NOT SAVED.")
        
        cls._cipher_suite = Fernet(key)
        return cls._cipher_suite

    @classmethod
    def encrypt(cls, text: str) -> str:
        """Encrypt text to string"""
        if not text:
            return text
        try:
            cipher = cls.get_cipher()
            # Encrypt returns bytes, decode to store as string
            return cipher.encrypt(text.encode('utf-8')).decode('utf-8')
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            # Fallback to plain text on error to prevent data loss
            return text

    @classmethod
    def decrypt(cls, text: str) -> str:
        """Decrypt string to text"""
        if not text:
            return text
        try:
            cipher = cls.get_cipher()
            # Decrypt expects bytes
            return cipher.decrypt(text.encode('utf-8')).decode('utf-8')
        except Exception:
            # Likely not encrypted or wrong key or legacy plain text
            # Return original text
            return text
