import { screen, waitFor } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { focused, focusedOn, showGallery, title, TRIP } from '../../test/gallery.ts'
import { STORED_SEEDS_VERSION } from '../core/book-seeds.ts'
import { ScreenKind } from '../core/navigation.ts'
import { RemoteKey } from '../core/remote-key.ts'
import { homeTitle, MESSAGES } from './messages.ts'

const { Left, Right, Enter, Back, Info } = RemoteKey
const ALL_PHOTOS = homeTitle(ScreenKind.AllPhotos)

function shownPhotos(): readonly string[] {
  return [...document.querySelectorAll('.spread.is-current .book-frame img')].map(
    (image) => image.getAttribute('src')?.split('/').pop() ?? '',
  )
}

async function photoInFocus(photoId: string): Promise<void> {
  await waitFor(() => {
    expect(document.activeElement?.querySelector('img')?.getAttribute('src')).toBe(
      `https://images.test/thumbnail/${photoId}`,
    )
  })
}

describe('the photos of an album or a month', () => {
  it('should offer them as a book before the photos, the focus on the first photo', async () => {
    const sut = showGallery()
    await focusedOn(ALL_PHOTOS)
    sut.remote.press(Right, Enter)
    await focusedOn(TRIP.name)
    sut.remote.press(Enter)
    await title(TRIP.name)

    await photoInFocus('trip-1')
    expect(screen.getAllByRole('listitem')[0]?.textContent).toBe(MESSAGES.seeAsBook)
    sut.remote.press(Left)
    await focusedOn(MESSAGES.seeAsBook)
  })

  it('should open the album as a book, and come back to its tile', async () => {
    const sut = showGallery()
    await focusedOn(ALL_PHOTOS)
    sut.remote.press(Right, Enter)
    await focusedOn(TRIP.name)
    sut.remote.press(Enter)
    await title(TRIP.name)
    await photoInFocus('trip-1')
    sut.remote.press(Left, Enter)

    expect(await screen.findByText('Capa e página 1')).toBeTruthy()
    expect(document.querySelector('.book-cover-title')?.textContent).toBe(TRIP.name)
    expect(shownPhotos()[0]).toBe('trip-1')
    sut.remote.press(Back)

    await title(TRIP.name)
    await focusedOn(MESSAGES.seeAsBook)
    sut.remote.press(Right, Enter)
    expect(screen.getByRole('dialog', { name: '1 de 30' })).toBeTruthy()
    sut.remote.press(Back)
    await photoInFocus('trip-1')
  })

  it('should open a month as a book', async () => {
    const sut = showGallery()
    await focusedOn(ALL_PHOTOS)
    sut.remote.press(Right, Right, Enter)
    await focusedOn('2024')
    sut.remote.press(Enter)
    await focusedOn('Março')
    sut.remote.press(Enter)
    await title('Março de 2024')
    await photoInFocus('march-1')

    sut.remote.press(Left, Enter)

    expect(await screen.findByText('Capa e página 1')).toBeTruthy()
    expect(document.querySelector('.book-cover-title')?.textContent).toBe('Março de 2024')
    expect(shownPhotos()[0]).toBe('march-1')
  })

  it('should keep the seed of a reorganized book on the TV, and open it reorganized again', async () => {
    const sut = showGallery()
    await focusedOn(ALL_PHOTOS)
    sut.remote.press(Right, Enter)
    await focusedOn(TRIP.name)
    sut.remote.press(Enter)
    await title(TRIP.name)
    await photoInFocus('trip-1')
    sut.remote.press(Left, Enter)
    await screen.findByText('Capa e página 1')
    const before = shownPhotos()

    // Info shows the controls over the book, on the overview button.
    sut.remote.press(Info, Right)
    expect(focused()).toBe(MESSAGES.reorganizeBook)
    sut.remote.press(Enter)

    expect(sut.booksWritten).toStrictEqual([
      JSON.stringify({ version: STORED_SEEDS_VERSION, books: [['album:trip', 1]] }),
    ])
    const after = shownPhotos()
    expect(after).not.toStrictEqual(before)
    sut.remote.press(Back)
    await focusedOn(MESSAGES.seeAsBook)
    sut.remote.press(Enter)
    await screen.findByText('Capa e página 1')
    expect(shownPhotos()).toStrictEqual(after)
  })
})
