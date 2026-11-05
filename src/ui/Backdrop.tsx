import type { JSX } from 'preact'
import { useState } from 'preact/hooks'

const ImageStatus = { Loading: 'loading', Shown: 'shown', Failed: 'failed' } as const
type ImageStatus = (typeof ImageStatus)[keyof typeof ImageStatus]

export interface BackdropProps {
  readonly url: string
}

// A photo of the library behind the start screen, darkened by gradients (never blurred: the TVs'
// GPUs would redraw the whole screen). It fades in once it loads; when it fails, the plain
// background stays.
export function Backdrop({ url }: BackdropProps): JSX.Element | null {
  const [status, setStatus] = useState<ImageStatus>(ImageStatus.Loading)
  if (status === ImageStatus.Failed) {
    return null
  }
  return (
    <div class={status === ImageStatus.Shown ? 'backdrop is-shown' : 'backdrop'} aria-hidden="true">
      <img
        class="backdrop-photo"
        src={url}
        alt=""
        decoding="async"
        onLoad={() => {
          setStatus(ImageStatus.Shown)
        }}
        onError={() => {
          setStatus(ImageStatus.Failed)
        }}
      />
    </div>
  )
}
