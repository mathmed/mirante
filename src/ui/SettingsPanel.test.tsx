import { render, screen } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { fakeRemote, type FakeRemote } from '../../test/remote.ts'
import {
  DEFAULT_PRESENTATION,
  PlaybackOrder,
  type PresentationSettings,
} from '../core/presentation-settings.ts'
import { RemoteKey } from '../core/remote-key.ts'
import { MESSAGES } from './messages.ts'
import { SettingsPanel } from './SettingsPanel.tsx'

const { Up, Down, Left, Right, Enter, Back } = RemoteKey
const DEFAULTS = { ...DEFAULT_PRESENTATION, intervalSeconds: 10 }

interface Shown {
  readonly remote: FakeRemote
  readonly closed: PresentationSettings[]
}

function show(settings: PresentationSettings = DEFAULT_PRESENTATION): Shown {
  const remote = fakeRemote()
  const closed: PresentationSettings[] = []
  render(
    <SettingsPanel
      settings={settings}
      defaults={DEFAULTS}
      keys={remote.keys}
      onClose={(changed) => closed.push(changed)}
    />,
  )
  return { remote, closed }
}

function rows(): readonly (string | null)[] {
  return screen.getAllByRole('listitem').map((row) => row.textContent)
}

function focused(): string | null | undefined {
  return document.activeElement?.textContent
}

function preview(): string | null | undefined {
  return document.querySelector('.settings-preview')?.textContent
}

describe('SettingsPanel', () => {
  it('should list every setting with its value, and the row that restores the defaults', () => {
    show()

    expect(rows()).toStrictEqual([
      'Tempo de cada foto8 s',
      'OrdemData crescente',
      'TransiçãoEsmaecer',
      'Intensidade do zoomSuave',
      'Mostrar a dataSim',
      'Mostrar a legendaSim',
      'Mostrar o contadorSim',
      'Repetir em laçoSim',
      'Densidade do livroNormal',
      'Formato do livroTela cheia (16:9)',
      'Mostrar a capa do livroSim',
      'Mostrar os números das páginasSim',
      'Tempo de cada página dupla10 s',
      'Esconder a interface após4 s',
      'Reduzir efeitosNão',
      MESSAGES.restoreDefaults,
    ])
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((title) => title.textContent),
    ).toStrictEqual(['Apresentação', 'Livro', 'Geral'])
    expect(screen.getByRole('region', { name: MESSAGES.settings })).toBeTruthy()
    expect(screen.getByText(MESSAGES.settingsKeys)).toBeTruthy()
  })

  it('should start on the first row and say what it does', () => {
    show()

    expect(focused()).toBe('Tempo de cada foto8 s')
    expect(preview()).toBe('Cada foto fica 8 segundos na tela.')
  })

  it('should choose a row with up and down, and change its value with left and right', () => {
    const sut = show()

    sut.remote.press(Right, Down, Right, Right, Down, Up)

    expect(focused()).toBe('OrdemAleatória')
    expect(preview()).toBe(
      'Em ordem aleatória, sem repetir uma foto antes de mostrar todas. A biblioteca inteira é sempre aleatória.',
    )
    expect(rows()[0]).toBe('Tempo de cada foto9 s')
    sut.remote.press(Up, Left, Left)
    expect(focused()).toBe('Tempo de cada foto7 s')
  })

  it('should flip a switch on Enter', () => {
    const sut = show()

    sut.remote.press(Down, Down, Down, Down, Down, Enter)

    expect(focused()).toBe('Mostrar a legendaNão')
    expect(preview()).toBe('As legendas ficam escondidas.')
  })

  it('should say what the zoom and the transitions do', () => {
    const sut = show()

    sut.remote.press(Down, Down, Left)
    expect(preview()).toBe('A foto seguinte entra de uma vez, sem efeito.')
    sut.remote.press(Right, Right)
    expect(preview()).toBe('A foto seguinte desliza pela tela e empurra a anterior.')
    sut.remote.press(Right)
    expect(preview()).toBe('Cada foto se aproxima devagar e se dissolve na seguinte.')
    sut.remote.press(Down)
    expect(preview()).toBe(
      'O zoom lento aproxima um pouco cada foto. Vale para a transição Zoom lento.',
    )
  })

  it('should say when the interface hides', () => {
    const sut = show()

    sut.remote.press(...Array<RemoteKey>(13).fill(Down))

    expect(preview()).toBe('A data, o contador e as dicas somem 4 segundos depois de cada troca.')
  })

  it('should say how a book is laid out and played', () => {
    const sut = show()

    sut.remote.press(...Array<RemoteKey>(8).fill(Down))
    expect(preview()).toBe(
      'De uma a seis fotos por página, alternando páginas de respiro e páginas cheias. A quantidade varia com as fotos de cada página.',
    )
    sut.remote.press(Left)
    expect(focused()).toBe('Densidade do livroLeve')
    expect(preview()).toBe(
      'Poucas fotos por página, de uma a três, com muito respiro. A quantidade varia com as fotos de cada página.',
    )
    sut.remote.press(Right, Right)
    expect(focused()).toBe('Densidade do livroDensa')
    sut.remote.press(Down)
    expect(focused()).toBe('Formato do livroTela cheia (16:9)')
    expect(preview()).toBe(
      'As duas páginas ocupam a tela inteira, cada uma um pouco mais alta que larga.',
    )
    sut.remote.press(Right)
    expect(focused()).toBe('Formato do livroClássico (4:3)')
    expect(preview()).toBe(
      'O formato anterior: páginas mais largas que altas, com faixas acima e abaixo do livro.',
    )
    sut.remote.press(Enter)
    expect(focused()).toBe('Formato do livroTela cheia (16:9)')
    sut.remote.press(Down)
    expect(preview()).toBe('O livro abre com uma capa: o nome do álbum e o período das fotos.')
    sut.remote.press(Enter)
    expect(preview()).toBe('O livro abre direto nas páginas de fotos.')
    sut.remote.press(Down)
    expect(preview()).toBe('O número de cada página aparece pequeno, no canto de baixo do papel.')
    sut.remote.press(Enter)
    expect(preview()).toBe('As páginas aparecem sem número.')
    sut.remote.press(Down, Right)
    expect(focused()).toBe('Tempo de cada página dupla15 s')
    expect(preview()).toBe('Ao reproduzir um livro, cada página dupla fica 15 segundos na tela.')
  })

  it('should restore the defaults on Enter on the last row', () => {
    const sut = show({ ...DEFAULT_PRESENTATION, order: PlaybackOrder.Random })
    sut.remote.press(...Array<RemoteKey>(17).fill(Down))
    expect(focused()).toBe(MESSAGES.restoreDefaults)
    expect(preview()).toBe('OK volta todos os ajustes aos valores padrão.')

    sut.remote.press(Enter, Back)

    expect(rows()[0]).toBe('Tempo de cada foto10 s')
    expect(sut.closed).toStrictEqual([DEFAULTS])
  })

  it('should hand the settings back on Back', () => {
    const sut = show()

    sut.remote.press(Right, Back)

    expect(sut.closed).toStrictEqual([{ ...DEFAULT_PRESENTATION, intervalSeconds: 9 }])
  })
})
