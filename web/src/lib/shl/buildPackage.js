import { generateKey, encryptJwe } from './crypto'
import { stringToBase64Url } from '../base64url'

export async function buildShlPackage(fhirBundle, { label } = {}) {
  const key = generateKey()
  const jwe = await encryptJwe(JSON.stringify(fhirBundle), key)
  const manifest = {
    files: [{ contentType: 'application/fhir+json', embedded: jwe }],
  }
  const payload = {
    url: 'local://m5-health/no-hosting-available',
    key,
    flag: 'L',
    label: label ?? 'M5 Health export',
    v: 1,
  }
  const shlUri = 'shlink:/' + stringToBase64Url(JSON.stringify(payload))
  return { key, manifest, payload, shlUri }
}
