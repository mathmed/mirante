import type { JSX } from 'preact'
import { useEffect, useState } from 'preact/hooks'

import type { CaptionCache } from '../core/captions.ts'
import { shortText } from './messages.ts'

// About two lines of the caption: nothing on the screen clips text.
const CAPTION_LENGTH = 140

export interface CaptionProps {
  readonly captions: CaptionCache
  // The photo on the screen, and the next one, whose caption is read ahead.
  readonly photoId: string | undefined
  readonly nextPhotoId: string | undefined
}

interface KnownCaption {
  readonly photoId: string
  readonly text: string | undefined
}

// The caption written for the photo in Immich, under it, in the golden italic serif. It fades in
// when it arrives; without one nothing shows, and nothing else on the screen moves.
export function Caption({ captions, photoId, nextPhotoId }: CaptionProps): JSX.Element {
  const text = useCaption(captions, photoId)
  useReadAhead(captions, nextPhotoId)
  return (
    <div class="viewer-caption">
      {text !== undefined && (
        <p key={photoId} class="viewer-caption-text">
          {shortText(text, CAPTION_LENGTH)}
        </p>
      )}
    </div>
  )
}

// The caption of the photo on the screen, once read; a caption of another photo never shows.
function useCaption(captions: CaptionCache, photoId: string | undefined): string | undefined {
  const [known, setKnown] = useState<KnownCaption | undefined>(undefined)
  useEffect(() => {
    if (photoId === undefined) {
      return undefined
    }
    let isCurrent = true
    void captions.captionOf(photoId).then((text) => {
      if (isCurrent) {
        setKnown({ photoId, text })
      }
    })
    return () => {
      isCurrent = false
    }
  }, [captions, photoId])
  return known !== undefined && known.photoId === photoId ? known.text : undefined
}

function useReadAhead(captions: CaptionCache, photoId: string | undefined): void {
  useEffect(() => {
    if (photoId !== undefined) {
      void captions.captionOf(photoId)
    }
  }, [captions, photoId])
}
