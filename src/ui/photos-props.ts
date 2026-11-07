import type { BookSource } from '../core/book-source.ts'
import type { EditContext } from '../core/edit-actions.ts'
import type { GridPosition } from '../core/grid.ts'
import type { Album, Photo } from '../core/photo-library.ts'
import type { PanelText } from './messages.ts'
import type { ScreenProps } from './screen-props.ts'

// What the screens of the photos of an album or a month share.

export interface PhotosScreenProps extends ScreenProps {
  readonly title: string
  readonly task: () => Promise<readonly Photo[]>
  // What the first tile opens as a book.
  readonly source: BookSource
  readonly emptyText: PanelText
  // The album shown, as the changes left it; undefined for a month.
  readonly album: Album | undefined
}

export interface PhotoBrowserProps extends PhotosScreenProps {
  readonly photos: readonly Photo[]
  readonly context: EditContext
}

export interface Viewing {
  readonly position: GridPosition
  readonly setPosition: (position: GridPosition) => void
  // The photo open in the viewer, if any.
  readonly index: number | undefined
  readonly view: (index: number, from: GridPosition) => void
  readonly close: (index: number) => void
}
