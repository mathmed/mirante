import type { LibrarySummary } from '../core/library-summary.ts'
import { Intent, PresentChoice, ScreenKind } from '../core/navigation.ts'
import type { PhotoDate, ServerInfo, TimelineMonth } from '../core/photo-library.ts'
import {
  PlaybackOrder,
  type PresentationSettings,
  type Setting,
  SettingName,
  Transition,
  ZoomIntensity,
} from '../core/presentation-settings.ts'
import { type PresentationSource, SourceKind } from '../core/presentation-source.ts'
import { MAX_SLIDESHOW_SECONDS, MIN_SLIDESHOW_SECONDS } from '../core/runtime-config.ts'
import { RESTORE_ROW, type SettingsRow } from '../core/settings-form.ts'
import { StartupFailure } from '../core/startup.ts'

// Every text people read on the screen, in Brazilian Portuguese. Code, logs and docs stay in English.

// What a panel says when a screen fails or has nothing to show: what happened, and what to do.
export interface PanelText {
  readonly title: string
  readonly hint: string
}

const FAILURES: Readonly<Record<StartupFailure, PanelText>> = {
  [StartupFailure.Missing]: {
    title: 'Configuração não encontrada',
    hint: 'Crie o arquivo config.json ao lado do app, a partir do config.example.json, com o endereço do Immich (immichUrl).',
  },
  [StartupFailure.Unreadable]: {
    title: 'Não foi possível ler a configuração',
    hint: 'O arquivo config.json existe, mas não pôde ser lido. Confira o arquivo e tente novamente.',
  },
  [StartupFailure.Malformed]: {
    title: 'Configuração inválida',
    hint: 'O config.json não é um JSON válido. Compare com o config.example.json.',
  },
  [StartupFailure.InvalidImmichUrl]: {
    title: 'Endereço do Immich inválido',
    hint: 'Em immichUrl, use o endereço completo do servidor, como http://192.168.0.10:2283, ou deixe vazio quando o app está no mesmo endereço do Immich. Não coloque /api no final.',
  },
  [StartupFailure.InvalidApiKey]: {
    title: 'Chave de API inválida',
    hint: 'Em apiKey, coloque o texto de uma chave de API do Immich com permissão só de leitura, ou retire o campo quando o proxy envia a chave.',
  },
  [StartupFailure.InvalidSlideshowSeconds]: {
    title: 'Intervalo da apresentação inválido',
    hint: `Em slideshowSeconds, use um número de segundos entre ${String(MIN_SLIDESHOW_SECONDS)} e ${String(MAX_SLIDESHOW_SECONDS)}, ou retire o campo para usar o padrão.`,
  },
  [StartupFailure.InvalidPresentation]: {
    title: 'Ajustes da apresentação inválidos',
    hint: 'No bloco presentation do config.json, confira os nomes e os valores (intervalSeconds de 3 a 60, hideInterfaceSeconds de 3 a 20, order "oldest-first", "newest-first" ou "random"), ou retire o bloco para usar os padrões.',
  },
  [StartupFailure.Unreachable]: {
    title: 'O Immich não respondeu',
    hint: 'Confira se o servidor está ligado, se a TV alcança o endereço em immichUrl e se o Immich aceita pedidos vindos do endereço do app.',
  },
  [StartupFailure.KeyRejected]: {
    title: 'Chave de API recusada',
    hint: 'O Immich não aceitou a chave, ou ela não tem permissão de leitura. Gere uma nova chave no Immich e atualize a configuração.',
  },
  [StartupFailure.KeyMissing]: {
    title: 'O Immich pediu uma chave de API',
    hint: 'Nenhuma chave chegou ao Immich. Configure o proxy para enviar a chave ou preencha apiKey no config.json.',
  },
  [StartupFailure.NotImmich]: {
    title: 'Isto não parece um servidor Immich',
    hint: 'Confira o endereço em immichUrl: ele deve abrir a página do Immich.',
  },
  [StartupFailure.ServerError]: {
    title: 'O Immich respondeu com um erro',
    hint: 'Aguarde um pouco e tente novamente.',
  },
  [StartupFailure.Unexpected]: {
    title: 'Algo deu errado',
    hint: 'Tente novamente. Se o problema continuar, reinicie o app.',
  },
}

