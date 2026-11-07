import type { JSX } from 'preact'
import { useCallback, useMemo, useState } from 'preact/hooks'

import { goneFrom, refusalOf, viewerActions } from '../core/edit-actions.ts'
import { StepKind } from '../core/edit-flow.ts'
import { type GridPosition, START_POSITION } from '../core/grid.ts'
import { type Slide, slideOf } from '../core/presentation.ts'
import { NO_SELECTION, type Selection } from '../core/selection.ts'
import { blockText } from './edit-messages.ts'
import { EditOverlay } from './EditOverlay.tsx'
import { PhotoGrid } from './PhotoGrid.tsx'
import type { PhotoBrowserProps, Viewing } from './photos-props.ts'
import { type EditFlow, useEditFlow } from './use-edit-flow.ts'
import { SAME_SLIDES } from './use-presentation.ts'
import { Viewer, type ViewerChanges } from './Viewer.tsx'

// An album or a month opens on its first photo, beside the book.
const FIRST_PHOTO: GridPosition = { focus: 1, topRow: 0 }

// The grid leaves the screen while the viewer is open, its thumbnails unloaded; Back brings it back
// with the focus on the photo the viewer showed last. The viewer shows the photos in the order of
// the grid, paused, and its slideshow goes around them again. The steps of a change show over
// either; a change ends the selection. When its last photo goes, the screen shows the empty album
// anew (PhotosScreen), the viewer closed.
export function PhotoBrowser(props: PhotoBrowserProps): JSX.Element {
  const { photos, editing, album } = props
  const viewing = useViewing(props.position)
  const [selection, setSelection] = useState<Selection>(NO_SELECTION)
  const onChanged = useCallback(() => {
    setSelection(NO_SELECTION)
  }, [])
  const flow = useEditFlow({ editing, album, onChanged })
  return (
    <>
      {viewing.index !== undefined && photos.length > 0 ? (
        <PhotoViewer {...props} flow={flow} viewing={viewing} start={viewing.index} />
      ) : (
        <PhotoGrid {...props} {...{ flow, selection, setSelection }} viewing={viewing} />
      )}
      <EditOverlay
        {...props}
        flow={flow}
        menuActions={viewerActions(props.context)}
        onChanged={onChanged}
        onAlbumDeleted={props.back}
      />
    </>
  )
}

interface PhotoViewerProps extends PhotoBrowserProps {
  readonly flow: EditFlow
  readonly viewing: Viewing
  readonly start: number
}

// Up on a photo opens what can be done to it, or says why nothing can.
function PhotoViewer(props: PhotoViewerProps): JSX.Element {
  const { photos, flow, viewing, editing, album, context } = props
  const slides = useMemo(() => photos.map(slideOf), [photos])
  const changes: ViewerChanges = {
    gone: goneFrom(editing.edits, album?.id),
    isCovered: flow.step.kind !== StepKind.Idle,
    onActions: (slide: Slide) => {
      if (viewerActions(context).length > 0) {
        flow.setStep({ kind: StepKind.Menu, photos: slide.photos })
      } else {
        editing.notify(blockText(refusalOf(context.access)))
      }
    },
  }
  return (
    <Viewer
      {...props}
      slides={slides}
      start={props.start}
      shouldPlay={false}
      rounds={SAME_SLIDES}
      onClose={viewing.close}
      changes={changes}
    />
  )
}

// A screen opened anew starts at START_POSITION itself (navigation.ts): then the grid opens on the
// first photo; back from the book, on the tile that opened it.
function useViewing(start: GridPosition): Viewing {
  const [position, setPosition] = useState<GridPosition>(
    start === START_POSITION ? FIRST_PHOTO : start,
  )
  const [index, setIndex] = useState<number | undefined>(undefined)
  const view = useCallback((photoIndex: number, from: GridPosition) => {
    setPosition(from)
    setIndex(photoIndex)
  }, [])
  // The photos follow the tile of the book.
  const close = useCallback((photoIndex: number) => {
    setPosition((previous) => ({ focus: photoIndex + 1, topRow: previous.topRow }))
    setIndex(undefined)
  }, [])
  return { position, setPosition, index, view, close }
}
