import { describe, it, expect } from 'vitest'
import { urlBase64ToUint8Array } from '../push'

describe('urlBase64ToUint8Array', () => {
  it('decodes a base64url VAPID key to a Uint8Array of the right length', () => {
    // "BIN" base64url → 3 bytes; verify it returns a Uint8Array and round-trips known bytes
    const out = urlBase64ToUint8Array('AAAA') // 3 bytes of zero
    expect(out).toBeInstanceOf(Uint8Array)
    expect(out.length).toBe(3)
    expect(Array.from(out)).toEqual([0, 0, 0])
  })
  it('handles base64url chars (- and _) and missing padding', () => {
    expect(() => urlBase64ToUint8Array('a-_b')).not.toThrow()
  })
})
