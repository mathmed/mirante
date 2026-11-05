import { StartupFailure } from '../core/startup.ts'

// Every text people read on the screen, in Brazilian Portuguese. Code, logs and docs stay in English.
export interface FailureText {
  readonly title: string
  readonly hint: string
}

const FAILURES: Readonly<Record<StartupFailure, FailureText>> = {
  [StartupFailure.Missing]: {
    title: 'Configuração não encontrada',
    hint: 'Crie o arquivo config.json ao lado do app, a partir do config.example.json, com o endereço do Immich (immichUrl) e a chave de API (apiKey).',
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
    hint: 'Em immichUrl, use o endereço completo do servidor, como http://192.168.0.10:2283, sem /api no final.',
  },
  [StartupFailure.InvalidApiKey]: {
    title: 'Chave de API ausente',
    hint: 'Preencha apiKey com uma chave de API do Immich com permissão só de leitura.',
  },
  [StartupFailure.Unreachable]: {
    title: 'O Immich não respondeu',
    hint: 'Confira se o servidor está ligado, se a TV alcança o endereço em immichUrl e se o Immich aceita pedidos vindos do endereço do app.',
  },
  [StartupFailure.KeyRejected]: {
    title: 'Chave de API recusada',
    hint: 'O Immich não aceitou a chave em apiKey. Gere uma nova chave no Immich e atualize o config.json.',
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
  connected: 'Conectado',
  server: 'Servidor',
  immichVersion: 'Versão do Immich',
  retry: 'Tentar novamente',
} as const

const FAILURE_TEXTS: ReadonlyMap<string, FailureText> = new Map(Object.entries(FAILURES))

export function failureText(failure: StartupFailure): FailureText {
  const text = FAILURE_TEXTS.get(failure)
  if (text === undefined) {
    throw new RangeError(`No text for the startup failure "${failure}"`)
  }
  return text
}
