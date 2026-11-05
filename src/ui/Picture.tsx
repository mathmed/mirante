import type { JSX } from 'preact'
import { useState } from 'preact/hooks'

export interface PictureProps {
  readonly url: string
  readonly alt: string
  readonly missingText: string
}

// An image from the server; when it fails, a text takes its place, and the tile around it keeps the
// focus.
export function Picture({ url, alt, missingText }: PictureProps): JSX.Element {
  const [isMissing, setIsMissing] = useState(false)
  if (isMissing) {
    return <span class="picture-missing">{missingText}</span>
  }
  return (
    <img
      class="picture"
      src={url}
      alt={alt}
      decoding="async"
      onError={() => {
        setIsMissing(true)
      }}
    />
  )
}
