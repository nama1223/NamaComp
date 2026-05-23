// Encode a rendered AudioBuffer to WAV (16-bit PCM) or MP3 (lamejs).

import { Mp3Encoder } from '@breezystack/lamejs'

/** Mix an AudioBuffer down to a mono Int16Array of 16-bit PCM samples. */
function toInt16Mono(buffer: AudioBuffer): Int16Array {
  const ch = buffer.numberOfChannels
  const len = buffer.length
  const out = new Int16Array(len)
  const chans: Float32Array[] = []
  for (let c = 0; c < ch; c++) chans.push(buffer.getChannelData(c))
  for (let i = 0; i < len; i++) {
    let s = 0
    for (let c = 0; c < ch; c++) s += chans[c][i]
    s /= ch
    s = Math.max(-1, Math.min(1, s))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

export function encodeWav(buffer: AudioBuffer): Uint8Array {
  const pcm = toInt16Mono(buffer)
  const sampleRate = buffer.sampleRate
  const dataLen = pcm.length * 2
  const out = new Uint8Array(44 + dataLen)
  const view = new DataView(out.buffer)
  const wStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i))
  }
  wStr(0, 'RIFF')
  view.setUint32(4, 36 + dataLen, true)
  wStr(8, 'WAVE')
  wStr(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // audio format = PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  wStr(36, 'data')
  view.setUint32(40, dataLen, true)
  let off = 44
  for (let i = 0; i < pcm.length; i++, off += 2) view.setInt16(off, pcm[i], true)
  return out
}

export function encodeMp3(buffer: AudioBuffer, kbps = 192): Uint8Array {
  const pcm = toInt16Mono(buffer)
  const enc = new Mp3Encoder(1, buffer.sampleRate, kbps)
  const blockSize = 1152
  const chunks: Uint8Array[] = []
  for (let i = 0; i < pcm.length; i += blockSize) {
    const slice = pcm.subarray(i, i + blockSize)
    const buf = enc.encodeBuffer(slice)
    if (buf.length > 0) chunks.push(buf)
  }
  const tail = enc.flush()
  if (tail.length > 0) chunks.push(tail)

  const total = chunks.reduce((n, c) => n + c.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const c of chunks) {
    out.set(c, off)
    off += c.length
  }
  return out
}
