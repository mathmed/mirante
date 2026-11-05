// The seed of a random order: a new one for each presentation, from the browser's generator.
export function randomSeed(): number {
  const bytes = crypto.getRandomValues(new Uint32Array(1)).buffer
  return new DataView(bytes).getUint32(0, true)
}
