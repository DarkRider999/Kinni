import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { tokens } from '../tokens'

const root = resolve(import.meta.dirname, '../../..')
const source = JSON.parse(readFileSync(resolve(root, '../replica/design/tokens.json'), 'utf8'))

describe('design tokens', () => {
  it('generated files match replica/design/tokens.json', () => {
    expect(() => execFileSync('node', [resolve(root, 'scripts/gen-tokens.mjs'), '--check'], { stdio: 'pipe' })).not.toThrow()
    expect(tokens.color).toEqual(source.color)
  })

  it('every colour role is a 6-digit hex', () => {
    for (const [name, value] of Object.entries(tokens.color)) {
      expect(value, name).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('every contrast pair names real roles', () => {
    for (const [fg, bg] of source.pairs as [string, string][]) {
      expect(source.color, `pair ${fg}/${bg}`).toHaveProperty(fg)
      expect(source.color, `pair ${fg}/${bg}`).toHaveProperty(bg)
    }
  })
})
