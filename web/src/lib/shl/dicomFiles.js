import { base64UrlToBytes } from '../base64url'

// SMART Health Links for DICOM imaging (draft "shlink-dicom" profile,
// https://github.com/jmandel/shlink-dicom/blob/main/spec/README.md).
// The link's Bundle holds an ImagingStudy that names, for each study, an
// encrypted file beside the Bundle ({fileId}.bin) and its own AES-256-GCM key.
// The file is the study's original DICOM files laid end to end and encrypted
// in 64 KiB records, so any series can be fetched with one Range request and
// every record is verified as it is decrypted. Written from the spec.

const SD = 'http://hl7.org/fhir/uv/smart-health-cards-and-links/StructureDefinition/'
export const DICOM_STUDY_PROFILE = `${SD}dicom-imaging-study`
const LINKED_FILE = `${SD}linked-file`
const INSTANCE_LENGTH = `${SD}instance-length`
export const PLAIN_RECORD = 65520
export const CIPHER_RECORD = 65536
export const VIEWER_PREFIX = 'https://shlink-dicom.exe.xyz/view'

function linkedFile(el) {
  const e = el?.extension?.find((x) => x.url === LINKED_FILE)
  if (!e) return null
  const sub = (name) => e.extension?.find((x) => x.url === name)?.valueString
  const id = sub('id')
  const key = sub('key')
  return id && key ? { id, key } : null
}

// Where each series' bytes are, from the ImagingStudy alone (spec 8.1): walk
// series then instances in order, keeping a running offset per file.
// Returns null for an ordinary ImagingStudy with no linked files.
export function dicomIndex(study) {
  const studyFile = linkedFile(study)
  const anySeriesFile = (study.series ?? []).some((s) => linkedFile(s))
  if (!studyFile && !anySeriesFile) return null
  const files = new Map()
  const series = []
  for (const s of study.series ?? []) {
    const file = linkedFile(s) ?? studyFile
    if (!file) throw new Error(`Series ${s.uid ?? s.number ?? ''} has no image file.`)
    if (!files.has(file.id)) files.set(file.id, { ...file, plainLength: 0 })
    const f = files.get(file.id)
    const lengths = (s.instance ?? []).map((i) => {
      const n = i.extension?.find((x) => x.url === INSTANCE_LENGTH)?.valueDecimal
      if (!Number.isInteger(n) || n <= 0) throw new Error('An image is missing its length.')
      return n
    })
    const bytes = lengths.reduce((a, b) => a + b, 0)
    series.push({
      uid: s.uid,
      number: s.number ?? null,
      description: s.description ?? null,
      modality: s.modality?.display ?? s.modality?.code ?? null,
      fileId: file.id,
      offset: f.plainLength,
      lengths,
      bytes,
    })
    f.plainLength += bytes
  }
  return {
    files: [...files.values()],
    series,
    instanceCount: series.reduce((n, s) => n + s.lengths.length, 0),
    totalBytes: series.reduce((n, s) => n + s.bytes, 0),
  }
}

export function cipherLength(plainLength) {
  return plainLength + 16 * Math.max(1, Math.ceil(plainLength / PLAIN_RECORD))
}

export function fileUrl(baseUrl, fileId, recipient = 'M5 Whole Health') {
  const url = new URL(`${fileId}.bin`, baseUrl)
  url.searchParams.set('recipient', recipient)
  return url.toString()
}

function nonce(i) {
  const n = new Uint8Array(12)
  new DataView(n.buffer).setUint32(8, i)
  new DataView(n.buffer).setUint32(4, Math.floor(i / 2 ** 32))
  return n
}

