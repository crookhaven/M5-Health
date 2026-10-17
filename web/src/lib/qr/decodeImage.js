import jsQR from 'jsqr'

// jsQR needs dark modules on a light background with a quiet zone around the
// code. Saved QR images often break that: a transparent PNG draws as black on a
// blank canvas, and a tightly cropped code has no margin. So each attempt paints
// white first, adds a margin, and tries a few sizes and both colour schemes.
const SIZES = [null, 1024, 600, 400]

function attempt(img, size) {
  const scale = size ? Math.min(1, size / Math.max(img.width, img.height)) : 1
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const margin = Math.round(Math.max(w, h) * 0.1) + 8
  const canvas = document.createElement('canvas')
  canvas.width = w + margin * 2
  canvas.height = h + margin * 2
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, margin, margin, w, h)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return jsQR(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' })
}

export function decodeQrFromImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      for (const size of SIZES) {
        const result = attempt(img, size)
        if (result?.data) {
          resolve(result.data.trim())
          return
        }
      }
      reject(
        new Error(
          'No QR code could be found in that image. Try a sharper or larger image, or scan the code with your phone and paste the link into the box above.',
        ),
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not load that image.'))
    }
    img.src = url
  })
}
