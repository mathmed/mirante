import type { PhotoDate, ServerInfo, TimelineMonth } from '../core/photo-library.ts'
import { MAX_SLIDESHOW_SECONDS, MIN_SLIDESHOW_SECONDS } from '../core/runtime-config.ts'
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
  tagline: 'Suas memórias, vistas do alto',
  connecting: 'Conectando ao Immich…',
  loading: 'Buscando suas fotos…',
  retry: 'Tentar novamente',
  back: 'Voltar',
  albums: 'Álbuns',
  timeline: 'Linha do tempo',
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
  slideshowPlaying: 'Em apresentação · OK pausa',
  slideshowPaused: 'OK inicia a apresentação · as setas trocam a foto',
} as const satisfies Readonly<Record<string, PanelText | string>>

const ELLIPSIS = '…'

const MONTH_NAMES: readonly string[] = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

const FAILURE_TEXTS: ReadonlyMap<string, PanelText> = new Map(Object.entries(FAILURES))

export function failureText(failure: StartupFailure): PanelText {
  const text = FAILURE_TEXTS.get(failure)
  if (text === undefined) {
    throw new RangeError(`No text for the startup failure "${failure}"`)
  }
  return text
}

export function serverText(server: ServerInfo): string {
  return `Immich ${server.version} em ${server.address}`
}

export function photoCountText(count: number): string {
  return count === 1 ? '1 foto' : `${String(count)} fotos`
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

function monthOf(month: number): string {
  const name = MONTH_NAMES[month - 1]
  if (name === undefined) {
    throw new RangeError(`No month ${String(month)}`)
  }
  return name
}
