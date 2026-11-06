import type { JSX } from 'preact'
import { useCallback, useMemo, useState } from 'preact/hooks'

import {
  type BookAction,
  BookActionKind,
  BookControl,
  type BookFocus,
  BookZone,
  OVERVIEW_CONTROL,
  pressInBook,
  spreadRects,
} from '../core/book-navigation.ts'
import { type Book, type BookLayouts, type Spread, spreadAt } from '../core/book.ts'
import { createCaptionCache } from '../core/captions.ts'
import type { PhotoLibrary } from '../core/photo-library.ts'
import type { PresentationSettings } from '../core/presentation-settings.ts'
import { type KeySource, RemoteKey } from '../core/remote-key.ts'
import { BookBar } from './BookBar.tsx'
import { BookOverview } from './BookOverview.tsx'
import { BookStage, PageNumbers } from './BookSpread.tsx'
import { BookStrip } from './BookStrip.tsx'
import { Caption, CaptionPlace } from './Caption.tsx'
import { KeyListener } from './KeyListener.tsx'
import { MESSAGES } from './messages.ts'
import type { PresentationControls } from './screen-props.ts'
import { type PresentationControl, SAME_SLIDES, usePresentation } from './use-presentation.ts'

export interface BookViewProps {
  readonly book: Book
  readonly layouts: BookLayouts
  // The spread it opens on, and the photo in focus there.
  readonly start: { readonly spread: number; readonly frame: number }
  readonly library: PhotoLibrary
  readonly keys: KeySource
  readonly reportError: (error: unknown) => void
  readonly presentation: PresentationControls
  readonly back: () => void
  readonly onOpen: (photoId: string) => void
  // Opens the book again on this spread.
  readonly onJump: (spread: number) => void
  // A new seed for the book, which opens again on this photo.
  readonly onReorganize: (photoId: string) => void
}

// The buttons that turn the pages and play the book, by the key of the presentation they press.
const PRESSES: ReadonlyMap<BookControl, RemoteKey> = new Map([
  [BookControl.Previous, RemoteKey.Left],
  [BookControl.Next, RemoteKey.Right],
  [BookControl.Play, RemoteKey.Enter],
])

// The book, a spread at a time, with the bar of its buttons and the strip of its spreads under it.
// The presentation engine turns the pages: left and right, and, while the book plays, its clock,
// with the time of a spread of the settings; the overview holds it.
export function BookView(props: BookViewProps): JSX.Element {
  const { book, presentation } = props
  const [isOverviewOpen, setIsOverviewOpen] = useState(false)
  const [focus, setFocus] = useState<BookFocus>({ zone: BookZone.Page, frame: props.start.frame })
  const settings = useBookSettings(presentation.settings)
  const control = usePresentation({
    slides: book.spreads,
    start: props.start.spread,
    shouldPlay: false,
    rounds: SAME_SLIDES,
    settings,
    isHeld: isOverviewOpen,
  })
  const spread = spreadAt(book, control.state.index)
  const view = { ...props, settings, control, focus, setFocus, isOverviewOpen, setIsOverviewOpen }
  return spread === undefined ? <div class="book" /> : <OpenBook {...view} spread={spread} />
}

interface OpenBookProps extends BookViewProps {
  readonly spread: Spread
  readonly settings: PresentationSettings
  readonly control: PresentationControl
  readonly focus: BookFocus
  readonly setFocus: (focus: BookFocus) => void
  readonly isOverviewOpen: boolean
  readonly setIsOverviewOpen: (isOpen: boolean) => void
}

function OpenBook(props: OpenBookProps): JSX.Element {
  const { book, layouts, spread, settings, control, focus } = props
  const onKey = useBookKeys(props)
  const frame = focus.zone === BookZone.Page ? Math.min(focus.frame, spread.photos.length - 1) : -1
  return (
    <div class={settings.shouldReduceEffects ? 'book is-calm' : 'book'}>
      <PageNumbers spread={spread} isShown={settings.shouldShowPageNumbers} />
      <BookStage {...props} state={control.state} upcoming={control.upcoming} frame={frame} />
      {settings.shouldShowCaption && <BookCaption {...props} frame={frame} />}
      <BookBar focus={focus} isPlaying={control.state.isPlaying} isCovered={props.isOverviewOpen} />
      <BookStrip book={book} layouts={layouts} current={control.state.index} focus={focus} />
      <BookKeys {...props} onKey={onKey} />
      <p class="book-keys">{MESSAGES.bookKeys}</p>
    </div>
  )
}

