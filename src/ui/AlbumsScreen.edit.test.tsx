import { fireEvent, screen, waitFor } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { dialog, nameField, noticeOf, openAlbums, showEditing } from '../../test/editing.ts'
import { FULL_GRANT, NO_GRANT, stubEditor } from '../../test/editor-stub.ts'
import { FAMILY, focused, focusedOn, title, TRIP } from '../../test/gallery.ts'
import { RemoteKey } from '../core/remote-key.ts'
import { EDIT_MESSAGES } from './edit-messages.ts'

const { Up, Down, Left, Right, Enter, Back } = RemoteKey
const TODAY_NAME = '7 de novembro de 2026'

function albumNames(): readonly string[] {
  return [...document.querySelectorAll('.grid-albums .tile-title')].map((name) => name.textContent)
}

describe('the albums, when they can change', () => {
  it('should offer a new album first', async () => {
    const sut = showEditing()
    await openAlbums(sut)

    expect(albumNames()).toStrictEqual([
      EDIT_MESSAGES.newAlbum,
      TRIP.name,
      FAMILY.name,
      'Sem fotos',
    ])
  })

  it('should offer no new album when the installation reads only', async () => {
    const sut = showEditing({ grant: NO_GRANT })

    await openAlbums(sut, TRIP.name)

    expect(albumNames()).toStrictEqual([TRIP.name, FAMILY.name, 'Sem fotos'])
  })

  it('should create an album named after the day in one press, and focus it', async () => {
    const sut = showEditing()
    await openAlbums(sut)

    sut.remote.press(Enter)
    expect(screen.getByRole('dialog', { name: EDIT_MESSAGES.newAlbumTitle })).toBeTruthy()
    expect(nameField().value).toBe(TODAY_NAME)
    expect(focused()).toBe(EDIT_MESSAGES.create)
    sut.remote.press(Enter)

    expect(dialog()).toBeNull()
    expect(albumNames()[1]).toBe(TODAY_NAME)
    await focusedOn(TODAY_NAME)
    await noticeOf(`Álbum “${TODAY_NAME}” criado`)
    expect(sut.calls).toStrictEqual([`createAlbum ["${TODAY_NAME}",[]]`])
  })

  it('should create an album with the name typed, without the blanks around it', async () => {
    const sut = showEditing()
    await openAlbums(sut)
    sut.remote.press(Enter, Up)
    expect(document.activeElement).toBe(nameField())

    fireEvent.input(nameField(), { target: { value: '  Natal  ' } })
    sut.remote.press(Enter)

    await waitFor(() => {
      expect(sut.calls).toStrictEqual(['createAlbum ["Natal",[]]'])
    })
  })

  it('should refuse a name of blanks, and say so', async () => {
    const sut = showEditing()
    await openAlbums(sut)
    sut.remote.press(Enter, Up)
    fireEvent.input(nameField(), { target: { value: '   ' } })

    sut.remote.press(Down, Enter)

    expect(screen.getByText(EDIT_MESSAGES.nameRequired)).toBeTruthy()
    expect(dialog()).not.toBeNull()
    expect(sut.calls).toStrictEqual([])
  })

  it('should go from the field to the buttons with Down or Back, and cancel', async () => {
    const sut = showEditing()
    await openAlbums(sut)
    sut.remote.press(Enter, Up, Back)
    expect(focused()).toBe(EDIT_MESSAGES.create)
    sut.remote.press(Up, Down, Right)
    expect(focused()).toBe(EDIT_MESSAGES.cancel)
    sut.remote.press(Left, Up, Right, Down, Right, Enter)

    expect(dialog()).toBeNull()
    await focusedOn(EDIT_MESSAGES.newAlbum)
    sut.remote.press(Enter, Back)
    expect(dialog()).toBeNull()
    expect(sut.calls).toStrictEqual([])
  })

  it('should say an album being created cannot open yet', async () => {
    const sut = showEditing({
      editor: stubEditor({
        readGrant: async () => Promise.resolve(FULL_GRANT),
        createAlbum: async () => new Promise(() => undefined),
      }),
    })
    await openAlbums(sut)
    sut.remote.press(Enter, Enter)
    await focusedOn(TODAY_NAME)

    sut.remote.press(Enter)

    await noticeOf(EDIT_MESSAGES.albumNotReady)
    await title('Álbuns')
  })

  it('should take back an album Immich did not create, and say so', async () => {
    const sut = showEditing({
      editor: stubEditor({ readGrant: async () => Promise.resolve(FULL_GRANT) }),
    })
    await openAlbums(sut)

    sut.remote.press(Enter, Enter)

    await noticeOf(`Não foi possível criar o álbum “${TODAY_NAME}”. Nada mudou: algo deu errado.`)
    expect(albumNames()).not.toContain(TODAY_NAME)
    expect(sut.reported).toHaveLength(1)
  })
})
