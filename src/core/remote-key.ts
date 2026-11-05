// The keys of the remote control, the only input of the app. src/platform turns the key codes of
// each TV into these.
export const RemoteKey = {
  Up: 'up',
  Down: 'down',
  Left: 'left',
  Right: 'right',
  Enter: 'enter',
  Back: 'back',
} as const

export type RemoteKey = (typeof RemoteKey)[keyof typeof RemoteKey]

export type KeyListener = (key: RemoteKey) => void

export interface KeySource {
  // Returns the function that stops listening.
  readonly subscribe: (listener: KeyListener) => () => void
}
