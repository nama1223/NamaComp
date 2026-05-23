export function downloadText(
  filename: string,
  text: string,
  mime = 'application/octet-stream',
): void {
  downloadBlob(filename, new Blob([text], { type: mime }))
}

export function downloadBytes(
  filename: string,
  bytes: Uint8Array,
  mime = 'application/octet-stream',
): void {
  // Copy into a fresh ArrayBuffer so Blob gets a clean, correctly-sized buffer.
  const buf = bytes.slice()
  downloadBlob(filename, new Blob([buf], { type: mime }))
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
