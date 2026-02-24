const crypto = require('crypto');

// We use aes-256-gcm for authenticated encryption, which guarantees both confidentiality and integrity
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Required for GCM
const AUTH_TAG_LENGTH = 16; // Standard tag length for GCM

function getKey() {
    let key = process.env.ENCRYPTION_KEY;
    if (!key) return null;
    
    // Strip surrounding quotes if present from .env parsing
    if ((key.startsWith("'") && key.endsWith("'")) || (key.startsWith('"') && key.endsWith('"'))) {
        key = key.slice(1, -1);
    }
    
    // AES-256-GCM requires a 32-byte key
    if (Buffer.from(key, 'utf8').length === 32) {
        return Buffer.from(key, 'utf8');
    }
    // Hash to strictly 32 bytes if the provided key is not exactly 32 bytes
    return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypts a plaintext string.
 * @param {string} text Plaintext to encrypt
 * @returns {string} Encrypted string in format: iv:authTag:encryptedContent (all hex)
 */
function encrypt(text) {
    if (!text) return text;
    
    const keyBuf = getKey();
    if (!keyBuf) {
        console.error("CRITICAL: ENCRYPTION_KEY is missing from environment. Using unencrypted value as fallback.");
        return text;
    }

    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, keyBuf, iv);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();

        // Stitch them together using a colon separator
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (err) {
        console.error("Encryption failed:", err);
        throw new Error("Failed to encrypt value");
    }
}

/**
 * Decrypts an encrypted string that was encrypted by the `encrypt` function.
 * @param {string} hash The encrypted string (iv:authTag:encryptedContent)
 * @returns {string} The decrypted plaintext string
 */
function decrypt(hash) {
    if (!hash || typeof hash !== 'string' || !hash.includes(':')) {
        return hash; // Not encrypted or malformed, return as-is
    }
    
    const keyBuf = getKey();
    if (!keyBuf) {
         console.error("CRITICAL: ENCRYPTION_KEY is missing from environment. Cannot decrypt.");
         return null;
    }

    try {
        const parts = hash.split(':');
        if (parts.length !== 3) {
             console.error("Malformed encrypted string. Expected iv:authTag:content");
             return null;
        }

        const [ivHex, authTagHex, encryptedHex] = parts;
        
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const encryptedText = Buffer.from(encryptedHex, 'hex');

        const decipher = crypto.createDecipheriv(ALGORITHM, keyBuf, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (err) {
        console.error("Decryption failed. The data may be tampered with or the encryption key is wrong.");
        console.error(err);
        return null;
    }
}

module.exports = {
    encrypt,
    decrypt
};
