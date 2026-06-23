import { describe, it, expect } from 'vitest'
import { pwaManifest } from '../pwaManifest.js'

describe('pwaManifest', () => {
  it('has the correct app name', () => {
    expect(pwaManifest.name).toBe('CollaborList')
  })

  it('has standalone display mode', () => {
    expect(pwaManifest.display).toBe('standalone')
  })

  it('has exactly 3 icons', () => {
    expect(pwaManifest.icons).toHaveLength(3)
  })

  it('includes a maskable icon', () => {
    const maskable = pwaManifest.icons.find((icon) => icon.purpose === 'maskable')
    expect(maskable).toBeDefined()
  })
})
