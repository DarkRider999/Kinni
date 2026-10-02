// Single shared AudioContext for the whole app. Browsers require a user gesture before
// playback can start, so this is created lazily and resumed on first interaction.
let ctx: AudioContext | null = null

export function getAudioContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
  }
  return ctx
}

export async function ensureAudioRunning(): Promise<AudioContext> {
  const context = getAudioContext()
  if (context.state !== 'running') {
    await context.resume()
  }
  return context
}
