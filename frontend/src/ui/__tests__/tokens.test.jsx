import { readFileSync } from 'fs'
import { resolve } from 'path'

const CSS_PATH = resolve(__dirname, '../tokens.css')
const css = readFileSync(CSS_PATH, 'utf8')

// ── helpers ────────────────────────────────────────────────────────────────

/**
 * Extract the value assigned to a CSS custom property inside a given block.
 * Returns null if the property is not found in that block.
 */
function extractVar(block, varName) {
  // Match:  --var-name:  <value>;
  const re = new RegExp(`${varName}\\s*:\\s*([^;]+);`)
  const m = block.match(re)
  return m ? m[1].trim() : null
}

/**
 * Return the text content of the first block that matches a selector pattern.
 */
function getBlock(source, selectorPattern) {
  const idx = source.indexOf(selectorPattern)
  if (idx === -1) return null
  const open = source.indexOf('{', idx)
  let depth = 0
  let end = open
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      depth--
      if (depth === 0) { end = i; break }
    }
  }
  return source.slice(open + 1, end)
}

// ── blocks ─────────────────────────────────────────────────────────────────

const rootBlock = getBlock(css, ':root')
const darkBlock = getBlock(css, '[data-theme="dark"]')

// ── tests ──────────────────────────────────────────────────────────────────

describe('tokens.css — light theme (:root)', () => {
  test('file can be read from disk', () => {
    expect(css.length).toBeGreaterThan(100)
  })

  test(':root block exists', () => {
    expect(rootBlock).not.toBeNull()
  })

  test('defines --color-primary in light theme', () => {
    expect(extractVar(rootBlock, '--color-primary')).toBe('#7C6FF7')
  })

  test('defines --color-bg in light theme', () => {
    expect(extractVar(rootBlock, '--color-bg')).toBe('#F7F5F2')
  })

  test('defines --color-text in light theme', () => {
    expect(extractVar(rootBlock, '--color-text')).toBe('#22201E')
  })

  test('defines semantic colours (success / warning / danger)', () => {
    expect(extractVar(rootBlock, '--color-success')).not.toBeNull()
    expect(extractVar(rootBlock, '--color-warning')).not.toBeNull()
    expect(extractVar(rootBlock, '--color-danger')).not.toBeNull()
  })

  test('defines type-scale variables', () => {
    expect(extractVar(rootBlock, '--text-xs')).not.toBeNull()
    expect(extractVar(rootBlock, '--text-2xl')).not.toBeNull()
  })

  test('defines spacing variables', () => {
    expect(extractVar(rootBlock, '--space-1')).not.toBeNull()
    expect(extractVar(rootBlock, '--space-8')).not.toBeNull()
  })

  test('defines radius variables', () => {
    expect(extractVar(rootBlock, '--radius-sm')).not.toBeNull()
    expect(extractVar(rootBlock, '--radius-lg')).not.toBeNull()
  })

  test('defines motion variables', () => {
    expect(extractVar(rootBlock, '--ease-standard')).not.toBeNull()
    expect(extractVar(rootBlock, '--dur-fast')).not.toBeNull()
    expect(extractVar(rootBlock, '--dur-base')).not.toBeNull()
  })
})

describe('tokens.css — mobile redesign tokens', () => {
  test('--gradient-brand is defined in :root', () => {
    expect(extractVar(rootBlock, '--gradient-brand')).not.toBeNull()
  })

  test('--gradient-brand is defined in [data-theme="dark"]', () => {
    expect(extractVar(darkBlock, '--gradient-brand')).not.toBeNull()
  })
})

describe('tokens.css — dark theme ([data-theme="dark"])', () => {
  test('[data-theme="dark"] block exists', () => {
    expect(darkBlock).not.toBeNull()
  })

  test('overrides --color-primary with a different value than light', () => {
    const light = extractVar(rootBlock, '--color-primary')
    const dark  = extractVar(darkBlock,  '--color-primary')
    expect(dark).not.toBeNull()
    expect(dark).not.toBe(light)
  })

  test('overrides --color-bg with a different value than light', () => {
    const light = extractVar(rootBlock, '--color-bg')
    const dark  = extractVar(darkBlock,  '--color-bg')
    expect(dark).not.toBeNull()
    expect(dark).not.toBe(light)
  })

  test('overrides --color-text with a different value than light', () => {
    const light = extractVar(rootBlock, '--color-text')
    const dark  = extractVar(darkBlock,  '--color-text')
    expect(dark).not.toBeNull()
    expect(dark).not.toBe(light)
  })

  test('dark --color-primary matches expected value #9D96FF', () => {
    expect(extractVar(darkBlock, '--color-primary')).toBe('#9D96FF')
  })

  test('dark --color-bg matches expected value #141210', () => {
    expect(extractVar(darkBlock, '--color-bg')).toBe('#141210')
  })

  test('dark --color-text matches expected value #EDE9E5', () => {
    expect(extractVar(darkBlock, '--color-text')).toBe('#EDE9E5')
  })
})
