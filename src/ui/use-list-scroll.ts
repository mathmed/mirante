import { useLayoutEffect, useState } from 'preact/hooks'

import {
  isInView,
  type ListItem,
  type ListView,
  scrollThumb,
  type ScrollThumb,
  showFocus,
  type Span,
} from '../core/list-scroll.ts'

// Room around the row in focus, for its ring, its glow and its growth.
const FOCUS_MARGIN = 24
const KEY_ATTRIBUTE = 'data-scroll-key'
const TITLE_ATTRIBUTE = 'data-scroll-title'
const KEY_SELECTOR = `[${KEY_ATTRIBUTE}]`
const FOCUSED_ATTRIBUTE = 'aria-current'

type ElementSetter = (element: HTMLElement | null) => void

interface ListElements {
  readonly viewport: HTMLElement
  readonly list: HTMLElement
}

export interface ListScroll {
  // The refs of the room the list has, and of the list it moves.
  readonly setViewport: ElementSetter
  readonly setList: ElementSetter
  readonly offset: number
  // The keys of the items not whole in view, hidden: nothing relies on overflow.
  readonly outside: ReadonlySet<string>
  readonly thumb: ScrollThumb | undefined
}

interface Measured {
  readonly view: ListView
  readonly outside: ReadonlySet<string>
}

const UNMEASURED: Measured = { view: { offset: 0, viewport: 0, content: 0 }, outside: new Set() }

// The props that mark an item of the list (a row, or the title of the rows under it) for the scroll.
export function scrollItem(key: string): Readonly<Record<string, string>> {
  return { [KEY_ATTRIBUTE]: key }
}

export function scrollTitle(key: string): Readonly<Record<string, string>> {
  return { [KEY_ATTRIBUTE]: key, [TITLE_ATTRIBUTE]: '' }
}

// A list moved with transform alone, so that the item in focus (aria-current="true") is always
// whole on the screen, with the title above it when it opens a section; measured again whenever the
// focus moves.
export function useListScroll(focus: number): ListScroll {
  const [measured, setMeasured] = useState(UNMEASURED)
  const [viewport, setViewport] = useState<HTMLElement | null>(null)
  const [list, setList] = useState<HTMLElement | null>(null)
  // Measured on the next frame, once the focus has moved and the list is laid out.
  useLayoutEffect(() => {
    const elements = viewport === null || list === null ? undefined : { viewport, list }
    if (elements === undefined) {
      return undefined
    }
    const frame = requestAnimationFrame(() => {
      setMeasured((previous) => measure(elements, previous.view.offset))
    })
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [viewport, list, focus])
  const { view, outside } = measured
  return { setViewport, setList, offset: view.offset, outside, thumb: scrollThumb(view) }
}

function spanOf(element: HTMLElement): Span {
  return { top: element.offsetTop, bottom: element.offsetTop + element.offsetHeight }
}

function itemOf(element: HTMLElement): ListItem {
  return { ...spanOf(element), isTitle: element.hasAttribute(TITLE_ATTRIBUTE) }
}

function measure({ viewport, list }: ListElements, offset: number): Measured {
  const elements = [...list.querySelectorAll<HTMLElement>(KEY_SELECTOR)]
  const items = elements.map(itemOf)
  const focused = elements.findIndex((item) => item.getAttribute(FOCUSED_ATTRIBUTE) === 'true')
  const before = { offset, viewport: viewport.clientHeight, content: list.offsetHeight }
  const view = showFocus(before, { items, focused }, FOCUS_MARGIN)
  const outside = elements.filter((element) => !isInView(view, spanOf(element)))
  return { view, outside: new Set(outside.map((item) => String(item.getAttribute(KEY_ATTRIBUTE)))) }
}
