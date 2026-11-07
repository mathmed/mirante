import type { JSX } from 'preact'
import { useState } from 'preact/hooks'

const ImageStatus = { Loading: 'loading', Shown: 'shown', Failed: 'failed' } as const
type ImageStatus = (typeof ImageStatus)[keyof typeof ImageStatus]

// A photo behind the start screen, and what it says over it: how long ago it was taken, for a
// photo of this day in a past year; nothing for the cover of an album.
export interface BackdropPhoto {
  readonly url: string
  readonly caption: string | undefined
}

export interface BackdropProps {
  readonly photo: BackdropPhoto
}

// A photo of the library behind the start screen, darkened by gradients (never blurred: the TVs'
// GPUs would redraw the whole screen). It fades in once it loads, with its caption; when it fails,
// what lies below it stays.
export function Backdrop({ photo }: BackdropProps): JSX.Element | null {
  const [status, setStatus] = useState<ImageStatus>(ImageStatus.Loading)
  if (status === ImageStatus.Failed) {
    return null
  }
  return (
    <div class={status === ImageStatus.Shown ? 'backdrop is-shown' : 'backdrop'} aria-hidden="true">
      <img
        class="backdrop-photo"
        src={photo.url}
        alt=""
        decoding="async"
        onLoad={() => {
          setStatus(ImageStatus.Shown)
        }}
        onError={() => {
          setStatus(ImageStatus.Failed)
        }}
      />
      {photo.caption !== undefined && <p class="backdrop-caption">{photo.caption}</p>}
    </div>
  )
}
