import type { JSX } from 'preact'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

import { createCaptionCache } from '../core/captions.ts'
import { ImageSize, type PhotoLibrary } from '../core/photo-library.ts'
import type { PresentationSettings } from '../core/presentation-settings.ts'
import { currentSlide, decodedSlides, type Slide, slidesAhead } from '../core/presentation.ts'
import { type KeySource, RemoteKey } from '../core/remote-key.ts'
import { Caption, CaptionPlace } from './Caption.tsx'
import { KeyListener } from './KeyListener.tsx'
import { counterText, MESSAGES } from './messages.ts'
import type { PresentationControls } from './screen-props.ts'
import { SettingsPanel } from './SettingsPanel.tsx'
import { Slides } from './Slides.tsx'
import { type PresentationControl, type Rounds, usePresentation } from './use-presentation.ts'
import { ViewerInfo } from './ViewerInfo.tsx'

export interface ViewerProps {
  readonly slides: readonly Slide[]
  // The slide chosen in the grid; the first one for a presentation.
  readonly start: number
  readonly shouldPlay: boolean
  readonly rounds: Rounds
  readonly library: PhotoLibrary
  readonly keys: KeySource
  readonly reportError: (error: unknown) => void
  readonly presentation: PresentationControls
  // Back: the grid takes the focus to the slide on the screen.
  readonly onClose: (index: number) => void
}

// One photo at a time, full screen: left and right move, Enter starts or pauses the slideshow,
// Info or Down opens its settings over it, and Back closes it.
export function Viewer(props: ViewerProps): JSX.Element {
  const { library, presentation } = props
  const { settings } = presentation
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const control = usePresentation({ ...props, settings, isHeld: isSettingsOpen })
  const { state, upcoming } = control
  const viewerRef = useFocusWhileOnTop(isSettingsOpen)
  const ahead = slidesAhead(state, upcoming)
  const current = currentSlide(state)
  return (
    <div
      ref={viewerRef}
      class={viewerClass(state.isPlaying, isSettingsOpen)}
      role="dialog"
      aria-label={counterText(state.index, state.slides.length)}
      tabIndex={-1}
    >
      <Slides state={state} decoded={decodedSlides(state, ahead)} {...{ settings, library }} />
      <Prefetch library={library} slide={ahead[1]} />
      <div class="viewer-vignette" />
      <ViewerInfo {...{ state, settings }} photo={current?.photos[0]} isHeld={isSettingsOpen} />
      {settings.shouldShowCaption && <ViewerCaption {...props} current={current} next={ahead[0]} />}
      <ViewerControls {...props} {...{ control, isSettingsOpen }} onSettings={setIsSettingsOpen} />
    </div>
  )
}

// Playing, the slow zoom moves; covered by its settings, the slideshow waits and the date, the
// counter and the caption step aside.
function viewerClass(isPlaying: boolean, isCovered: boolean): string {
  if (isCovered) {
    return 'viewer is-covered'
  }
  return isPlaying ? 'viewer is-playing' : 'viewer'
}

interface ViewerCaptionProps extends ViewerProps {
  readonly current: Slide | undefined
  readonly next: Slide | undefined
}

// Today a slide holds one photo, whose caption it shows. The captions read stay while they show.
function ViewerCaption({ library, reportError, current, next }: ViewerCaptionProps): JSX.Element {
  const [captions] = useState(() => createCaptionCache(library.readCaption, reportError))
  return (
    <Caption
      place={CaptionPlace.Viewer}
      captions={captions}
      photoId={current?.photos[0].id}
      nextPhotoId={next?.photos[0].id}
    />
  )
}

interface ViewerControlsProps extends ViewerProps {
  readonly control: PresentationControl
  readonly isSettingsOpen: boolean
  readonly onSettings: (isOpen: boolean) => void
}

// The keys go to the viewer, or to its settings while they are open: Back keeps them and returns
// to the photo.
function ViewerControls(props: ViewerControlsProps): JSX.Element {
  const { presentation, keys, onSettings } = props
  const { saveSettings } = presentation
  const onKey = useViewerKeys(props)
  const close = useCallback(
    (settings: PresentationSettings) => {
      saveSettings(settings)
      onSettings(false)
    },
    [saveSettings, onSettings],
  )
  if (!props.isSettingsOpen) {
    return <KeyListener keys={keys} onKey={onKey} />
  }
  return (
    <div class="viewer-settings">
      <h2 class="viewer-settings-title">{MESSAGES.settings}</h2>
      <SettingsPanel
        settings={presentation.settings}
        defaults={presentation.defaults}
        keys={keys}
        onClose={close}
      />
    </div>
  )
}

function useViewerKeys(props: ViewerControlsProps): (key: RemoteKey) => void {
  const { onClose, onSettings, control } = props
  const { state, press } = control
  return useCallback(
    (key: RemoteKey) => {
      if (key === RemoteKey.Back) {
        onClose(state.index)
      } else if (key === RemoteKey.Info || key === RemoteKey.Down) {
        onSettings(true)
      } else {
        press(key)
      }
    },
    [state.index, onClose, onSettings, press],
  )
}

interface PrefetchProps {
  readonly library: PhotoLibrary
  readonly slide: Slide | undefined
}

// The slide after the next one is downloaded ahead, not decoded: a detached image, which the
// browser only decodes once it shows.
function Prefetch({ library, slide }: PrefetchProps): null {
  const url =
    slide === undefined ? undefined : library.imageUrl(slide.photos[0].id, ImageSize.Preview)
  useEffect(() => {
    if (url !== undefined) {
      const image = new Image()
      image.src = url
    }
  }, [url])
  return null
}

// The grid that held the focus is gone: the viewer takes it, and takes it back from its settings.
function useFocusWhileOnTop(isCovered: boolean): { readonly current: HTMLDivElement | null } {
  const viewerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!isCovered) {
      viewerRef.current?.focus({ preventScroll: true })
    }
  }, [isCovered])
  return viewerRef
}
