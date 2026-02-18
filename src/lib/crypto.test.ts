import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from './crypto'

const TEST_KEY = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

describe('AES-256-GCM crypto', () => {
  it('round-trip: decrypt(encrypt(text)) === text', () => {
    const plaintext = 'my-secret-api-key-12345'
    const encrypted = encrypt(plaintext, TEST_KEY)
    const decrypted = decrypt(encrypted, TEST_KEY)
    expect(decrypted).toBe(plaintext)
  })

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const plaintext = 'same-input'
    const a = encrypt(plaintext, TEST_KEY)
    const b = encrypt(plaintext, TEST_KEY)
    expect(a).not.toBe(b)
  })

  it('handles JSON credential payloads', () => {
    const creds = JSON.stringify({ apiKey: 'sk-123', orgId: 'org-abc' })
    const encrypted = encrypt(creds, TEST_KEY)
    const decrypted = decrypt(encrypted, TEST_KEY)
    expect(JSON.parse(decrypted)).toEqual({ apiKey: 'sk-123', orgId: 'org-abc' })
  })

  it('throws on tampered ciphertext', () => {
    const encrypted = encrypt('secret', TEST_KEY)
    const buf = Buffer.from(encrypted, 'base64')
    buf[buf.length - 1] ^= 0xff // flip last byte
    const tampered = buf.toString('base64')
    expect(() => decrypt(tampered, TEST_KEY)).toThrow()
  })
})
