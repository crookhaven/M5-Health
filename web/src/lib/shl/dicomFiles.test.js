import { describe, expect, it } from 'vitest'
import { bytesToBase64Url } from '../base64url'
import { CIPHER_RECORD, PLAIN_RECORD, cipherLength, dicomIndex, fileUrl, readPlaintext, studyInstances, viewerUrl, zipStore } from './dicomFiles'

const SD = 'http://hl7.org/fhir/uv/smart-health-cards-and-links/StructureDefinition/'
const keyBytes = Uint8Array.from({ length: 32 }, (_, i) => 0x20 + i)
const KEY = bytesToBase64Url(keyBytes)
const FILE_ID = 'AAECAwQFBgcICQoLDA0ODw'

// Encrypts a study file the way the shlink-dicom spec describes (9.2).
async function encryptFile(plain) {
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt'])
  const n = Math.max(1, Math.ceil(plain.length / PLAIN_RECORD))
  const out = new Uint8Array(cipherLength(plain.length))
  for (let i = 0; i < n; i++) {
    const iv = new Uint8Array(12)
    new DataView(iv.buffer).setUint32(8, i)
    const rec = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain.subarray(i * PLAIN_RECORD, (i + 1) * PLAIN_RECORD)))
    out.set(rec, i * CIPHER_RECORD)
  }
  return out
}

const instance = (len) => ({ extension: [{ url: `${SD}instance-length`, valueDecimal: len }], uid: `1.2.${len}` })
const study = {
  resourceType: 'ImagingStudy',
  meta: { profile: [`${SD}dicom-imaging-study`] },
  extension: [{ url: `${SD}linked-file`, extension: [{ url: 'id', valueString: FILE_ID }, { url: 'key', valueString: KEY }] }],
  series: [
    { uid: 's1', number: 2, modality: { code: 'CT' }, description: 'Abdomen', instance: [instance(70000)] },
    { uid: 's2', number: 3, modality: { code: 'CT' }, instance: [instance(50000), instance(30000)] },
  ],
}
const plain = Uint8Array.from({ length: 150000 }, (_, k) => k % 251)

function serve(file, { tamper = false } = {}) {
  const calls = []
  const fetchImpl = async (url, opts) => {
    calls.push({ url, range: opts?.headers?.Range })
    const [, a, b] = /bytes=(\d+)-(\d+)/.exec(opts.headers.Range)
    const body = file.slice(Number(a), Number(b) + 1)
    if (tamper) body[3] ^= 1
    return { ok: true, status: 206, arrayBuffer: async () => body.buffer }
  }
  return { fetchImpl, calls }
}

describe('shlink-dicom image files', () => {
  it('indexes each series by file, offset and length', () => {
    const idx = dicomIndex(study)
    expect(idx.files).toEqual([{ id: FILE_ID, key: KEY, plainLength: 150000 }])
    expect(idx.series.map((s) => [s.offset, s.bytes])).toEqual([
      [0, 70000],
      [70000, 80000],
    ])
    expect(idx.instanceCount).toBe(3)
  })

  it('returns null for an ordinary ImagingStudy', () => {
    expect(dicomIndex({ resourceType: 'ImagingStudy', series: [] })).toBeNull()
  })

  it('reads a byte range with one Range request and verifies it', async () => {
    const { fetchImpl, calls } = serve(await encryptFile(plain))
    const bytes = await readPlaintext({ url: fileUrl('https://h.example/s/abc/bundle.jwe', FILE_ID), key: KEY, plainLength: 150000, start: 70000, end: 140000, fetchImpl })
    expect(bytes.every((b, k) => b === (k + 70000) % 251)).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(`https://h.example/s/abc/${FILE_ID}.bin?recipient=M5+Whole+Health`)
    expect(calls[0].range).toBe('bytes=65536-150047')
  })

  it('rejects a record that was altered', async () => {
    const { fetchImpl } = serve(await encryptFile(plain), { tamper: true })
    await expect(readPlaintext({ url: 'https://h.example/x.bin', key: KEY, plainLength: 150000, start: 0, end: 10, fetchImpl })).rejects.toThrow(/integrity check/)
  })

  it('splits the study into its DICOM files and zips them', async () => {
    const { fetchImpl } = serve(await encryptFile(plain))
    const idx = dicomIndex(study)
    const files = await studyInstances(idx, 'https://h.example/s/abc/', { fetchImpl })
    expect(files.map((f) => [f.name, f.bytes.length])).toEqual([
      ['series-002-CT/image-0001.dcm', 70000],
      ['series-003-CT/image-0001.dcm', 50000],
      ['series-003-CT/image-0002.dcm', 30000],
    ])
    const zip = new Uint8Array(await zipStore(files).arrayBuffer())
    expect(new DataView(zip.buffer).getUint32(0, true)).toBe(0x04034b50)
    expect(zip.length).toBeGreaterThan(150000)
  })

  it('builds a viewer link from the original link', () => {
    expect(viewerUrl('https://viewer.example/#shlink:/abc')).toBe('https://shlink-dicom.exe.xyz/view#shlink:/abc')
    expect(viewerUrl('shlink:/abc')).toBe('https://shlink-dicom.exe.xyz/view#shlink:/abc')
  })
})
