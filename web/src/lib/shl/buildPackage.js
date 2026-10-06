import { generateKey, encryptJwe } from './crypto'
import { stringToBase64Url } from '../base64url'
import { PACKAGE_URL, SHARE_CONTENT_TYPE } from './packageFile'

// shareBundle is M5's own share format (see buildSharePackageBundle), so it is
// labeled as such rather than as FHIR.
export async function buildShlPackage(shareBundle, { label } = {}) {
  const key = generateKey()
  const jwe = await encryptJwe(JSON.stringify(shareBundle), key)
  const manifest = {
    files: [{ contentType: SHARE_CONTENT_TYPE, embedded: jwe }],
  }
  const payload = {
    url: PACKAGE_URL,
    key,
    flag: 'L',
    label: label ?? 'M5 Health export',
    v: 1,
  }
  const shlUri = 'shlink:/' + stringToBase64Url(JSON.stringify(payload))
  return { key, manifest, payload, shlUri }
}
