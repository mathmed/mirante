import { fireEvent, screen, waitFor } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import {
  barActions,
  dialog,
  gridPhotos,
  nameField,
  noticeOf,
  openTrip,
  photoInFocus,
  showEditing,
} from '../../test/editing.ts'
import { stubEditor } from '../../test/editor-stub.ts'
import { FULL_GRANT } from '../../test/editor-stub.ts'
import { FAMILY, focused, focusedOn, title, TRIP } from '../../test/gallery.ts'
import { RemoteKey } from '../core/remote-key.ts'
import { EDIT_MESSAGES } from './edit-messages.ts'
import { MESSAGES } from './messages.ts'

const { Up, Down, Left, Right, Enter, Back } = RemoteKey

// Selecting from the bar, then marking the first photos of the trip.
function markFirst(sut: ReturnType<typeof showEditing>, count: number): void {
  sut.remote.press(Up, Enter)
  for (let index = 0; index < count; index += 1) {
    sut.remote.press(Enter, Right)
  }
}

describe('the bar above the photos of an album', () => {
  it('should offer to select, rename and delete the album, reached by Up from the first row', async () => {
    const sut = showEditing()
    await openTrip(sut)

    expect(barActions()).toStrictEqual(['Selecionar', 'Renomear álbum', 'Apagar álbum'])
    sut.remote.press(Up)
    expect(focused()).toBe('Selecionar')
    sut.remote.press(Right, Right, Right)
    expect(focused()).toBe('Apagar álbum')
    sut.remote.press(Down)
    await photoInFocus('trip-1')
    sut.remote.press(Up, Back)
    await photoInFocus('trip-1')
  })

  it('should mark photos with Enter while it selects, and say how many', async () => {
    const sut = showEditing()
    await openTrip(sut)

    markFirst(sut, 2)
    sut.remote.press(Right, Enter, Enter)

    expect(document.querySelectorAll('.tile-mark')).toHaveLength(2)
    expect(screen.getByText(/^2 marcadas/)).toBeTruthy()
    expect(barActions()).toStrictEqual([
      'Adicionar ao álbum',
      'Tirar do álbum',
      'Apagar',
      'Concluir',
    ])
  })

  it('should leave the book alone while it selects', async () => {
    const sut = showEditing()
    await openTrip(sut)
    sut.remote.press(Up, Enter, Left)
    await focusedOn(MESSAGES.seeAsBook)

    sut.remote.press(Enter)

    await focusedOn(MESSAGES.seeAsBook)
    expect(screen.getByText(/^0 marcadas/)).toBeTruthy()
  })

  it('should go to the actions on Back while it selects, and end the selection on Concluir', async () => {
    const sut = showEditing()
    await openTrip(sut)
    markFirst(sut, 1)

    sut.remote.press(Back)
    expect(focused()).toBe('Adicionar ao álbum')
    sut.remote.press(Right, Right, Right, Enter)

    expect(document.querySelectorAll('.tile-mark')).toHaveLength(0)
    expect(barActions()).toStrictEqual(['Selecionar', 'Renomear álbum', 'Apagar álbum'])
    await photoInFocus('trip-2')
  })

  it('should ask for marks before acting on none', async () => {
    const sut = showEditing()
    await openTrip(sut)
    sut.remote.press(Up, Enter, Back, Right, Right, Enter)

    await noticeOf(EDIT_MESSAGES.selectFirst)
    expect(dialog()).toBeNull()
  })

  it('should send the photos marked to the trash after a confirmation, and bring them back', async () => {
    const sut = showEditing()
    await openTrip(sut)
    markFirst(sut, 2)
    sut.remote.press(Back, Right, Right, Enter)

    expect(screen.getByRole('dialog', { name: 'Apagar 2 fotos?' })).toBeTruthy()
    expect(focused()).toBe(EDIT_MESSAGES.cancel)
    sut.remote.press(Right, Enter)

    expect(gridPhotos().slice(0, 2)).toStrictEqual(['trip-3', 'trip-4'])
    await noticeOf('2 fotos foram para a lixeira do Immich · ↑ Desfazer')
    expect(sut.calls).toStrictEqual(['trashPhotos [["trip-1","trip-2"]]'])
    expect(barActions()[0]).toBe('Desfazer')
    sut.remote.press(Up)
    sut.remote.pressAtOnce(Enter, Enter)

    await noticeOf('2 fotos foram de volta da lixeira')
    expect(gridPhotos().slice(0, 2)).toStrictEqual(['trip-1', 'trip-2'])
    expect(sut.calls[1]).toBe('restorePhotos [["trip-1","trip-2"]]')
    expect(sut.calls).toHaveLength(2)
    expect(barActions()[0]).toBe('Selecionar')
  })

  it('should change nothing when the deletion is cancelled', async () => {
    const sut = showEditing()
    await openTrip(sut)
    markFirst(sut, 1)
    sut.remote.press(Back, Right, Right, Enter, Enter)

    expect(dialog()).toBeNull()
    expect(document.querySelectorAll('.tile-mark')).toHaveLength(1)
    sut.remote.press(Back, Right, Right, Enter, Back)
    expect(dialog()).toBeNull()
    expect(sut.calls).toStrictEqual([])
  })

  it('should put the photos back, and say why, when Immich refuses to delete them', async () => {
    const sut = showEditing({
      editor: stubEditor({ readGrant: async () => Promise.resolve(FULL_GRANT) }),
    })
    await openTrip(sut)
    markFirst(sut, 1)
    sut.remote.press(Back, Right, Right, Enter, Right, Enter)

    await noticeOf('Não foi possível apagar 1 foto. Nada mudou: algo deu errado.')
    expect(gridPhotos()[0]).toBe('trip-1')
    expect(sut.reported).toHaveLength(1)
  })

  it('should add the photos marked to another album, chosen in a list', async () => {
    const sut = showEditing()
    await openTrip(sut)
    markFirst(sut, 1)
    sut.remote.press(Back, Enter)

    expect(screen.getByRole('dialog', { name: 'Adicionar 1 foto a…' })).toBeTruthy()
    await waitFor(() => {
      expect(
        [...document.querySelectorAll('.overlay .choice-text')].map((item) => item.textContent),
      ).toStrictEqual([EDIT_MESSAGES.newAlbum, FAMILY.name, 'Sem fotos'])
    })
    sut.remote.press(Down, Enter)

    await noticeOf('1 foto no álbum “Família”')
    expect(sut.calls).toStrictEqual(['addToAlbum ["family",["trip-1"]]'])
    expect(document.querySelectorAll('.tile-mark')).toHaveLength(0)
  })

  it('should add the photos marked to a new album, named after their month', async () => {
    const sut = showEditing()
    await openTrip(sut)
    markFirst(sut, 2)
    sut.remote.press(Back, Enter, Enter)

    expect(nameField().value).toBe('Março de 2024')
    sut.remote.press(Enter)

    await noticeOf('Álbum “Março de 2024” criado com 2 fotos')
    expect(sut.calls).toStrictEqual(['createAlbum ["Março de 2024",["trip-1","trip-2"]]'])
  })

  it('should take the photos marked out of the album at once', async () => {
    const sut = showEditing()
    await openTrip(sut)
    markFirst(sut, 1)
    sut.remote.press(Back, Right, Enter)

    expect(gridPhotos()[0]).toBe('trip-2')
    await noticeOf('1 foto fora do álbum “Viagem a Lisboa”')
    expect(sut.calls).toStrictEqual(['removeFromAlbum ["trip",["trip-1"]]'])
  })

  it('should rename the album, its title at once', async () => {
    const sut = showEditing()
    await openTrip(sut)
    sut.remote.press(Up, Right, Enter)

    expect(screen.getByRole('dialog', { name: EDIT_MESSAGES.renameTitle })).toBeTruthy()
    expect(document.activeElement).toBe(nameField())
    expect(nameField().value).toBe(TRIP.name)
    fireEvent.input(nameField(), { target: { value: 'Lisboa' } })
    sut.remote.press(Enter)

    await title('Lisboa')
    expect(sut.calls).toStrictEqual(['renameAlbum ["trip","Lisboa"]'])
    await noticeOf('Álbum renomeado para “Lisboa”')
  })

  it('should not rename the album to the name it has', async () => {
    const sut = showEditing()
    await openTrip(sut)

    sut.remote.press(Up, Right, Enter, Enter)

    expect(dialog()).toBeNull()
    expect(sut.calls).toStrictEqual([])
  })

  it('should delete the album after a confirmation, its photos kept, and leave it', async () => {
    const sut = showEditing()
    await openTrip(sut)
    sut.remote.press(Up, Right, Right, Enter)

    expect(screen.getByRole('dialog', { name: `Apagar o álbum “${TRIP.name}”?` })).toBeTruthy()
    expect(
      screen.getByText(
        'Só o álbum some, e ele não pode ser recuperado. As 30 fotos dele continuam na biblioteca.',
      ),
    ).toBeTruthy()
    sut.remote.press(Right, Enter)

    await title(MESSAGES.albums)
    expect(screen.queryByText(TRIP.name)).toBeNull()
    expect(sut.calls).toStrictEqual(['deleteAlbum ["trip"]'])
  })
})