// Plaintext bytes [start, end) of one encrypted file (spec 9.3): one Range
// request for the records that hold them, each record verified and decrypted.
export async function readPlaintext({ url, key, plainLength, start, end, fetchImpl = globalThis.fetch }) {
  if (end <= start) return new Uint8Array(0)
  const first = Math.floor(start / PLAIN_RECORD)
  const last = Math.floor((end - 1) / PLAIN_RECORD)
  const total = cipherLength(plainLength)
  const from = first * CIPHER_RECORD
  const to = Math.min(total, (last + 1) * CIPHER_RECORD)
  let res
  try {
    res = await fetchImpl(url, { headers: { Range: `bytes=${from}-${to - 1}` } })
  } catch {
    throw new Error('Could not reach the server that holds the images.')
  }
  if (res.status === 404) throw new Error('The images are no longer available. The link may have expired or been withdrawn.')
  if (!res.ok) throw new Error(`The image server responded ${res.status}.`)
  let body = new Uint8Array(await res.arrayBuffer())
  if (res.status === 200) {
    // The server sent the whole file instead of the range.
    if (body.length !== total) throw new Error('The image file is not the expected size.')
    body = body.subarray(from, to)
  }
  if (body.length !== to - from) throw new Error('The image server returned the wrong number of bytes.')
  const cryptoKey = await crypto.subtle.importKey('raw', base64UrlToBytes(key), 'AES-GCM', false, ['decrypt'])
  const plain = new Uint8Array((last - first + 1) * PLAIN_RECORD)
  let written = 0
  for (let i = first; i <= last; i++) {
    const rec = body.subarray((i - first) * CIPHER_RECORD, Math.min(body.length, (i - first + 1) * CIPHER_RECORD))
    let chunk
    try {
      chunk = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce(i) }, cryptoKey, rec))
    } catch {
      throw new Error('An image record failed its integrity check, so nothing from it was used.')
    }
    plain.set(chunk, written)
    written += chunk.length
  }
  const skip = start - first * PLAIN_RECORD
  return plain.subarray(skip, skip + (end - start))
}

// Every DICOM file of the study, as { name, bytes }, one Range request per series.
export async function studyInstances(dicom, baseUrl, { fetchImpl, onProgress } = {}) {
  const out = []
  let done = 0
  for (const [si, s] of dicom.series.entries()) {
    const file = dicom.files.find((f) => f.id === s.fileId)
    const bytes = await readPlaintext({
      url: fileUrl(baseUrl, file.id),
      key: file.key,
      plainLength: file.plainLength,
      start: s.offset,
      end: s.offset + s.bytes,
      fetchImpl,
    })
    let at = 0
    const folder = `series-${String(s.number ?? si + 1).padStart(3, '0')}${s.modality ? `-${s.modality}` : ''}`
    s.lengths.forEach((len, ii) => {
      const dcm = bytes.subarray(at, at + len)
      at += len
      out.push({ name: `${folder}/image-${String(ii + 1).padStart(4, '0')}.dcm`, bytes: dcm })
    })
    done += s.bytes
    onProgress?.(done / dicom.totalBytes)
  }
  return out
}

// The link to open the study in the shlink-dicom web viewer.
export function viewerUrl(shlUri) {
  const at = shlUri?.indexOf('shlink:/')
  return at >= 0 ? `${VIEWER_PREFIX}#${shlUri.slice(at)}` : null
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// A ZIP of the files, stored without compression (DICOM is usually already
// compressed, and storing keeps this small and fast).
export function zipStore(entries) {
  const enc = new TextEncoder()
  const parts = []
  const central = []
  let offset = 0
  for (const { name, bytes } of entries) {
    const nameBytes = enc.encode(name)
    const crc = crc32(bytes)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(8, 0, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, bytes.length, true)
    local.setUint32(22, bytes.length, true)
    local.setUint16(26, nameBytes.length, true)
    parts.push(local.buffer, nameBytes, bytes)
    const cd = new DataView(new ArrayBuffer(46))
    cd.setUint32(0, 0x02014b50, true)
    cd.setUint16(4, 20, true)
    cd.setUint16(6, 20, true)
    cd.setUint32(16, crc, true)
    cd.setUint32(20, bytes.length, true)
    cd.setUint32(24, bytes.length, true)
    cd.setUint16(28, nameBytes.length, true)
    cd.setUint32(42, offset, true)
    central.push(cd.buffer, nameBytes)
    offset += 30 + nameBytes.length + bytes.length
  }
  const cdSize = central.reduce((n, p) => n + (p.byteLength ?? p.length), 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, cdSize, true)
  end.setUint32(16, offset, true)
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' })
}
