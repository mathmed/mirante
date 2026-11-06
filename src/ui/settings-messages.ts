import { BookDensity } from '../core/book-pagination.ts'
import {
  PlaybackOrder,
  type PresentationSettings,
  type Setting,
  SettingName,
  Transition,
  ZoomIntensity,
} from '../core/presentation-settings.ts'
import { RESTORE_ROW, type SettingsRow } from '../core/settings-form.ts'
import { MESSAGES, textOf } from './messages.ts'

// What the settings screen says, in Brazilian Portuguese: the name of each setting, its values, and
// what each value does. A companion of messages.ts.

const SETTING_LABELS: ReadonlyMap<SettingName, string> = new Map([
  [SettingName.Interval, 'Tempo de cada foto'],
  [SettingName.Order, 'Ordem'],
  [SettingName.Transition, 'Transição'],
  [SettingName.Zoom, 'Intensidade do zoom'],
  [SettingName.ShowDate, 'Mostrar a data'],
  [SettingName.ShowCaption, 'Mostrar a legenda'],
  [SettingName.ShowCounter, 'Mostrar o contador'],
  [SettingName.Loop, 'Repetir em laço'],
  [SettingName.HideInterface, 'Esconder a interface após'],
  [SettingName.ReduceEffects, 'Reduzir efeitos'],
  [SettingName.BookDensity, 'Densidade do livro'],
  [SettingName.ShowBookCover, 'Mostrar a capa do livro'],
  [SettingName.ShowPageNumbers, 'Mostrar os números das páginas'],
  [SettingName.BookSpread, 'Tempo de cada página dupla'],
])

const OPTION_TEXTS: ReadonlyMap<string, string> = new Map([
  [PlaybackOrder.OldestFirst, 'Data crescente'],
  [PlaybackOrder.NewestFirst, 'Data decrescente'],
  [PlaybackOrder.Random, 'Aleatória'],
  [Transition.Cut, 'Corte'],
  [Transition.Fade, 'Esmaecer'],
  [Transition.Slide, 'Deslizar'],
  [Transition.KenBurns, 'Zoom lento'],
  [ZoomIntensity.Gentle, 'Suave'],
  // The normal zoom and the normal density of a book share the value and its text.
  [ZoomIntensity.Normal, 'Normal'],
  [BookDensity.Light, 'Leve'],
  [BookDensity.Dense, 'Densa'],
])

// What each value does, under the list: "<setting name> <value>" for the choices and switches.
const OPTION_PREVIEWS: ReadonlyMap<string, string> = new Map([
  [`order ${PlaybackOrder.OldestFirst}`, 'As fotos passam da mais antiga para a mais recente.'],
  [`order ${PlaybackOrder.NewestFirst}`, 'As fotos passam da mais recente para a mais antiga.'],
  [
    `order ${PlaybackOrder.Random}`,
    'Em ordem aleatória, sem repetir uma foto antes de mostrar todas.',
  ],
  [`transition ${Transition.Cut}`, 'A foto seguinte entra de uma vez, sem efeito.'],
  [`transition ${Transition.Fade}`, 'Uma foto se dissolve suavemente na seguinte.'],
  [`transition ${Transition.Slide}`, 'A foto seguinte desliza pela tela e empurra a anterior.'],
  [`transition ${Transition.KenBurns}`, 'Cada foto se aproxima devagar e se dissolve na seguinte.'],
  [`zoom ${ZoomIntensity.Gentle}`, 'O zoom lento aproxima um pouco cada foto.'],
  [`zoom ${ZoomIntensity.Normal}`, 'O zoom lento aproxima mais cada foto.'],
  ['showDate true', 'A data da foto aparece junto com a interface.'],
  ['showDate false', 'A data da foto não aparece.'],
  ['showCaption true', 'A legenda escrita no Immich aparece embaixo da foto.'],
  ['showCaption false', 'As legendas ficam escondidas.'],
  ['showCounter true', 'A posição da foto, como "12 de 87", aparece junto com a interface.'],
  ['showCounter false', 'A posição da foto não aparece.'],
  ['loop true', 'Depois da última foto, a apresentação recomeça.'],
  ['loop false', 'A apresentação para na última foto.'],
  ['reduceEffects true', 'Sem zoom e só esmaecer, para TVs mais lentas.'],
  ['reduceEffects false', 'As transições e o zoom ficam como escolhidos.'],
  [
    `bookDensity ${BookDensity.Light}`,
    'Poucas fotos por página, de uma a três, com muito respiro.',
  ],
  [
    `bookDensity ${BookDensity.Normal}`,
    'De uma a seis fotos por página, alternando páginas de respiro e páginas cheias.',
  ],
  [`bookDensity ${BookDensity.Dense}`, 'Páginas cheias, de três a nove fotos.'],
  ['showBookCover true', 'O livro abre com uma capa: o nome do álbum e o período das fotos.'],
  ['showBookCover false', 'O livro abre direto nas páginas de fotos.'],
  ['showPageNumbers true', 'O número de cada página aparece acima dela.'],
  ['showPageNumbers false', 'As páginas aparecem sem número.'],
])

// What a number of seconds does, by the setting.
const SECONDS_PREVIEWS: ReadonlyMap<SettingName, (seconds: string) => string> = new Map([
  [SettingName.Interval, (seconds: string) => `Cada foto fica ${seconds} segundos na tela.`],
  [
    SettingName.HideInterface,
    (seconds: string) =>
      `A data, o contador e as dicas somem ${seconds} segundos depois de cada troca.`,
  ],
  [
    SettingName.BookSpread,
    (seconds: string) =>
      `Ao reproduzir um livro, cada página dupla fica ${seconds} segundos na tela.`,
  ],
])

// Notes on settings that only matter with another one.
const PREVIEW_NOTES: ReadonlyMap<SettingName, string> = new Map([
  [SettingName.Order, 'A biblioteca inteira é sempre aleatória.'],
  [SettingName.Zoom, 'Vale para a transição Zoom lento.'],
  [SettingName.BookDensity, 'A quantidade varia com as fotos de cada página.'],
])

export function settingLabel(row: SettingsRow): string {
  return row.kind === RESTORE_ROW.kind ? MESSAGES.restoreDefaults : textOf(SETTING_LABELS, row.name)
}

// "8 s", "Aleatória", "Sim": the value of the setting.
export function settingValueText(setting: Setting, settings: PresentationSettings): string {
  const value = setting.valueOf(settings)
  if (typeof value === 'number') {
    return `${String(value)} s`
  }
  if (typeof value === 'boolean') {
    return value ? 'Sim' : 'Não'
  }
  return textOf(OPTION_TEXTS, value)
}

// What the value of the row does, in a sentence or two.
export function settingPreview(row: SettingsRow, settings: PresentationSettings): string {
  if (row.kind === RESTORE_ROW.kind) {
    return 'OK volta todos os ajustes aos valores padrão.'
  }
  const value = row.valueOf(settings)
  const text =
    typeof value === 'number' ? secondsPreview(row.name, value) : optionPreview(row.name, value)
  const note = PREVIEW_NOTES.get(row.name)
  return note === undefined ? text : `${text} ${note}`
}

function secondsPreview(name: SettingName, seconds: number): string {
  return textOf(SECONDS_PREVIEWS, name)(String(seconds))
}

function optionPreview(name: SettingName, value: boolean | string): string {
  return textOf(OPTION_PREVIEWS, `${name} ${String(value)}`)
}
