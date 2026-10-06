import { describe, it, expect } from 'vitest'
import { buildShlPackage } from './buildPackage'
import { parseShlUri } from './parse'
import { isPackageOnlyLink, openPackageFile, packageFileContent, recordsFromShareContent } from './packageFile'

const share = {
  generatedAt: '2026-10-05T12:00:00.000Z',
  records: {
    medications: [{ id: 'm1', data: { medication: { text: 'Lisinopril' } }, confirmed: false }],
    conditions: [{ id: 'c1', data: { condition: { text: 'Hypertension' } }, confirmed: true }],
    notADomain: [{ id: 'x', data: {} }],
  },
  provenance: [],
  assertions: [],
}

describe('SMART Health Link package files', () => {
  it('round-trips: the link plus the package file give back the records', async () => {
    const pkg = await buildShlPackage(share, { label: 'Family export' })
    const fileText = JSON.stringify(packageFileContent(pkg))

    const opened = await openPackageFile(fileText, pkg.shlUri)
    expect(opened.label).toBe('Family export')
    expect(recordsFromShareContent(opened.contents[0])).toEqual([
      { domain: 'medications', data: { medication: { text: 'Lisinopril' } } },
      { domain: 'conditions', data: { condition: { text: 'Hypertension' } } },
    ])
  })

  it('keeps the key out of the package file, so the file alone is unreadable', async () => {
    const pkg = await buildShlPackage(share)
    const fileText = JSON.stringify(packageFileContent(pkg))
    expect(fileText).not.toContain(pkg.key)
    await expect(openPackageFile(fileText, '')).rejects.toThrow(/paste the smart health link/i)
  })

  it('opens packages saved by older versions, which included the key', async () => {
    const pkg = await buildShlPackage(share)
    const oldFile = JSON.stringify({ payload: pkg.payload, manifest: pkg.manifest })
    const opened = await openPackageFile(oldFile)
    expect(recordsFromShareContent(opened.contents[0])).toHaveLength(2)
  })

  it('fails clearly on the wrong key or a file that is not a package', async () => {
    const pkg = await buildShlPackage(share)
    const other = await buildShlPackage(share)
    await expect(openPackageFile(JSON.stringify(packageFileContent(pkg)), other.shlUri)).rejects.toThrow(/decryption failed/i)
    await expect(openPackageFile('not json')).rejects.toThrow(/not json/i)
    await expect(openPackageFile('{"resourceType":"Bundle"}')).rejects.toThrow(/no encrypted files/i)
  })

  it('recognizes links that have no online copy', async () => {
    const pkg = await buildShlPackage(share)
    expect(isPackageOnlyLink(parseShlUri(pkg.shlUri))).toBe(true)
    expect(isPackageOnlyLink({ url: 'https://example.org/file.jwe' })).toBe(false)
  })
})
