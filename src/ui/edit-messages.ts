import { type NameSuggestion, SuggestionKind } from '../core/album-name.ts'
import { EditAction } from '../core/edit-actions.ts'
import { AccessBlock } from '../core/library-editor.ts'
import { type Change, ChangeKind } from '../core/library-edits.ts'
import { LoadFailure } from '../core/loading.ts'
import { monthName, type PanelText, photoCountText, photoDateText, textOf } from './messages.ts'

// What the changes to the library say, in Brazilian Portuguese: the actions, why some are off, the
// confirmations and what happened. A companion of messages.ts.

export const EDIT_MESSAGES = {
  newAlbum: 'Novo álbum',
  loadingAlbums: 'Buscando os álbuns…',
  albumsFailed: 'Não foi possível buscar os álbuns: dá para criar um novo.',
  newAlbumTitle: 'Nome do novo álbum',
  renameTitle: 'Novo nome do álbum',
  nameLabel: 'Nome do álbum',
  create: 'Criar',
  save: 'Salvar',
  cancel: 'Cancelar',
  nameKeys: '↑ escreve outro nome · OK confirma · Voltar cancela',
  nameRequired: 'Escreva um nome para o álbum.',
  pickKeys: '↑ ↓ escolhem · OK adiciona · Voltar cancela',
  confirmKeys: '← → escolhem · OK confirma · Voltar cancela',
  menuTitle: 'Ações',
  marked: 'Marcada',
  menuKeys: '↑ ↓ escolhem · OK confirma · Voltar fecha',
  selectFirst: 'Marque as fotos com OK antes de escolher o que fazer com elas.',
  albumNotReady: 'O álbum ainda está sendo criado. Tente de novo em um instante.',
} as const satisfies Readonly<Record<string, string>>

const ACTIONS: ReadonlyMap<EditAction, string> = new Map([
  [EditAction.Undo, 'Desfazer'],
  [EditAction.Select, 'Selecionar'],
  [EditAction.AddToAlbum, 'Adicionar ao álbum'],
  [EditAction.RemoveFromAlbum, 'Tirar do álbum'],
  [EditAction.Trash, 'Apagar'],
  [EditAction.EndSelection, 'Concluir'],
  [EditAction.RenameAlbum, 'Renomear álbum'],
  [EditAction.DeleteAlbum, 'Apagar álbum'],
])

const BLOCKS: ReadonlyMap<AccessBlock, string> = new Map([
  [AccessBlock.Checking, 'Verificando se este Mirante pode alterar a biblioteca…'],
  [
    AccessBlock.NoKey,
    'Este Mirante só mostra as fotos: o proxy não tem a chave de escrita do Immich.',
  ],
  [
    AccessBlock.MissingPermission,
    'A chave de escrita do Immich não tem todas as permissões: algumas ações ficaram de fora.',
  ],
  [
    AccessBlock.TrashOff,
    'Apagar fotos está desligado: a lixeira do Immich está desativada, e o Mirante nunca apaga uma foto para sempre.',
  ],
  [
    AccessBlock.CheckFailed,
    'Não foi possível saber se este Mirante pode alterar a biblioteca. Abra o app de novo para tentar outra vez.',
  ],
])

// Why a change failed, after "Nada mudou: ".
const FAILURES: ReadonlyMap<LoadFailure, string> = new Map([
  [LoadFailure.Unreachable, 'o Immich não respondeu.'],
  [LoadFailure.KeyRejected, 'o Immich recusou a chave de escrita.'],
  [LoadFailure.KeyMissing, 'o proxy não deixou o pedido passar.'],
  [LoadFailure.NotImmich, 'a resposta não veio do Immich.'],
  [LoadFailure.ServerError, 'o Immich respondeu com um erro.'],
  [LoadFailure.Unexpected, 'algo deu errado.'],
])

export function actionText(action: EditAction): string {
  return textOf(ACTIONS, action)
}

export function blockText(block: AccessBlock): string {
  return textOf(BLOCKS, block)
}

// The name a new album gets unless another is typed: "Março de 2024" for photos of one month, else
// the day: "7 de novembro de 2026".
export function suggestionText(suggestion: NameSuggestion): string {
  return suggestion.kind === SuggestionKind.Month
    ? `${monthName(suggestion.month)} de ${String(suggestion.year)}`
    : photoDateText(suggestion.date)
}

