import { render, screen } from '@testing-library/preact'
import { useState } from 'preact/hooks'
import { describe, expect, it } from 'vitest'

import { fakeRemote, type FakeRemote } from '../../test/remote.ts'
import { type GridPosition, START_POSITION } from '../core/grid.ts'
import { RemoteKey } from '../core/remote-key.ts'
import { Grid } from './Grid.tsx'

// 6 columns, 3 rows on the screen: 18 cells, and a row more below while the first row is on top.
const SHAPE = { columns: 6, visibleRows: 3 }
const ITEMS = [...Array(100).keys()].map((index) => `item-${String(index)}`)

interface Recorded {
  readonly remote: FakeRemote
  readonly opened: [string, GridPosition][]
  readonly backs: () => number
}

function renderGrid(items = ITEMS, start: GridPosition = START_POSITION): Recorded {
  const remote = fakeRemote()
  const opened: [string, GridPosition][] = []
  let backs = 0
  function Harness(): ReturnType<typeof Grid> {
    const [position, setPosition] = useState(start)
    return (
      <Grid
        label="Itens"
        variant="photos"
        items={items}
        shape={SHAPE}
        position={position}
        keys={remote.keys}
        keyOf={(item) => item}
        renderTile={(item) => <span>{item}</span>}
        onMove={setPosition}
        onOpen={(item, from) => opened.push([item, from])}
        onBack={() => {
          backs += 1
        }}
      />
    )
  }
  render(<Harness />)
  return { remote, opened, backs: () => backs }
}

function cells(): HTMLElement[] {
  return screen.getAllByRole('listitem')
}

function focusedText(): string | null | undefined {
  return document.activeElement?.textContent
}

describe('Grid', () => {
  it('should render the rows on the screen and one row below, never the whole list', () => {
    renderGrid()

    expect(cells()).toHaveLength(24)
    expect(screen.queryByText('item-24')).toBeNull()
  })

  it('should hide the row below the screen while its images load', () => {
    renderGrid()

    expect(screen.getByText('item-17').closest('li')?.className).toBe('cell')
    expect(screen.getByText('item-18').closest('li')?.className).toBe('cell cell-offscreen')
  })

  it('should place each cell with a transform', () => {
    renderGrid()

    const style = screen.getByText('item-7').closest('li')?.getAttribute('style')

    expect(style).toContain('translate(100%, 100%)')
    expect(style).toContain('width: 16.6666')
    expect(style).toContain('height: 33.3333')
  })

  it('should give the browser focus to the first item', () => {
    renderGrid()

    expect(focusedText()).toBe('item-0')
    expect(screen.getByText('item-0').closest('li')?.getAttribute('aria-current')).toBe('true')
  })

  it('should move the focus with the arrows', () => {
    const sut = renderGrid()

    sut.remote.press(RemoteKey.Right, RemoteKey.Right, RemoteKey.Down, RemoteKey.Left)

    expect(focusedText()).toBe('item-7')
  })

  it('should scroll down and drop the rows that left, unloading their images', () => {
    const sut = renderGrid()

    sut.remote.press(RemoteKey.Down, RemoteKey.Down, RemoteKey.Down, RemoteKey.Down)

    expect(focusedText()).toBe('item-24')
    expect(screen.queryByText('item-5')).toBeNull()
    expect(screen.getByText('item-6').closest('li')?.className).toBe('cell cell-offscreen')
    expect(cells()).toHaveLength(30)
  })

  it('should open the focused item with where the focus is', () => {
    const sut = renderGrid()

    sut.remote.press(
      RemoteKey.Down,
      RemoteKey.Down,
      RemoteKey.Down,
      RemoteKey.Right,
      RemoteKey.Enter,
    )

    expect(sut.opened).toStrictEqual([['item-19', { focus: 19, topRow: 1 }]])
  })

  it('should go back on Back', () => {
    const sut = renderGrid()

    sut.remote.press(RemoteKey.Back)

    expect(sut.backs()).toBe(1)
    expect(sut.opened).toStrictEqual([])
  })

  it('should start where the focus was left, with its rows on the screen', () => {
    renderGrid(ITEMS, { focus: 50, topRow: 7 })

    expect(focusedText()).toBe('item-50')
    expect(screen.getByText('item-42').closest('li')?.className).toBe('cell')
  })

  it('should bring a focus past the last item back to it', () => {
    renderGrid(ITEMS.slice(0, 5), { focus: 50, topRow: 7 })

    expect(focusedText()).toBe('item-4')
  })

  it('should open nothing in an empty grid', () => {
    const sut = renderGrid([])

    sut.remote.press(RemoteKey.Down, RemoteKey.Enter)

    expect(sut.opened).toStrictEqual([])
  })
})
