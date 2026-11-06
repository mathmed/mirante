import { screen, waitFor } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { focusedOn, showGallery, title, TRIP } from '../../test/gallery.ts'
import { ScreenKind } from '../core/navigation.ts'
import { RemoteKey } from '../core/remote-key.ts'
import { homeTitle, MESSAGES } from './messages.ts'

const { Right, Down, Enter, Back } = RemoteKey

async function presentScreen(): Promise<ReturnType<typeof showGallery>> {
  const sut = showGallery()
  await focusedOn(homeTitle(ScreenKind.AllPhotos))
  sut.remote.press(Right, Right, Right, Enter)
  await title(MESSAGES.present)
  return sut
}

function playing(name: string): HTMLElement {
  return screen.getByRole('dialog', { name })
}

function current(): string | null | undefined {
  return document.querySelector('.slide.is-current img')?.getAttribute('src')
}

describe('PresentScreen', () => {
  it('should offer the whole library, an album, a year or a month, and an album or a month as a book', async () => {
    await presentScreen()

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toStrictEqual([
      'Toda a bibliotecaAleatória, 200 fotos por vez',
      'Um álbumEscolha o álbum',
      'Um anoEscolha o ano',
      'Um mêsEscolha o ano e o mês',
      'Livro de um álbumEscolha o álbum',
      'Livro de um mêsEscolha o ano e o mês',
    ])
    await focusedOn('Toda a biblioteca')
  })

  it('should present the whole library at once, and come back to the choices', async () => {
    const sut = await presentScreen()

    sut.remote.press(Enter)

    const dialog = await screen.findByRole('dialog', { name: '1 de 12' })
    await waitFor(() => {
      expect(document.activeElement).toBe(dialog)
    })
    expect(document.querySelector('.viewer-hint')?.textContent).toBe(MESSAGES.slideshowPlaying)
    sut.remote.press(Back)
    await focusedOn('Toda a biblioteca')
  })

  it('should choose an album to present, from the oldest photo', async () => {
    const sut = await presentScreen()

    sut.remote.press(Right, Enter)
    await title(MESSAGES.presentAlbum)
    await focusedOn(TRIP.name)
    sut.remote.press(Enter)

    expect(await screen.findByRole('dialog', { name: '1 de 30' })).toBeTruthy()
    expect(current()).toBe('https://images.test/preview/trip-1')
    sut.remote.press(Back)
    await focusedOn(TRIP.name)
    sut.remote.press(Back)
    await focusedOn('Um álbum')
  })

  it('should choose a year to present, with the photos of all its months', async () => {
    const sut = await presentScreen()

    sut.remote.press(Right, Right, Enter)
    await title(MESSAGES.presentYear)
    await focusedOn('2024')
    sut.remote.press(Enter)

    expect(await screen.findByRole('dialog', { name: '1 de 12' })).toBeTruthy()
    expect(current()).toBe('https://images.test/preview/march-1')
  })

  it('should choose a year, then a month to present', async () => {
    const sut = await presentScreen()

    sut.remote.press(Down, Enter)
    await title(MESSAGES.presentMonth)
    await focusedOn('2024')
    sut.remote.press(Enter)
    await title('2024')
    await focusedOn('Março')
    sut.remote.press(Right, Enter)

    expect(await screen.findByRole('dialog', { name: '1 de 2' })).toBeTruthy()
    expect(current()).toBe('https://images.test/preview/april-1')
    expect(await screen.findByText('Abril em flor')).toBeTruthy()
    await waitFor(() => {
      expect(playing('1 de 2')).toBe(document.activeElement)
    })
  })

  it('should say there is nothing to present in an empty album', async () => {
    const sut = await presentScreen()

    sut.remote.press(Right, Enter)
    await focusedOn(TRIP.name)
    sut.remote.press(Right, Right, Enter)

    expect(await screen.findByText(MESSAGES.emptyPresentation.title)).toBeTruthy()
    await title('Sem fotos')
    sut.remote.press(Down, Enter)
    await focusedOn('Sem fotos')
  })
})
