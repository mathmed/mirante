import { screen } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { noticeOf, openTrip, showEditing } from '../../test/editing.ts'
import { DATA, focused } from '../../test/gallery.ts'
import { memoryLibrary } from '../../test/library-stub.ts'
import { type Album, PhotoOrder } from '../core/photo-library.ts'
import { RemoteKey } from '../core/remote-key.ts'
import { EDIT_MESSAGES } from './edit-messages.ts'

const { Up, Down, Left, Right, Enter, Back } = RemoteKey
const MANY = 20
const VISIBLE = 7

function items(): readonly (string | null)[] {
  return [...document.querySelectorAll('.overlay .choice-text')].map((item) => item.textContent)
}

function albums(count: number): readonly Album[] {
  return [...Array(count).keys()].map((index) => ({
    id: `album-${String(index + 1)}`,
    name: `Álbum ${String(index + 1)}`,
    photoCount: 1,
    order: PhotoOrder.NewestFirst,
    lastPhotoAtMs: Date.UTC(2020, 0, 1) - index,
  }))
}

describe('the choice of an album', () => {
  it('should show a window of a long list around the album in focus', async () => {
    const library = memoryLibrary({ ...DATA, albums: [...DATA.albums, ...albums(MANY)] })
    const sut = showEditing({ library })
    await openTrip(sut)
    sut.remote.press(Up, Enter, Enter, Back, Enter)
    await screen.findByText('Família')

    expect(items()).toHaveLength(VISIBLE)
    sut.remote.press(...Array<RemoteKey>(12).fill(Down))

    expect(focused()).toContain('Álbum 11')
    expect(items()).toStrictEqual([
      'Álbum 8',
      'Álbum 9',
      'Álbum 10',
      'Álbum 11',
      'Álbum 12',
      'Álbum 13',
      'Álbum 14',
    ])
    sut.remote.press(Left, Right, Enter)
    await noticeOf('1 foto no álbum “Álbum 11”')
  })

  it('should still create a new album when the albums cannot be read', async () => {
    const server = { isDown: false }
    const library = {
      ...memoryLibrary(DATA),
      listAlbums: async (): Promise<readonly Album[]> =>
        server.isDown ? Promise.reject(new Error('down')) : Promise.resolve(DATA.albums),
    }
    const sut = showEditing({ library })
    await openTrip(sut)
    server.isDown = true
    sut.remote.press(Up, Enter, Enter, Back, Enter)

    expect(await screen.findByText(EDIT_MESSAGES.albumsFailed)).toBeTruthy()
    expect(items()).toStrictEqual([EDIT_MESSAGES.newAlbum])
    expect(sut.reported).toHaveLength(1)
    sut.remote.press(Enter)
    expect(screen.getByRole('dialog', { name: EDIT_MESSAGES.newAlbumTitle })).toBeTruthy()
  })

  it('should say the albums load meanwhile', async () => {
    const server = { isDown: false }
    const library = {
      ...memoryLibrary(DATA),
      listAlbums: async (): Promise<readonly Album[]> =>
        server.isDown ? new Promise(() => undefined) : Promise.resolve(DATA.albums),
    }
    const sut = showEditing({ library })
    await openTrip(sut)
    server.isDown = true
    sut.remote.press(Up, Enter, Enter, Back, Enter)

    expect(screen.getByText(EDIT_MESSAGES.loadingAlbums)).toBeTruthy()
    sut.remote.press(Back)
    expect(document.querySelector('.overlay')).toBeNull()
  })
})

describe('the menu of the viewer, and a confirmation', () => {
  it('should keep the focus on their sides', async () => {
    const sut = showEditing()
    await openTrip(sut)
    sut.remote.press(Enter, Up, Left, Right)
    expect(focused()).toBe('Adicionar ao álbum')

    sut.remote.press(Down, Down, Enter, Up, Down)

    expect(focused()).toBe(EDIT_MESSAGES.cancel)
  })
})
