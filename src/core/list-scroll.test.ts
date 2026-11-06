import { describe, expect, it } from 'vitest'

import {
  isInView,
  type ListItem,
  type ListView,
  maxOffset,
  offsetToShow,
  scrollThumb,
  showFocus,
} from './list-scroll.ts'

const VIEW: ListView = { offset: 0, viewport: 500, content: 1200 }
const MARGIN = 20

describe('maxOffset', () => {
  it('should move the list at most until its end reaches the bottom', () => {
    expect(maxOffset(VIEW)).toBe(700)
  })

  it('should never move a list that fits', () => {
    expect(maxOffset({ ...VIEW, content: 300 })).toBe(0)
  })
})

describe('offsetToShow', () => {
  it('should stay put while the span is whole in view with its margin', () => {
    expect(offsetToShow({ ...VIEW, offset: 100 }, { top: 120, bottom: 580 }, MARGIN)).toBe(100)
  })

  it('should move down just enough to show a span below', () => {
    expect(offsetToShow(VIEW, { top: 600, bottom: 660 }, MARGIN)).toBe(180)
  })

  it('should move up just enough to show a span above', () => {
    expect(offsetToShow({ ...VIEW, offset: 400 }, { top: 300, bottom: 360 }, MARGIN)).toBe(280)
  })

  it('should never move past the top', () => {
    expect(offsetToShow({ ...VIEW, offset: 50 }, { top: 0, bottom: 60 }, MARGIN)).toBe(0)
  })

  it('should never move past the end', () => {
    expect(offsetToShow(VIEW, { top: 1140, bottom: 1200 }, MARGIN)).toBe(700)
  })

  it('should never move a list that fits', () => {
    expect(offsetToShow({ ...VIEW, content: 400 }, { top: 340, bottom: 400 }, MARGIN)).toBe(0)
  })

  it('should show the end of a span taller than the view', () => {
    expect(offsetToShow(VIEW, { top: 100, bottom: 800 }, MARGIN)).toBe(320)
  })
})

describe('showFocus', () => {
  const ITEMS: readonly ListItem[] = [
    { top: 0, bottom: 40, isTitle: true },
    { top: 40, bottom: 100, isTitle: false },
    { top: 600, bottom: 640, isTitle: true },
    { top: 640, bottom: 700, isTitle: false },
    { top: 710, bottom: 770, isTitle: false },
  ]
  const sut = { ...VIEW, offset: 300 }

  it('should show the first row of a section under its title', () => {
    expect(showFocus(sut, { items: ITEMS, focused: 1 }, MARGIN)).toStrictEqual({
      ...sut,
      offset: 0,
    })
  })

  it('should show a row whole without the title above the one before it', () => {
    expect(showFocus({ ...sut, offset: 0 }, { items: ITEMS, focused: 4 }, MARGIN)).toStrictEqual({
      ...sut,
      offset: 290,
    })
    expect(showFocus({ ...sut, offset: 700 }, { items: ITEMS, focused: 4 }, MARGIN).offset).toBe(
      690,
    )
  })

  it('should show the title with the row under it, from below', () => {
    expect(showFocus({ ...sut, offset: 700 }, { items: ITEMS, focused: 3 }, MARGIN).offset).toBe(
      580,
    )
  })

  it('should stay without an item in focus', () => {
    expect(showFocus(sut, { items: ITEMS, focused: -1 }, MARGIN)).toBe(sut)
    expect(showFocus(sut, { items: ITEMS, focused: ITEMS.length }, MARGIN)).toBe(sut)
  })
})

describe('isInView', () => {
  const sut = { ...VIEW, offset: 100 }

  it('should take a span whole in view, its edges included', () => {
    expect(isInView(sut, { top: 100, bottom: 600 })).toBe(true)
  })

  it('should leave out a span cut at the top', () => {
    expect(isInView(sut, { top: 99, bottom: 160 })).toBe(false)
  })

  it('should leave out a span cut at the bottom', () => {
    expect(isInView(sut, { top: 560, bottom: 601 })).toBe(false)
  })
})

describe('scrollThumb', () => {
  it('should size the bar by the share in view and shift it by the offset', () => {
    expect(scrollThumb({ ...VIEW, offset: 250 })).toStrictEqual({ size: 500 / 1200, shift: 0.5 })
  })

  it('should have no bar when the list fits', () => {
    expect(scrollThumb({ ...VIEW, content: 500 })).toBeUndefined()
  })

  it('should have no bar before the view is measured', () => {
    expect(scrollThumb({ offset: 0, viewport: 0, content: 0 })).toBeUndefined()
    expect(scrollThumb({ offset: 0, viewport: 0, content: 10 })).toBeUndefined()
  })
})
