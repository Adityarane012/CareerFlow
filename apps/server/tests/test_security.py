import sys
import os

# Include src directory in python path for test run
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from server_src.security import encrypt_password, decrypt_password

def test_encryption_decryption_cycle():
    secret = "my-test-super-secret-key-12345"
    plaintext = "GmailAppPasswordCode12345"
    
    # Encrypt
    token = encrypt_password(plaintext, secret)
    assert token != ""
    assert token != plaintext
    
    # Decrypt
    decrypted = decrypt_password(token, secret)
    assert decrypted == plaintext

def test_empty_string_handling():
    secret = "key"
    assert encrypt_password("", secret) == ""
    assert decrypt_password("", secret) == ""
