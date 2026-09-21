import QRCode from 'qrcode'

export function generateQrDataUrl(text) {
  return QRCode.toDataURL(text, { margin: 1, width: 320 })
}
