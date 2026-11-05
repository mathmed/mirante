import type { JSX } from 'preact'

import { ImageSize, type PhotoLibrary } from '../core/photo-library.ts'
import {
  effectiveTransition,
  isZooming,
  transitionMs,
  zoomMs,
  zoomPathOf,
} from '../core/presentation-effects.ts'
import type { PresentationSettings } from '../core/presentation-settings.ts'
import { placeOf, type PresentationState, type Slide, SlidePlace } from '../core/presentation.ts'
import { MESSAGES, photoDateText } from './messages.ts'
import { Picture } from './Picture.tsx'

export interface SlidesProps {
  readonly state: PresentationState
  // The slides kept decoded, at most three.
  readonly decoded: readonly Slide[]
  readonly settings: PresentationSettings
  readonly library: PhotoLibrary
}

// The slides of the viewer, in their preview size, never the original. The transition only moves
// opacity and transform: the slide on the screen fades or slides in, the one leaving it out, and the
// slow zoom drifts the photo on the screen (and the one leaving it) the way its id decides.
export function Slides({ state, decoded, settings, library }: SlidesProps): JSX.Element {
  const style = {
    transitionDuration: `${String(transitionMs(effectiveTransition(settings)))}ms`,
    animationDuration: `${String(zoomMs(settings))}ms`,
  }
  return (
    <>
      {decoded.map((slide) => (
        <div key={slide.key} class={slideClass(state, slide, settings)} style={style}>
          <SlidePhotos slide={slide} library={library} />
        </div>
      ))}
    </>
  )
}

interface SlidePhotosProps {
  readonly slide: Slide
  readonly library: PhotoLibrary
}

// Today a slide holds a single photo.
function SlidePhotos({ slide, library }: SlidePhotosProps): JSX.Element {
  const [photo] = slide.photos
  return (
    <Picture
      url={library.imageUrl(photo.id, ImageSize.Preview)}
      alt={photoDateText(photo.date)}
      missingText={MESSAGES.previewUnavailable}
    />
  )
}

// "slide slide-fade is-current is-zooming zoom-in-left-gentle": the transition, where the slide
// stands, whether it leaves the screen, and the path of its zoom.
function slideClass(
  state: PresentationState,
  slide: Slide,
  settings: PresentationSettings,
): string {
  const place = placeOf(state, slide)
  const isLeaving = slide.key === state.leaving?.key
  const transition = `slide-${effectiveTransition(settings)}`
  const classes = ['slide', transition, `is-${place}`, ...(isLeaving ? ['is-leaving'] : [])]
  const isOnTheMove = place === SlidePlace.Current || isLeaving
  return [...classes, ...zoomClasses(slide, settings, isOnTheMove)].join(' ')
}

// The slow zoom of the slide on the screen, and of the one leaving it.
function zoomClasses(
  slide: Slide,
  settings: PresentationSettings,
  isOnTheMove: boolean,
): readonly string[] {
  if (!isZooming(settings) || !isOnTheMove) {
    return []
  }
  return ['is-zooming', `zoom-${zoomPathOf(slide.photos[0].id)}-${settings.zoom}`]
}
