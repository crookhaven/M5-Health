import { describe, it, expect } from 'vitest'
import { buildShlPackage } from './buildPackage'
import { decryptJwe } from './crypto'
import { parseShlUri } from './parse'

describe('buildShlPackage', () => {
  it('produces a parseable shlink URI whose payload key decrypts the manifest', async () => {
    const bundle = { resourceType: 'Bundle', entry: [] }
    const pkg = await buildShlPackage(bundle, { label: 'test export' })

    expect(pkg.shlUri.startsWith('shlink:/')).toBe(true)

    const payload = parseShlUri(pkg.shlUri)
    expect(payload.key).toBe(pkg.key)
    expect(payload.label).toBe('test export')

    const plaintext = await decryptJwe(pkg.manifest.files[0].embedded, payload.key)
    expect(JSON.parse(plaintext)).toEqual(bundle)
  })

  it('uses a non-resolvable local URL since there is no hosting server', async () => {
    const pkg = await buildShlPackage({ resourceType: 'Bundle', entry: [] })
    expect(pkg.payload.url).toMatch(/^local:\/\//)
  })

  it('defaults the label when none is given', async () => {
    const pkg = await buildShlPackage({ resourceType: 'Bundle', entry: [] })
    expect(pkg.payload.label).toBe('M5 Health export')
  })
})