// The keys go to the book, or to its overview while it is open: Back closes it, on its button.
function BookKeys(
  props: OpenBookProps & { readonly onKey: (key: RemoteKey) => void },
): JSX.Element {
  const { book, layouts, keys, control, setFocus, setIsOverviewOpen } = props
  if (!props.isOverviewOpen) {
    return <KeyListener keys={keys} onKey={props.onKey} />
  }
  return (
    <BookOverview
      {...{ book, layouts, keys }}
      current={control.state.index}
      onJump={props.onJump}
      onClose={() => {
        setIsOverviewOpen(false)
        setFocus({ zone: BookZone.Controls, control: OVERVIEW_CONTROL })
      }}
    />
  )
}

// The caption of the photo in focus, and the next one read ahead; none away from the photos.
function BookCaption(props: OpenBookProps & { readonly frame: number }): JSX.Element {
  const { library, reportError, spread, frame } = props
  const [captions] = useState(() => createCaptionCache(library.readCaption, reportError))
  const ids = spread.photos.map(({ id }) => id)
  const [photoId, nextPhotoId] = frame < 0 ? [] : ids.slice(frame)
  return <Caption place={CaptionPlace.Book} {...{ captions, photoId, nextPhotoId }} />
}

// While the book plays, each spread stays the time the settings give a spread.
function useBookSettings(settings: PresentationSettings): PresentationSettings {
  return useMemo(() => ({ ...settings, intervalSeconds: settings.bookSpreadSeconds }), [settings])
}

function useBookKeys(props: OpenBookProps): (key: RemoteKey) => void {
  const { book, layouts, spread, control, focus } = props
  const frames = useMemo(() => spreadRects(spread, layouts), [spread, layouts])
  const apply = useBookActions(props)
  const index = control.state.index
  const spreadCount = book.spreads.length
  return useCallback(
    (key: RemoteKey) => {
      apply(pressInBook(focus, key, { frames, spread: index, spreadCount }))
    },
    [apply, focus, frames, index, spreadCount],
  )
}

function useBookActions(props: OpenBookProps): (action: BookAction) => void {
  const { spread, control, setFocus, back, onOpen, onJump } = props
  const pressControl = useControlPress(props)
  return useCallback(
    (action: BookAction) => {
      switch (action.kind) {
        case BookActionKind.Turn:
          control.press(action.key)
          setFocus(action.focus)
          return
        case BookActionKind.Focus:
          setFocus(action.focus)
          return
        default:
          act(action, { spread, pressControl, back, onOpen, onJump })
      }
    },
    [spread, control, setFocus, back, onOpen, onJump, pressControl],
  )
}

interface Acting {
  readonly spread: Spread
  readonly pressControl: (control: BookControl) => void
  readonly back: () => void
  readonly onOpen: (photoId: string) => void
  readonly onJump: (spread: number) => void
}

function act(action: BookAction, acting: Acting): void {
  switch (action.kind) {
    case BookActionKind.Open:
      acting.spread.photos.slice(action.frame, action.frame + 1).forEach(({ id }) => {
        acting.onOpen(id)
      })
      return
    case BookActionKind.Press:
      acting.pressControl(action.control)
      return
    case BookActionKind.Jump:
      acting.onJump(action.spread)
      return
    default:
      acting.back()
  }
}

// The arrows and play press the presentation's keys; the overview opens; reorganizing keeps the
// first photo of the spread on the screen.
function useControlPress(props: OpenBookProps): (control: BookControl) => void {
  const { spread, control: presentation, setIsOverviewOpen, onReorganize } = props
  return useCallback(
    (control: BookControl) => {
      const key = PRESSES.get(control)
      if (key !== undefined) {
        presentation.press(key)
      } else if (control === BookControl.Overview) {
        setIsOverviewOpen(true)
      } else {
        onReorganize(spread.photos[0].id)
      }
    },
    [spread, presentation, setIsOverviewOpen, onReorganize],
  )
}
