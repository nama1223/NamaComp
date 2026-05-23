// One-shot note preview (e.g. tapping a keyboard key). Uses a single shared
// AudioContext, lazily created on first use (a user gesture).

let ctx: AudioContext | null = null

export function playTone(freq: number, dur = 0.4): void {
  try {
    if (!ctx) ctx = new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const t0 = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = freq
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, t0)
    gain.gain.linearRampToValueAtTime(0.3, t0 + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0008, t0 + dur)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  } catch {
    /* audio unavailable */
  }
}
