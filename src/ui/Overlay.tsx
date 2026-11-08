import type { ComponentChildren, JSX } from 'preact'

export interface OverlayProps {
  readonly title: string
  // The keys that work in it, at the bottom.
  readonly keysText: string
  readonly children: ComponentChildren
}

// A dialog over the screen, which darkens behind it: the choice of an album, its name, a
// confirmation, the actions of the viewer.
export function Overlay({ title, keysText, children }: OverlayProps): JSX.Element {
  return (
    <div class="overlay" role="dialog" aria-label={title}>
      <div class="overlay-card">
        <h2 class="overlay-title">{title}</h2>
        {children}
        <p class="overlay-keys">{keysText}</p>
      </div>
    </div>
  )
}
