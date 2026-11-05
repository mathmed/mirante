import { fireEvent } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { RemoteKey } from '../core/remote-key.ts'
import { listenToRemote } from './remote-control.ts'

interface Listening {
  readonly keys: RemoteKey[]
  readonly stop: () => void
}

function listening(): Listening {
  const keys: RemoteKey[] = []
  const target = document.createElement('div')
  document.body.append(target)
  const source = listenToRemote(target)
  const stop = source.subscribe((key) => keys.push(key))
  return { keys, stop }
}

function press(keyCode: number, isRepeat = false): boolean {
  const target = document.body.lastElementChild
  if (target === null) {
    throw new Error('nothing listens')
  }
  return fireEvent.keyDown(target, { keyCode, repeat: isRepeat })
}

describe('listenToRemote', () => {
  it.each([
    [37, RemoteKey.Left],
    [38, RemoteKey.Up],
    [39, RemoteKey.Right],
    [40, RemoteKey.Down],
    [13, RemoteKey.Enter],
    [10009, RemoteKey.Back],
    [461, RemoteKey.Back],
    [27, RemoteKey.Back],
    [8, RemoteKey.Back],
    [457, RemoteKey.Info],
    [73, RemoteKey.Info],
  ])('should read the key code %i as %s and keep the browser from acting on it', (code, key) => {
    const sut = listening()

    const isDefaultAllowed = press(code)

    expect(sut.keys).toStrictEqual([key])
    expect(isDefaultAllowed).toBe(false)
  })

  it('should leave the other keys to the browser', () => {
    const sut = listening()

    const isDefaultAllowed = press(65)

    expect(sut.keys).toStrictEqual([])
    expect(isDefaultAllowed).toBe(true)
  })

  it('should repeat an arrow held down', () => {
    const sut = listening()

    press(40)
    press(40, true)

    expect(sut.keys).toStrictEqual([RemoteKey.Down, RemoteKey.Down])
  })

  it.each([13, 10009, 457])('should act once on the key %i held down', (code) => {
    const sut = listening()

    press(code)
    const isDefaultAllowed = press(code, true)

    expect(sut.keys).toHaveLength(1)
    expect(isDefaultAllowed).toBe(false)
  })

  it('should tell every listener, and stop telling one that stopped listening', () => {
    const target = document.createElement('div')
    document.body.append(target)
    const sut = listenToRemote(target)
    const first: RemoteKey[] = []
    const second: RemoteKey[] = []
    const stopFirst = sut.subscribe((key) => first.push(key))
    sut.subscribe((key) => second.push(key))

    fireEvent.keyDown(target, { keyCode: 37 })
    stopFirst()
    fireEvent.keyDown(target, { keyCode: 39 })

    expect(first).toStrictEqual([RemoteKey.Left])
    expect(second).toStrictEqual([RemoteKey.Left, RemoteKey.Right])
  })

  it('should not hand the key being handled to a listener that starts listening meanwhile', () => {
    const target = document.createElement('div')
    document.body.append(target)
    const sut = listenToRemote(target)
    const late: RemoteKey[] = []
    const stop = sut.subscribe(() => {
      stop()
      sut.subscribe((key) => late.push(key))
    })

    fireEvent.keyDown(target, { keyCode: 13 })

    expect(late).toStrictEqual([])
  })
})
