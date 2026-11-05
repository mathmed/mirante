import { gzipSync } from 'node:zlib'

import { describe, expect, it } from 'vitest'

import { appIpk, arArchive, ipk, tar } from '../../test/support/ipk.ts'
import { appFiles, ipkFiles } from './ipk.ts'

const APP_ID = 'com.mathmed.mirante'
const LONG_NAME = `assets/${'a'.repeat(90)}.js`

function paths(files: readonly { readonly path: string }[]): string[] {
  return files.map((file) => file.path)
}

describe('ipkFiles', () => {
  it('should read the files the package installs, without its folders', () => {
    const sut = ipkFiles(appIpk(APP_ID, [{ path: 'index.html', content: '<html>' }]))

    expect(paths(sut)).toStrictEqual([`usr/palm/applications/${APP_ID}/index.html`])
    expect(Buffer.from(sut[0]?.content ?? []).toString()).toBe('<html>')
  })

  it('should read contents that span several blocks, and members of an odd size', () => {
    const big = 'x'.repeat(1500)

    const sut = ipkFiles(
      ipk([
        { path: 'odd.txt', content: 'abc' },
        { path: 'big.txt', content: big },
      ]),
    )

    expect(sut.map((file) => Buffer.from(file.content).toString())).toStrictEqual(['abc', big])
  })

  it('should join the prefix and the name of a long path', () => {
    const sut = ipkFiles(appIpk(APP_ID, [{ path: LONG_NAME, content: '' }]))

    expect(paths(appFiles(sut, APP_ID))).toStrictEqual([LONG_NAME])
  })

  it('should read the files of an archive that does not end with empty blocks', () => {
    const data = tar([{ path: 'index.html', content: 'x' }]).subarray(0, 1024)

    const sut = ipkFiles(arArchive([['data.tar.gz', gzipSync(data)]]))

    expect(paths(sut)).toStrictEqual(['index.html'])
  })

  it('should refuse a file that is not an ar archive', () => {
    expect(() => ipkFiles(Buffer.from('PK\u0003\u0004'))).toThrow('O .ipk não é um arquivo ar.')
  })

  it('should refuse a package without its data', () => {
    expect(() => ipkFiles(arArchive([['debian-binary', Buffer.from('2.0\n')]]))).toThrow(
      'O .ipk não tem data.tar.gz.',
    )
  })
})

describe('appFiles', () => {
  it('should keep the files of the app, by their path from its folder', () => {
    const files = ipkFiles(
      ipk([
        { path: `usr/palm/applications/${APP_ID}/assets/app.js` },
        { path: 'usr/palm/applications/com.other.app/index.html' },
        { path: 'usr/palm/packages/com.mathmed.mirante/packageinfo.json' },
      ]),
    )

    expect(paths(appFiles(files, APP_ID))).toStrictEqual(['assets/app.js'])
  })
})
