import os
import base64
import hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

def get_key_from_secret(secret: str) -> bytes:
    """Derives a 32-byte key from any secret string using SHA-256."""
    return hashlib.sha256(secret.encode('utf-8')).digest()

def encrypt_password(password: str, secret: str) -> str:
    """Encrypts a plaintext string using AES-GCM-256 and returns a Base64 string."""
    if not password:
        return ""
    key = get_key_from_secret(secret)
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)  # GCM standard 12-byte nonce
    ciphertext = aesgcm.encrypt(nonce, password.encode('utf-8'), None)
    # Combine nonce + ciphertext and base64-encode
    return base64.b64encode(nonce + ciphertext).decode('utf-8')

def decrypt_password(token: str, secret: str) -> str:
    """Decrypts a Base64 AES-GCM-256 token back to plain text."""
    if not token:
        return ""
    key = get_key_from_secret(secret)
    aesgcm = AESGCM(key)
    raw_data = base64.b64decode(token.encode('utf-8'))
    if len(raw_data) < 12:
        raise ValueError("Invalid cipher text format")
    nonce = raw_data[:12]
    ciphertext = raw_data[12:]
    decrypted = aesgcm.decrypt(nonce, ciphertext, None)
    return decrypted.decode('utf-8')
