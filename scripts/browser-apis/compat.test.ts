import type {
  CompatStatement,
  SimpleSupportStatement,
  SupportStatement,
} from '@mdn/browser-compat-data'
import { describe, expect, it } from 'vitest'

import { chromeSupport, globalApi, staticApi } from './compat.ts'

const CHROME = 68

function compatWith(chrome: SupportStatement | undefined): CompatStatement {
  return { source_file: 'api/Test.json', support: chrome === undefined ? {} : { chrome } }
}

describe('globalApi', () => {
  it.each([
    ['fetch', true, '42'],
    ['queueMicrotask', false, '71'],
    ['ResizeObserver', true, '64'],
    ['Promise', true, '32'],
    ['globalThis', false, '71'],
    ['requestAnimationFrame', true, '24'],
  ])('should find %s in the tables of MDN', (name, isSupported, since) => {
    const sut = globalApi(name)

    expect(sut === undefined ? undefined : chromeSupport(sut, CHROME)).toStrictEqual({
      isSupported,
      since,
    })
  })

  it.each(['mirante', 'toString', 'constructor'])('should know nothing of %s', (name) => {
    expect(globalApi(name)).toBeUndefined()
  })
})

describe('staticApi', () => {
  it.each([
    ['Object.fromEntries', false, '73'],
    ['Object.entries', true, '54'],
    ['AbortSignal.timeout', false, '103'],
    ['Promise.allSettled', false, '76'],
    ['URL.createObjectURL', true, '19'],
  ])('should find %s in the tables of MDN', (api, isSupported, since) => {
    const [owner = '', member = ''] = api.split('.')
    const sut = staticApi(owner, member)

    expect(sut === undefined ? undefined : chromeSupport(sut, CHROME)).toStrictEqual({
      isSupported,
      since,
    })
  })

  it.each([
    ['Mirante', 'fromEntries'],
    ['Object', 'mirante'],
    ['Object', 'hasOwnProperty_static'],
  ])('should know nothing of %s.%s', (owner, member) => {
    expect(staticApi(owner, member)).toBeUndefined()
  })
})

describe('chromeSupport', () => {
  it('should say nothing when MDN says nothing about Chrome', () => {
    expect(chromeSupport(compatWith(undefined), CHROME)).toBeUndefined()
  })

  it.each([
    ['68', true],
    ['≤37', true],
    ['69', false],
    ['≤83', false],
    ['preview', false],
  ])('should read the version %s', (version, isSupported) => {
    expect(chromeSupport(compatWith({ version_added: version }), CHROME)).toStrictEqual({
      isSupported,
      since: version,
    })
  })

  it('should not count an API Chrome never had', () => {
    expect(chromeSupport(compatWith({ version_added: false }), CHROME)).toStrictEqual({
      isSupported: false,
      since: 'no version',
    })
  })

  it('should not count an API removed by then', () => {
    expect(
      chromeSupport(compatWith({ version_added: '50', version_removed: '68' }), CHROME),
    ).toStrictEqual({ isSupported: false, since: '50' })
    expect(
      chromeSupport(compatWith({ version_added: '50', version_removed: '69' }), CHROME),
    ).toStrictEqual({ isSupported: true, since: '50' })
  })

  const OTHER_NAMES: readonly SimpleSupportStatement[] = [
    { version_added: '20', flags: [{ type: 'preference', name: 'experimental' }] },
    { version_added: '20', prefix: 'webkit' },
    { version_added: '20', alternative_name: 'webkitThing' },
  ]

  it.each(OTHER_NAMES)('should not count an API under another name or a flag: %j', (condition) => {
    expect(chromeSupport(compatWith([{ version_added: '90' }, condition]), CHROME)).toStrictEqual({
      isSupported: false,
      since: '90',
    })
  })

  it('should say the earliest version that has the API as named', () => {
    expect(
      chromeSupport(
        compatWith([
          { version_added: '124' },
          { version_added: '103', version_removed: '124', partial_implementation: true },
        ]),
        CHROME,
      ),
    ).toStrictEqual({ isSupported: false, since: '103' })
  })
})
