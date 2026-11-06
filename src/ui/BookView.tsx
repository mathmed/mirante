import type { JSX } from 'preact'
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks'

import {
  type BookAction,
  BookActionKind,
  BookControl,
  type BookFocus,
  BookZone,
  isLayerShown,
  OVERVIEW_CONTROL,
  pressInBook,
  spreadRects,
  withoutLayer,
} from '../core/book-navigation.ts'
import { type Book, type BookLayouts, type Spread, spreadAt } from '../core/book.ts'
import { createCaptionCache } from '../core/captions.ts'
import type { PhotoLibrary } from '../core/photo-library.ts'
import { interfaceMs } from '../core/presentation-effects.ts'
import type { PresentationSettings } from '../core/presentation-settings.ts'
import { type KeySource, RemoteKey } from '../core/remote-key.ts'
import { BookLayer } from './BookLayer.tsx'
import { BookOverview } from './BookOverview.tsx'
import { BookStage } from './BookSpread.tsx'
import { Caption, CaptionPlace } from './Caption.tsx'
import { KeyListener } from './KeyListener.tsx'
import { Progress } from './Progress.tsx'
import type { PresentationControls } from './screen-props.ts'
import { type PresentationControl, SAME_SLIDES, usePresentation } from './use-presentation.ts'

export interface BookViewProps {
  // The name of the album or of the month.
  readonly title: string
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

// The book, a spread at a time, filling the screen; the layer of its controls shows over it when
// asked for, and hides by itself after the time of the settings. The presentation engine turns the
// pages: left and right, and, while the book plays, its clock, with the time of a spread of the
// settings; the overview holds it.
export function BookView(props: BookViewProps): JSX.Element {
  const { book, presentation } = props
  const [isOverviewOpen, setIsOverviewOpen] = useState(false)
  const [focus, setFocus] = useState<BookFocus>({ zone: BookZone.Page, frame: props.start.frame })
  // Every key pressed counts: the layer stays while the remote control is in use.
  const [presses, setPresses] = useState(0)
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
  const view = {
    ...props,
    ...{ settings, control, focus, setFocus, isOverviewOpen, setIsOverviewOpen },
    ...{ presses, setPresses },
  }
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
  readonly presses: number
  readonly setPresses: (count: (previous: number) => number) => void
}

function OpenBook(props: OpenBookProps): JSX.Element {
  const { book, layouts, spread, settings, control, focus, isOverviewOpen } = props
  const onKey = useBookKeys(props)
  useLayerTimeout(props)
  const { isPlaying } = control.state
  const frame = focus.zone === BookZone.Page ? Math.min(focus.frame, spread.photos.length - 1) : -1
  const stage = { state: control.state, upcoming: control.upcoming, frame }
  return (
    <div class={bookClass(settings, isPlaying)}>
      <BookStage {...props} {...stage} shouldShowNumbers={settings.shouldShowPageNumbers} />
      {settings.shouldShowCaption && !isPlaying && <BookCaption {...props} frame={frame} />}
      <Progress
        place={CaptionPlace.Book}
        state={control.state}
        settings={settings}
        isHeld={isOverviewOpen}
      />
      <BookLayer
        {...{ book, layouts, spread, focus, isPlaying }}
        title={props.title}
        current={control.state.index}
        isShown={isLayerShown(focus)}
        isCovered={isOverviewOpen}
      />
      <BookKeys {...props} onKey={onKey} />
    </div>
  )
}

// Playing, only the pages show, without the ring of the focus; reducing the effects leaves the
// crossfade of the pages alone.
function bookClass(settings: PresentationSettings, isPlaying: boolean): string {
  const classes = [
    'book',
    ...(settings.shouldReduceEffects ? ['is-calm'] : []),
    ...(isPlaying ? ['is-playing'] : []),
  ]
  return classes.join(' ')
}

// The keys go to the book, or to its overview while it is open: Back closes it, on its button.
function BookKeys(
  props: OpenBookProps & { readonly onKey: (key: RemoteKey) => void },
): JSX.Element {
  const { book, layouts, keys, control, focus, setFocus, setIsOverviewOpen } = props
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
        setFocus({ zone: BookZone.Controls, control: OVERVIEW_CONTROL, frame: focus.frame })
      }}
    />
  )
}

// The layer hides by itself the time of the settings after the last key, unless the overview
// covers it; the focus goes back to its photo.
function useLayerTimeout(props: OpenBookProps): void {
  const { focus, setFocus, settings, isOverviewOpen, presses } = props
  const isWaiting = isLayerShown(focus) && !isOverviewOpen
  const hideMs = interfaceMs(settings)
  useEffect(() => {
    if (!isWaiting) {
      return undefined
    }
    const timer = setTimeout(() => {
      setFocus(withoutLayer(focus))
    }, hideMs)
    return () => {
      clearTimeout(timer)
    }
  }, [focus, setFocus, isWaiting, hideMs, presses])
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
  const { book, layouts, spread, control, focus, setPresses } = props
  const frames = useMemo(() => spreadRects(spread, layouts), [spread, layouts])
  const apply = useBookActions(props)
  const { index, isPlaying } = control.state
  const spreadCount = book.spreads.length
  return useCallback(
    (key: RemoteKey) => {
      setPresses((count) => count + 1)
      apply(pressInBook(focus, key, { frames, spread: index, spreadCount, isPlaying }))
    },
    [apply, focus, frames, index, spreadCount, isPlaying, setPresses],
  )
}

function useBookActions(props: OpenBookProps): (action: BookAction) => void {
  const { spread, control, setFocus, back, onOpen, onJump } = props
  const pressControl = useControlPress(props)
  return useCallback(
    (action: BookAction) => {
      if ('focus' in action) {
        setFocus(action.focus)
      }
      act(action, { spread, press: control.press, pressControl, back, onOpen, onJump })
    },
    [spread, control, setFocus, back, onOpen, onJump, pressControl],
  )
}

interface Acting {
  readonly spread: Spread
  // A key of the presentation engine, which turns the pages and plays the book.
  readonly press: (key: RemoteKey) => void
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
    case BookActionKind.Leave:
      acting.back()
      return
    default:
      pressPresentation(action, acting)
  }
}

// A page turns; a pause stops the book as its button would.
function pressPresentation(action: BookAction, acting: Acting): void {
  if (action.kind === BookActionKind.Turn) {
    acting.press(action.key)
  } else if (action.kind === BookActionKind.Pause) {
    acting.press(RemoteKey.Enter)
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
