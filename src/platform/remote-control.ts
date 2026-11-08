import { type KeyListener, type KeySource, RemoteKey } from '../core/remote-key.ts'

const ENTER = 13
const LEFT = 37
const UP = 38
const RIGHT = 39
const DOWN = 40
const TIZEN_BACK = 10_009
const WEBOS_BACK = 461
// Info on the remote controls of Tizen and webOS; Tizen only sends it to an app that registered it
// (tizen-keys.ts).
const INFO = 457
// The keys that stand in for Back and Info on a desktop browser.
const ESCAPE = 27
const BACKSPACE = 8
const LETTER_I = 73

// The TVs report their keys by code; Tizen and webOS give Back a code of their own. On Tizen,
// arrows, Enter and Back reach every app without `tizen.tvinputdevice.registerKey` (Info, the color,
// media and number keys need it), and Back comes as this keydown: `tizenhwkey` is the hardware Back
// of Tizen phones and watches, and listening to both would act twice on one press.
const KEYS: ReadonlyMap<number, RemoteKey> = new Map([
  [ENTER, RemoteKey.Enter],
  [LEFT, RemoteKey.Left],
  [UP, RemoteKey.Up],
  [RIGHT, RemoteKey.Right],
  [DOWN, RemoteKey.Down],
  [TIZEN_BACK, RemoteKey.Back],
  [WEBOS_BACK, RemoteKey.Back],
  [ESCAPE, RemoteKey.Back],
  [BACKSPACE, RemoteKey.Back],
  [INFO, RemoteKey.Info],
  [LETTER_I, RemoteKey.Info],
])

// While a text field has the focus, these keys are the remote control's (Up and Down leave the
// field, Enter takes what was typed, the TVs' Back closes the dialog); every other key types, or
// moves in the text, as the browser and the keyboard of the TV make it.
const TYPING_KEYS: ReadonlySet<number> = new Set([ENTER, UP, DOWN, TIZEN_BACK, WEBOS_BACK, ESCAPE])

// A held arrow walks the grid; a held Enter, Back or Info acts once.
const REPEATING: ReadonlySet<RemoteKey> = new Set([
  RemoteKey.Left,
  RemoteKey.Up,
  RemoteKey.Right,
  RemoteKey.Down,
])

// What the app reads of a keydown event. The TVs only report the code of their own keys.
type KeyPress = Pick<KeyboardEvent, 'preventDefault' | 'repeat'> & {
  readonly keyCode: number
  readonly target: unknown
}

export interface KeyTarget {
  readonly addEventListener: (type: 'keydown', listener: (event: KeyPress) => void) => void
}

// Listens once to the page for the life of the app and hands each key of the remote control to the
// screens that listen. The browser never acts on those keys itself: arrows do not scroll the page
// and Backspace does not leave it.
export function listenToRemote(target: KeyTarget): KeySource {
  const listeners = new Set<KeyListener>()
  target.addEventListener('keydown', (event) => {
    const key = remoteKeyOf(event)
    if (key === undefined) {
      return
    }
    event.preventDefault()
    if (event.repeat && !REPEATING.has(key)) {
      return
    }
    for (const listener of [...listeners]) {
      listener(key)
    }
  })
  return {
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

// Undefined for a key of no remote control, or one typed into a text field.
function remoteKeyOf({ target, keyCode }: KeyPress): RemoteKey | undefined {
  const isTyped = target instanceof HTMLInputElement && !TYPING_KEYS.has(keyCode)
  return isTyped ? undefined : KEYS.get(keyCode)
}
