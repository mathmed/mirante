import { screen, waitFor } from '@testing-library/preact'
import { expect } from 'vitest'

import type { EditGrant, LibraryEditor } from '../src/core/library-editor.ts'
import { ScreenKind } from '../src/core/navigation.ts'
import type { PhotoLibrary } from '../src/core/photo-library.ts'
import { RemoteKey } from '../src/core/remote-key.ts'
import { EDIT_MESSAGES } from '../src/ui/edit-messages.ts'
import { homeTitle, MESSAGES } from '../src/ui/messages.ts'
import { FULL_GRANT, recordingEditor } from './editor-stub.ts'
import { focusedOn, showGallery, type ShownGallery, title, TRIP } from './gallery.ts'

// The gallery of test/gallery.ts with the changes to its library: by default, every change allowed,
// each one recorded as "<call> <arguments as JSON>".
const { Right, Enter } = RemoteKey

export interface ShownEditing extends ShownGallery {
  readonly calls: readonly string[]
}

export interface EditingOptions {
  readonly grant?: EditGrant
  // Instead of the recording editor.
  readonly editor?: LibraryEditor
  readonly library?: PhotoLibrary
}

export function showEditing(options: EditingOptions = {}): ShownEditing {
  const recording = recordingEditor(options.grant ?? FULL_GRANT)
  const editor = options.editor ?? recording.editor
  const library = options.library === undefined ? {} : { library: options.library }
  return { ...showGallery({ editor, ...library }), calls: recording.calls }
}

// The albums, the first tile in focus: "Novo álbum" when albums can change.
export async function openAlbums(
  sut: ShownEditing,
  first: string = EDIT_MESSAGES.newAlbum,
): Promise<void> {
  await focusedOn(homeTitle(ScreenKind.AllPhotos))
  sut.remote.press(Right, Enter)
  await title(MESSAGES.albums)
  await focusedOn(first)
}

// The trip of 30 photos, its first photo in focus.
export async function openTrip(sut: ShownEditing): Promise<void> {
  await openAlbums(sut)
  sut.remote.press(Right, Enter)
  await title(TRIP.name)
  await photoInFocus('trip-1')
}

export async function photoInFocus(photoId: string): Promise<void> {
  await waitFor(() => {
    expect(document.activeElement?.querySelector('img')?.getAttribute('src')).toBe(
      `https://images.test/thumbnail/${photoId}`,
    )
  })
}

// The photos of the grid, by id.
export function gridPhotos(): readonly string[] {
  return [...document.querySelectorAll('.grid-photos img')].map(
    (image) => image.getAttribute('src')?.split('/').pop() ?? '',
  )
}

export async function noticeOf(text: string): Promise<void> {
  expect(await screen.findByText(text)).toBeTruthy()
}

export function barActions(): readonly (string | null)[] {
  return [...document.querySelectorAll('.action-bar .choice')].map((choice) => choice.textContent)
}

export function dialog(): HTMLElement | null {
  return document.querySelector('.overlay')
}

export function nameField(): HTMLInputElement {
  const field = document.querySelector('.name-field')
  if (!(field instanceof HTMLInputElement)) {
    throw new Error('no name field')
  }
  return field
}