// "3 marcadas · OK marca ou desmarca · Voltar leva às ações".
export function selectingText(count: number): string {
  const marked = count === 1 ? '1 marcada' : `${String(count)} marcadas`
  return `${marked} · OK marca ou desmarca · Voltar leva às ações`
}

// The title of the choice of an album: "Adicionar 3 fotos a…".
export function pickTitle(count: number): string {
  return `Adicionar ${photoCountText(count)} a…`
}

export function trashConfirmation(count: number): PanelText {
  return {
    title: count === 1 ? 'Apagar esta foto?' : `Apagar ${photoCountText(count)}?`,
    hint: `${count === 1 ? 'Ela vai' : 'Elas vão'} para a lixeira do Immich, de onde ${count === 1 ? 'pode' : 'podem'} ser ${count === 1 ? 'restaurada' : 'restauradas'} até o Immich esvaziá-la.`,
  }
}

export function deleteAlbumConfirmation(name: string, photoCount: number): PanelText {
  const photos =
    photoCount === 0
      ? 'Ele não tem fotos.'
      : `As ${photoCountText(photoCount)} dele continuam na biblioteca.`
  return {
    title: `Apagar o álbum “${name}”?`,
    hint: `Só o álbum some, e ele não pode ser recuperado. ${photos}`,
  }
}

type AlbumChange = Extract<
  Change,
  { readonly kind: 'create-album' | 'delete-album' | 'rename-album' }
>

// What happened, once the server took the change.
export function doneText(change: Change): string {
  switch (change.kind) {
    case ChangeKind.Trash:
      return `${photosText(change.photoIds)} para a lixeira do Immich · ↑ Desfazer`
    case ChangeKind.Restore:
      return `${photosText(change.photoIds)} de volta da lixeira`
    case ChangeKind.AddToAlbum:
      return `${photoCountText(change.photoIds.length)} no álbum “${change.album.name}”`
    case ChangeKind.RemoveFromAlbum:
      return `${photoCountText(change.photoIds.length)} fora do álbum “${change.album.name}”`
    default:
      return albumDoneText(change)
  }
}

// What failed, taken back: "Não foi possível apagar 3 fotos. Nada mudou: o Immich não respondeu."
export function failedText(change: Change, failure: LoadFailure): string {
  return `Não foi possível ${attemptText(change)}. Nada mudou: ${textOf(FAILURES, failure)}`
}

function photosText(photoIds: readonly string[]): string {
  return photoIds.length === 1 ? '1 foto foi' : `${photoCountText(photoIds.length)} foram`
}

function albumDoneText(change: AlbumChange): string {
  switch (change.kind) {
    case ChangeKind.CreateAlbum:
      return change.photoIds.length === 0
        ? `Álbum “${change.album.name}” criado`
        : `Álbum “${change.album.name}” criado com ${photoCountText(change.photoIds.length)}`
    case ChangeKind.RenameAlbum:
      return `Álbum renomeado para “${change.name}”`
    default:
      return `Álbum “${change.album.name}” apagado; as fotos continuam na biblioteca`
  }
}

function attemptText(change: Change): string {
  switch (change.kind) {
    case ChangeKind.Trash:
      return `apagar ${photoCountText(change.photoIds.length)}`
    case ChangeKind.Restore:
      return `trazer ${photoCountText(change.photoIds.length)} de volta da lixeira`
    case ChangeKind.AddToAlbum:
      return `pôr ${photoCountText(change.photoIds.length)} no álbum “${change.album.name}”`
    case ChangeKind.RemoveFromAlbum:
      return `tirar ${photoCountText(change.photoIds.length)} do álbum “${change.album.name}”`
    default:
      return albumAttemptText(change)
  }
}

function albumAttemptText(change: AlbumChange): string {
  switch (change.kind) {
    case ChangeKind.CreateAlbum:
      return `criar o álbum “${change.album.name}”`
    case ChangeKind.RenameAlbum:
      return `renomear o álbum “${change.album.name}”`
    default:
      return `apagar o álbum “${change.album.name}”`
  }
}
