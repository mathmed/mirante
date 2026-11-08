import { screen } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import {
  barActions,
  dialog,
  noticeOf,
  openAlbums,
  openTrip,
  photoInFocus,
  showEditing,
} from '../../test/editing.ts'
import { FULL_GRANT, NO_GRANT, stubEditor } from '../../test/editor-stub.ts'
import { focused, focusedOn, title } from '../../test/gallery.ts'
import { EditPermission } from '../core/library-editor.ts'
import { RemoteKey } from '../core/remote-key.ts'
import { EDIT_MESSAGES } from './edit-messages.ts'
import { MESSAGES } from './messages.ts'

const { Up, Down, Left, Right, Enter, Back } = RemoteKey

function menuItems(): readonly (string | null)[] {
  return [...document.querySelectorAll('.overlay .choice')].map((item) => item.textContent)
}

describe('the actions on the photo of the viewer', () => {
  it('should open on Up, over the photo, and close on Back', async () => {
    const sut = showEditing()
    await openTrip(sut)
    sut.remote.press(Enter)
    screen.getByRole('dialog', { name: '1 de 30' })

    sut.remote.press(Up)

    expect(screen.getByRole('dialog', { name: EDIT_MESSAGES.menuTitle })).toBeTruthy()
    expect(menuItems()).toStrictEqual(['Adicionar ao álbum', 'Tirar do álbum', 'Apagar'])
    expect(focused()).toBe('Adicionar ao álbum')
    sut.remote.press(Back)
    expect(screen.queryByRole('dialog', { name: EDIT_MESSAGES.menuTitle })).toBeNull()
    sut.remote.press(Right)
    expect(screen.getByRole('dialog', { name: '2 de 30' })).toBeTruthy()
  })

  it('should delete the photo on the screen and show the next one in its place', async () => {
    const sut = showEditing()
    await openTrip(sut)
    sut.remote.press(Right, Enter)
    screen.getByRole('dialog', { name: '2 de 30' })

    sut.remote.press(Up, Down, Down, Enter)
    expect(screen.getByRole('dialog', { name: 'Apagar esta foto?' })).toBeTruthy()
    sut.remote.press(Right, Enter)

    expect(await screen.findByRole('dialog', { name: '2 de 29' })).toBeTruthy()
    expect(document.querySelector('.slide.is-current img')?.getAttribute('src')).toBe(
      'https://images.test/preview/trip-3',
    )
    expect(sut.calls).toStrictEqual(['trashPhotos [["trip-2"]]'])
    await noticeOf('1 foto foi para a lixeira do Immich · ↑ Desfazer')
    sut.remote.press(Up)
    expect(menuItems()[0]).toBe('Desfazer')
    sut.remote.press(Enter)
    await noticeOf('1 foto foi de volta da lixeira')
    expect(screen.getByRole('dialog', { name: '2 de 30' })).toBeTruthy()
    sut.remote.press(Right, Back)
    await photoInFocus('trip-3')
  })

  it('should add the photo on the screen to an album, from the menu', async () => {
    const sut = showEditing()
    await openTrip(sut)
    sut.remote.press(Enter, Up, Enter)

    await screen.findByText('Família')
    sut.remote.press(Down, Enter)

    await noticeOf('1 foto no álbum “Família”')
    expect(sut.calls).toStrictEqual(['addToAlbum ["family",["trip-1"]]'])
    expect(screen.getByRole('dialog', { name: '1 de 30' })).toBeTruthy()
  })

  it('should take the photo on the screen out of the album, the next one in its place', async () => {
    const sut = showEditing()
    await openTrip(sut)
    sut.remote.press(Enter, Up, Down, Enter)

    expect(await screen.findByRole('dialog', { name: '1 de 29' })).toBeTruthy()
    expect(sut.calls).toStrictEqual(['removeFromAlbum ["trip",["trip-1"]]'])
  })

  it('should close when its last photo is gone, the album then empty', async () => {
    const sut = showEditing()
    await openAlbums(sut)
    sut.remote.press(Right, Right, Enter)
    await title('Família')
    await photoInFocus('family-3')
    sut.remote.press(Enter)

    sut.remote.press(Up, Down, Enter)
    await screen.findByRole('dialog', { name: '1 de 2' })
    sut.remote.press(Up, Down, Enter)
    await screen.findByRole('dialog', { name: '1 de 1' })
    sut.remote.press(Up, Down, Enter)

    expect(await screen.findByText(MESSAGES.emptyAlbum.title)).toBeTruthy()
    await focusedOn('Renomear álbum')
    expect(sut.calls).toHaveLength(3)
  })

  it('should say why nothing can change when the installation reads only', async () => {
    const sut = showEditing({ grant: NO_GRANT })
    await openAlbums(sut, 'Viagem a Lisboa')
    sut.remote.press(Enter)
    await photoInFocus('trip-1')

    expect(barActions()).toStrictEqual([])
    sut.remote.press(Up)
    await noticeOf('Este Mirante só mostra as fotos: o proxy não tem a chave de escrita do Immich.')
    sut.remote.press(Enter, Up)
    expect(dialog()).toBeNull()
    expect(screen.getByRole('dialog', { name: '1 de 30' })).toBeTruthy()
  })
})

