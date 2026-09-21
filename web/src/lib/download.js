export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadText(text, filename, mimeType = 'application/json') {
  downloadBlob(new Blob([text], { type: mimeType }), filename)
}