export const MESSAGES = {
  appName: 'Mirante',
  connecting: 'Conectando ao Immich…',
  loading: 'Buscando suas fotos…',
  retry: 'Tentar novamente',
  back: 'Voltar',
  allPhotosTitle: 'Todas as fotos',
  allPhotosKeys: 'OK abre a foto · Info: Apresentar a partir daqui',
  morePhotosFailed: 'Não foi possível buscar mais fotos · mova o foco para tentar de novo',
  albums: 'Álbuns',
  timeline: 'Linha do tempo',
  present: 'Apresentar',
  settings: 'Ajustes',
  presentAlbum: 'Apresentar um álbum',
  presentYear: 'Apresentar um ano',
  presentMonth: 'Apresentar um mês',
  wholeLibrary: 'Toda a biblioteca',
  settingsKeys: '↑ ↓ escolhem · ← → mudam · OK alterna · Voltar salva',
  restoreDefaults: 'Restaurar padrões',
  emptyPresentation: {
    title: 'Nada para apresentar',
    hint: 'Não há fotos aqui. Volte e escolha outra coisa para apresentar.',
  },
  noAlbums: {
    title: 'Nenhum álbum por aqui ainda',
    hint: 'Os álbuns que você criar no Immich aparecem nesta tela.',
  },
  emptyAlbum: {
    title: 'Este álbum ainda não tem fotos',
    hint: 'Quando houver fotos nele, no Immich, elas aparecem aqui.',
  },
  emptyTimeline: {
    title: 'A linha do tempo ainda está vazia',
    hint: 'As fotos enviadas ao Immich aparecem aqui, por ano e por mês.',
  },
  emptyMonth: {
    title: 'Nenhuma foto neste mês',
    hint: 'Volte e escolha outro mês da linha do tempo.',
  },
  photoUnavailable: 'Foto indisponível',
  previewUnavailable: 'Não foi possível carregar esta foto',
  slideshowPlaying: 'Em apresentação · OK pausa · ↓ ajustes',
  slideshowPaused: 'OK inicia a apresentação · as setas trocam a foto · ↓ ajustes',
} as const satisfies Readonly<Record<string, PanelText | string>>

const ELLIPSIS = '…'
const THOUSAND = 1000

// The cards of the choices of a presentation: what they present, and how.
const CHOICES: ReadonlyMap<PresentChoice, PanelText> = new Map([
  [PresentChoice.Library, { title: 'Toda a biblioteca', hint: 'Aleatória, 200 fotos por vez' }],
  [PresentChoice.Album, { title: 'Um álbum', hint: 'Escolha o álbum' }],
  [PresentChoice.Year, { title: 'Um ano', hint: 'Escolha o ano' }],
  [PresentChoice.Month, { title: 'Um mês', hint: 'Escolha o ano e o mês' }],
])

const HOME_TITLES: ReadonlyMap<ScreenKind, string> = new Map([
  [ScreenKind.AllPhotos, 'Todas'],
  [ScreenKind.Albums, MESSAGES.albums],
  [ScreenKind.Years, MESSAGES.timeline],
  [ScreenKind.Present, MESSAGES.present],
  [ScreenKind.Settings, MESSAGES.settings],
])

const TIMELINE_TITLES: ReadonlyMap<Intent, string> = new Map([
  [Intent.PresentYear, MESSAGES.presentYear],
  [Intent.PresentMonth, MESSAGES.presentMonth],
])

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
  [ZoomIntensity.Normal, 'Normal'],
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
])

// Notes on settings that only matter with another one.
const PREVIEW_NOTES: ReadonlyMap<SettingName, string> = new Map([
  [SettingName.Order, 'A biblioteca inteira é sempre aleatória.'],
  [SettingName.Zoom, 'Vale para a transição Zoom lento.'],
])