describe('the actions on photos, by what the key allows', () => {
  it('should leave the trash out, and say why, when Immich keeps none', async () => {
    const sut = showEditing({ grant: { ...FULL_GRANT, isTrashKept: false } })
    await openTrip(sut)

    expect(
      screen.getByText(
        'Apagar fotos está desligado: a lixeira do Immich está desativada, e o Mirante nunca apaga uma foto para sempre.',
      ),
    ).toBeTruthy()
    sut.remote.press(Up, Enter, Back)
    expect(barActions()).toStrictEqual(['Adicionar ao álbum', 'Tirar do álbum', 'Concluir'])
  })

  it('should offer the trash alone to a key that can only delete', async () => {
    const sut = showEditing({
      grant: { permissions: new Set([EditPermission.Trash]), isTrashKept: true },
    })
    await openAlbums(sut, 'Viagem a Lisboa')
    sut.remote.press(Enter)
    await photoInFocus('trip-1')

    expect(barActions()).toStrictEqual(['Selecionar'])
    sut.remote.press(Enter, Up)
    expect(menuItems()).toStrictEqual(['Apagar'])
  })

  it('should say when it could not tell what can change', async () => {
    const sut = showEditing({ editor: stubEditor({}) })
    await openAlbums(sut, 'Viagem a Lisboa')
    sut.remote.press(Enter)
    await photoInFocus('trip-1')

    sut.remote.press(Up)

    await noticeOf(
      'Não foi possível saber se este Mirante pode alterar a biblioteca. Abra o app de novo para tentar outra vez.',
    )
    expect(sut.reported).toHaveLength(1)
  })
})

describe('the actions on the photos of a month', () => {
  it('should offer the selection alone, and no removal from an album', async () => {
    const sut = showEditing()
    await focusedOn('Todas')
    sut.remote.press(Right, Right, Enter)
    await focusedOn('2024')
    sut.remote.press(Enter)
    await focusedOn('Março')
    sut.remote.press(Enter)
    await photoInFocus('march-1')

    expect(barActions()).toStrictEqual(['Selecionar'])
    sut.remote.press(Up, Enter, Enter, Back)
    expect(barActions()).toStrictEqual(['Adicionar ao álbum', 'Apagar', 'Concluir'])
    sut.remote.press(Right, Enter, Right, Enter)
    await noticeOf('1 foto foi para a lixeira do Immich · ↑ Desfazer')
    expect(sut.calls).toStrictEqual(['trashPhotos [["march-1"]]'])
    sut.remote.press(Left)
  })
})

describe('an empty album that can change', () => {
  it('should keep its actions, in focus, and leave on Back', async () => {
    const sut = showEditing()
    await openAlbums(sut)
    sut.remote.press(Right, Right, Right, Enter)
    await title('Sem fotos')

    await focusedOn('Renomear álbum')
    expect(barActions()).toStrictEqual(['Renomear álbum', 'Apagar álbum'])
    expect(screen.getByText(MESSAGES.emptyAlbum.title)).toBeTruthy()
    sut.remote.press(Down, Back)

    await title(MESSAGES.albums)
  })
})
