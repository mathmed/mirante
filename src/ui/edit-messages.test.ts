import { describe, expect, it } from 'vitest'

import { SuggestionKind } from '../core/album-name.ts'
import { EditAction } from '../core/edit-actions.ts'
import { AccessBlock } from '../core/library-editor.ts'
import { type Change, ChangeKind } from '../core/library-edits.ts'
import { LoadFailure } from '../core/loading.ts'
import { type Album, PhotoOrder } from '../core/photo-library.ts'
import {
  actionText,
  blockText,
  deleteAlbumConfirmation,
  doneText,
  failedText,
  pickTitle,
  selectingText,
  suggestionText,
  trashConfirmation,
} from './edit-messages.ts'

const ALBUM: Album = { id: 'a-1', name: 'Lisboa', photoCount: 3, order: PhotoOrder.NewestFirst }
const ONE = ['p-1']
const TWO = ['p-1', 'p-2']

describe('the texts of the changes', () => {
  it.each(Object.values(EditAction))('should name the action %s', (action) => {
    expect(actionText(action)).not.toBe('')
  })

  it.each(Object.values(AccessBlock))('should explain why changes are off: %s', (block) => {
    expect(blockText(block)).not.toBe('')
  })

  it('should count the photos marked and those added', () => {
    expect(selectingText(1)).toBe('1 marcada · OK marca ou desmarca · Voltar leva às ações')
    expect(selectingText(3)).toBe('3 marcadas · OK marca ou desmarca · Voltar leva às ações')
    expect(pickTitle(1)).toBe('Adicionar 1 foto a…')
    expect(pickTitle(1200)).toBe('Adicionar 1.200 fotos a…')
  })

  it('should suggest the month of the photos, or the day', () => {
    expect(suggestionText({ kind: SuggestionKind.Month, year: 2024, month: 3 })).toBe(
      'Março de 2024',
    )
    expect(
      suggestionText({ kind: SuggestionKind.Day, date: { year: 2026, month: 11, day: 7 } }),
    ).toBe('7 de novembro de 2026')
  })

  it('should say what goes to the trash, and that it can come back', () => {
    expect(trashConfirmation(1)).toStrictEqual({
      title: 'Apagar esta foto?',
      hint: 'Ela vai para a lixeira do Immich, de onde pode ser restaurada até o Immich esvaziá-la.',
    })
    expect(trashConfirmation(2)).toStrictEqual({
      title: 'Apagar 2 fotos?',
      hint: 'Elas vão para a lixeira do Immich, de onde podem ser restauradas até o Immich esvaziá-la.',
    })
  })

  it('should say that deleting an album keeps its photos', () => {
    expect(deleteAlbumConfirmation('Lisboa', 3).hint).toBe(
      'Só o álbum some, e ele não pode ser recuperado. As 3 fotos dele continuam na biblioteca.',
    )
    expect(deleteAlbumConfirmation('Vazio', 0)).toStrictEqual({
      title: 'Apagar o álbum “Vazio”?',
      hint: 'Só o álbum some, e ele não pode ser recuperado. Ele não tem fotos.',
    })
  })

  it.each<[Change, string, string]>([
    [
      { kind: ChangeKind.Trash, photoIds: ONE },
      '1 foto foi para a lixeira do Immich · ↑ Desfazer',
      'apagar 1 foto',
    ],
    [
      { kind: ChangeKind.Restore, photoIds: TWO },
      '2 fotos foram de volta da lixeira',
      'trazer 2 fotos de volta da lixeira',
    ],
    [
      { kind: ChangeKind.AddToAlbum, album: ALBUM, photoIds: TWO },
      '2 fotos no álbum “Lisboa”',
      'pôr 2 fotos no álbum “Lisboa”',
    ],
    [
      { kind: ChangeKind.RemoveFromAlbum, album: ALBUM, photoIds: ONE },
      '1 foto fora do álbum “Lisboa”',
      'tirar 1 foto do álbum “Lisboa”',
    ],
    [
      { kind: ChangeKind.CreateAlbum, album: ALBUM, photoIds: [] },
      'Álbum “Lisboa” criado',
      'criar o álbum “Lisboa”',
    ],
    [
      { kind: ChangeKind.CreateAlbum, album: ALBUM, photoIds: TWO },
      'Álbum “Lisboa” criado com 2 fotos',
      'criar o álbum “Lisboa”',
    ],
    [
      { kind: ChangeKind.RenameAlbum, album: ALBUM, name: 'Porto' },
      'Álbum renomeado para “Porto”',
      'renomear o álbum “Lisboa”',
    ],
    [
      { kind: ChangeKind.DeleteAlbum, album: ALBUM },
      'Álbum “Lisboa” apagado; as fotos continuam na biblioteca',
      'apagar o álbum “Lisboa”',
    ],
  ])('should say what %o did, or failed to do', (change, done, attempt) => {
    expect(doneText(change)).toBe(done)
    expect(failedText(change, LoadFailure.Unreachable)).toBe(
      `Não foi possível ${attempt}. Nada mudou: o Immich não respondeu.`,
    )
  })

  it.each(Object.values(LoadFailure))('should say why a change failed: %s', (failure) => {
    expect(failedText({ kind: ChangeKind.Trash, photoIds: ONE }, failure)).toMatch(
      /^Não foi possível apagar 1 foto\. Nada mudou: .+\.$/u,
    )
  })
})