const MONTHS =
  'janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro'
const MONTH_NAMES: readonly string[] = MONTHS.split(' ')

const FAILURE_TEXTS: ReadonlyMap<string, PanelText> = new Map(Object.entries(FAILURES))

export function failureText(failure: StartupFailure): PanelText {
  return textOf(FAILURE_TEXTS, failure)
}

export function choiceText(choice: PresentChoice): PanelText {
  return textOf(CHOICES, choice)
}

// The title of a card of the start screen, by the screen it opens.
export function homeTitle(kind: ScreenKind): string {
  return textOf(HOME_TITLES, kind)
}

export function albumsTitle(intent: Intent): string {
  return intent === Intent.PresentAlbum ? MESSAGES.presentAlbum : MESSAGES.albums
}

export function yearsTitle(intent: Intent): string {
  return TIMELINE_TITLES.get(intent) ?? MESSAGES.timeline
}

// What a presentation shows, on its screen while the photos load.
export function sourceTitle(source: PresentationSource): string {
  switch (source.kind) {
    case SourceKind.Album:
      return source.album.name
    case SourceKind.Month:
      return monthTitle(source.month)
    case SourceKind.Year:
      return String(source.year.year)
    default:
      return MESSAGES.wholeLibrary
  }
}

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

export function serverText(server: ServerInfo): string {
  return `Immich ${server.version} em ${server.address}`
}

// "1 foto", "12.340 fotos".
export function photoCountText(count: number): string {
  return count === 1 ? '1 foto' : `${digitsText(count)} fotos`
}

// The line under the logo: "12.340 fotos · de 2019 a 2026", or "de 2026" for a single year.
export function summaryText({ photoCount, firstYear, lastYear }: LibrarySummary): string {
  const to = firstYear === lastYear ? '' : ` a ${String(lastYear)}`
  return `${photoCountText(photoCount)} · de ${String(firstYear)}${to}`
}

export function monthCountText(count: number): string {
  return count === 1 ? '1 mês' : `${String(count)} meses`
}

// "Março": the name of the month on its own.
export function monthName(month: number): string {
  const name = monthOf(month)
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`
}

// "Março de 2024".
export function monthTitle(month: TimelineMonth): string {
  return `${monthName(month.month)} de ${String(month.year)}`
}

// "12 de março de 2024".
export function photoDateText(date: PhotoDate): string {
  return `${String(date.day)} de ${monthOf(date.month)} de ${String(date.year)}`
}

// "12 de 87": the photo on the screen, counted from 1.
export function counterText(index: number, count: number): string {
  return `${String(index + 1)} de ${String(count)}`
}

// Nothing on the screen clips text (Chromium 68 supports overflow only in part): a long name is
// cut to what fits, with an ellipsis.
export function shortText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }
  return `${text.slice(0, maxLength - ELLIPSIS.length)}${ELLIPSIS}`
}

// The thousands apart with a dot, as in Brazil, without the Intl data a TV may lack.
function digitsText(count: number): string {
  const thousands = Math.floor(count / THOUSAND)
  const rest = String(THOUSAND + (count % THOUSAND)).slice(1)
  return thousands === 0 ? String(count) : `${digitsText(thousands)}.${rest}`
}

function secondsPreview(name: SettingName, seconds: number): string {
  return name === SettingName.Interval
    ? `Cada foto fica ${String(seconds)} segundos na tela.`
    : `A data, o contador e as dicas somem ${String(seconds)} segundos depois de cada troca.`
}

function optionPreview(name: SettingName, value: boolean | string): string {
  return textOf(OPTION_PREVIEWS, `${name} ${String(value)}`)
}

function textOf<K, T>(texts: ReadonlyMap<K, T>, key: K): T {
  const text = texts.get(key)
  if (text === undefined) {
    throw new RangeError(`No text for "${String(key)}"`)
  }
  return text
}

function monthOf(month: number): string {
  const name = MONTH_NAMES[month - 1]
  if (name === undefined) {
    throw new RangeError(`No month ${String(month)}`)
  }
  return name
}
