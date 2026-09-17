import { base64UrlToBytes, bytesToBase64Url, base64UrlDecodeToString, stringToBase64Url } from '../base64url'

export function generateKey() {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)))
}

export async function decryptJwe(compactJwe, keyB64url) {
  const parts = compactJwe.split('.')
  if (parts.length !== 5) {
    throw new Error('Not a valid encrypted SHL file (expected JWE compact serialization).')
  }
  const [protectedB64, , ivB64, ciphertextB64, tagB64] = parts
  const header = JSON.parse(base64UrlDecodeToString(protectedB64))
  if (header.alg !== 'dir' || header.enc !== 'A256GCM') {
    throw new Error(`Unsupported encryption (alg=${header.alg}, enc=${header.enc}); expected dir/A256GCM.`)
  }
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    base64UrlToBytes(keyB64url),
    'AES-GCM',
    false,
    ['decrypt'],
  )
  const iv = base64UrlToBytes(ivB64)
  const ciphertext = base64UrlToBytes(ciphertextB64)
  const tag = base64UrlToBytes(tagB64)
  const combined = new Uint8Array(ciphertext.length + tag.length)
  combined.set(ciphertext, 0)
  combined.set(tag, ciphertext.length)
  const aad = new TextEncoder().encode(protectedB64)

  let plainBuf
  try {
    plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 },
      cryptoKey,
      combined,
    )
  } catch {
    throw new Error('Decryption failed. The key may be wrong or the file corrupted.')
  }
  return new TextDecoder().decode(plainBuf)
}

export async function encryptJwe(plaintext, keyB64url) {
  const protectedB64 = stringToBase64Url(JSON.stringify({ alg: 'dir', enc: 'A256GCM' }))
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    base64UrlToBytes(keyB64url),
    'AES-GCM',
    false,
    ['encrypt'],
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const aad = new TextEncoder().encode(protectedB64)
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 },
    cryptoKey,
    new TextEncoder().encode(plaintext),
  )
  const cipherBytes = new Uint8Array(cipherBuf)
  const ciphertext = cipherBytes.slice(0, cipherBytes.length - 16)
  const tag = cipherBytes.slice(cipherBytes.length - 16)
  return [
    protectedB64,
    '',
    bytesToBase64Url(iv),
    bytesToBase64Url(ciphertext),
    bytesToBase64Url(tag),
  ].join('.')
}
