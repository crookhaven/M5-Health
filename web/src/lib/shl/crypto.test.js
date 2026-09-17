import { describe, it, expect } from 'vitest'
import { generateKey, encryptJwe, decryptJwe } from './crypto'
import { base64UrlToBytes, base64UrlDecodeToString } from '../base64url'

describe('generateKey', () => {
  it('produces a 32-byte key encoded as base64url', () => {
    const key = generateKey()
    expect(key).not.toMatch(/[+/=]/)
    expect(base64UrlToBytes(key)).toHaveLength(32)
  })

  it('produces a different key on each call', () => {
    expect(generateKey()).not.toBe(generateKey())
  })
})

describe('encryptJwe / decryptJwe', () => {
  it('round-trips plaintext through the same key', async () => {
    const key = generateKey()
    const plaintext = JSON.stringify({ resourceType: 'Patient', id: 'abc' })
    const jwe = await encryptJwe(plaintext, key)
    expect(await decryptJwe(jwe, key)).toBe(plaintext)
  })

  it('produces a 5-part compact JWE with a dir/A256GCM header', async () => {
    const key = generateKey()
    const jwe = await encryptJwe('hello', key)
    const parts = jwe.split('.')
    expect(parts).toHaveLength(5)
    expect(parts[1]).toBe('') // "dir" alg has no encrypted key
    const header = JSON.parse(base64UrlDecodeToString(parts[0]))
    expect(header).toEqual({ alg: 'dir', enc: 'A256GCM' })
  })

  it('fails to decrypt with the wrong key', async () => {
    const jwe = await encryptJwe('secret', generateKey())
    await expect(decryptJwe(jwe, generateKey())).rejects.toThrow(/decryption failed/i)
  })

  it('fails to decrypt tampered ciphertext', async () => {
    const key = generateKey()
    const jwe = await encryptJwe('secret', key)
    const parts = jwe.split('.')
    const tamperedCiphertext = parts[3].slice(0, -2) + (parts[3].slice(-2) === 'AA' ? 'BB' : 'AA')
    const tampered = [parts[0], parts[1], parts[2], tamperedCiphertext, parts[4]].join('.')
    await expect(decryptJwe(tampered, key)).rejects.toThrow(/decryption failed/i)
  })

  it('rejects an unsupported alg/enc header', async () => {
    const key = generateKey()
    const jwe = await encryptJwe('secret', key)
    const parts = jwe.split('.')
    const badHeader = Buffer.from(JSON.stringify({ alg: 'RSA-OAEP', enc: 'A256GCM' }))
      .toString('base64url')
    const tampered = [badHeader, parts[1], parts[2], parts[3], parts[4]].join('.')
    await expect(decryptJwe(tampered, key)).rejects.toThrow(/unsupported encryption/i)
  })

  it('rejects a malformed JWE that is missing parts', async () => {
    await expect(decryptJwe('not.a.valid.jwe', generateKey())).rejects.toThrow(
      /JWE compact serialization/i,
    )
  })
})
