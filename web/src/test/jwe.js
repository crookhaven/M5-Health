import { base64UrlToBytes, bytesToBase64Url, stringToBase64Url } from '../lib/base64url'

// Test helper: encrypts raw bytes as a compact JWE under an arbitrary protected
// header (e.g. with cty or zip), which the app's own encryptJwe never emits.
export async function encryptJweWithHeader(payloadBytes, keyB64url, header) {
  const protectedB64 = stringToBase64Url(JSON.stringify(header))
  const cryptoKey = await crypto.subtle.importKey('raw', base64UrlToBytes(keyB64url), 'AES-GCM', false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipherBytes = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(protectedB64), tagLength: 128 },
      cryptoKey,
      payloadBytes,
    ),
  )
  return [
    protectedB64,
    '',
    bytesToBase64Url(iv),
    bytesToBase64Url(cipherBytes.slice(0, -16)),
    bytesToBase64Url(cipherBytes.slice(-16)),
  ].join('.')
}
