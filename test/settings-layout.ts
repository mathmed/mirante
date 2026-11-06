import { vi } from 'vitest'

// jsdom lays nothing out: the settings screen laid out as styles.css does on a TV of the given height,
// for the scroll of its list to be tested. The titles of the sections and the rows stack in the list;
// the list gets the height of the screen but its margins (5% of each edge), the title and the gap
// under it (4% of the height).
const TITLE_HEIGHT = 46
const ROW_HEIGHT = 62
const ROW_GAP = 10
const HEADER_HEIGHT = 62
const SAFE_SHARE = 0.9
const HEADER_GAP_SHARE = 0.04

export interface SettingsLayout {
  readonly viewport: number
}

export function layOutSettings(screenHeight: number): SettingsLayout {
  const viewport = screenHeight * SAFE_SHARE - HEADER_HEIGHT - screenHeight * HEADER_GAP_SHARE
  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function top(
    this: HTMLElement,
  ) {
    return placeOf(this).top
  })
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function height(
    this: HTMLElement,
  ) {
    return this.classList.contains('settings-scroller') ? contentHeight(this) : placeOf(this).height
  })
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function client(
    this: Element,
  ) {
    return this.classList.contains('settings-viewport') ? viewport : 0
  })
  return { viewport }
}

interface Place {
  readonly top: number
  readonly height: number
}

function heightOf(item: Element): number {
  return item.classList.contains('setting') ? ROW_HEIGHT : TITLE_HEIGHT
}

function stepOf(item: Element): number {
  return item.classList.contains('setting') ? ROW_HEIGHT + ROW_GAP : TITLE_HEIGHT
}

function itemsOf(list: Element): readonly Element[] {
  return [...list.querySelectorAll('[data-scroll-key]')]
}

function placeOf(element: HTMLElement): Place {
  const list = element.closest('.settings-scroller')
  if (list === null || !element.hasAttribute('data-scroll-key')) {
    return { top: 0, height: 0 }
  }
  const before = itemsOf(list).slice(0, itemsOf(list).indexOf(element))
  return { top: before.reduce((sum, item) => sum + stepOf(item), 0), height: heightOf(element) }
}

function contentHeight(list: Element): number {
  return itemsOf(list).reduce((sum, item) => sum + stepOf(item), 0) - ROW_GAP
}

// Where the focused row is on the screen, under the list's transform.
export function focusedRowOnScreen(): Place & { readonly isHidden: boolean } {
  const row = document.activeElement
  const list = document.querySelector<HTMLElement>('.settings-scroller')
  if (!(row instanceof HTMLElement) || list === null) {
    throw new Error('No focused row of the settings')
  }
  const offset = -Number(/-?[\d.]+/u.exec(list.style.transform)?.[0] ?? 'NaN')
  return {
    top: row.offsetTop - offset,
    height: row.offsetHeight,
    isHidden: row.classList.contains('is-outside'),
  }
}
