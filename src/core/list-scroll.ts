// A list taller than the room it has, moved with transform alone: how far to move it so that the
// row in focus stays whole on the screen, which of its items lie whole in view, and where the thin
// bar that tells how much is above and below sits. Every length is in pixels of the screen.

export interface ListView {
  // How far the list is moved up.
  readonly offset: number
  // The height of the room the list has, and of the whole list.
  readonly viewport: number
  readonly content: number
}

export interface Span {
  readonly top: number
  readonly bottom: number
}

// An item of the list: a row, or the title of the rows under it.
export interface ListItem extends Span {
  readonly isTitle: boolean
}

// The position bar, as shares: its length of the track, and its shift in its own lengths.
export interface ScrollThumb {
  readonly size: number
  readonly shift: number
}

export function maxOffset(view: ListView): number {
  return Math.max(0, view.content - view.viewport)
}

// The offset that shows the span whole with a margin around it (for the glow of the focus), moving
// as little as possible and never past either end of the list.
export function offsetToShow(view: ListView, span: Span, margin: number): number {
  const wanted = Math.min(view.offset, span.top - margin)
  const shown = Math.max(wanted, span.bottom + margin - view.viewport)
  return Math.min(maxOffset(view), Math.max(0, shown))
}

// The items of a list and the index of the one in focus among them.
export interface ListFocus {
  readonly items: readonly ListItem[]
  readonly focused: number
}

// The view moved for the item in focus to show whole, with the title right above it, if any: the
// first row of a section shows under its title. Without an item in focus the view stays.
export function showFocus(view: ListView, { items, focused }: ListFocus, margin: number): ListView {
  const [item] = items.slice(focused, focused + 1)
  if (item === undefined) {
    return view
  }
  const [above] = items.slice(focused - 1, focused)
  const top = above?.isTitle === true ? above.top : item.top
  return { ...view, offset: offsetToShow(view, { top, bottom: item.bottom }, margin) }
}

export function isInView(view: ListView, span: Span): boolean {
  return span.top >= view.offset && span.bottom <= view.offset + view.viewport
}

// Undefined when the whole list fits: nothing is above or below.
export function scrollThumb(view: ListView): ScrollThumb | undefined {
  if (view.content <= view.viewport || view.viewport <= 0) {
    return undefined
  }
  return { size: view.viewport / view.content, shift: view.offset / view.viewport }
}
