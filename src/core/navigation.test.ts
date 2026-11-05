import { describe, expect, it } from 'vitest'

import { START_POSITION } from './grid.ts'
import {
  depthOf,
  goBack,
  HOME,
  HOME_ENTRIES,
  type Navigation,
  openScreen,
  type Screen,
  ScreenKind,
  startNavigation,
} from './navigation.ts'
import { PhotoOrder } from './photo-library.ts'

const ALBUMS: Screen = { kind: ScreenKind.Albums }
const ALBUM: Screen = {
  kind: ScreenKind.Album,
  album: { id: 'trip', name: 'Trip', photoCount: 3, order: PhotoOrder.NewestFirst },
}
const ON_ALBUMS = { focus: 1, topRow: 0 }
const ON_TRIP = { focus: 14, topRow: 2 }

function opened(): Navigation {
  const onAlbums = openScreen(startNavigation(), { depth: 0, position: ON_ALBUMS }, ALBUMS)
  return openScreen(onAlbums, { depth: 1, position: ON_TRIP }, ALBUM)
}

describe('startNavigation', () => {
  it('should start on the start screen with the focus on its first item', () => {
    const sut = startNavigation()

    expect(sut.current).toStrictEqual({ screen: HOME, position: START_POSITION })
    expect(depthOf(sut)).toBe(0)
  })
})

describe('openScreen', () => {
  it('should open the screen on top with the focus on its first item', () => {
    const sut = opened()

    expect(sut.current).toStrictEqual({ screen: ALBUM, position: START_POSITION })
    expect(depthOf(sut)).toBe(2)
  })

  it('should remember where the focus was on each screen below', () => {
    expect(opened().below).toStrictEqual([
      { screen: HOME, position: ON_ALBUMS },
      { screen: ALBUMS, position: ON_TRIP },
    ])
  })

  it('should ignore a screen that is no longer on top', () => {
    const navigation = opened()

    expect(openScreen(navigation, { depth: 1, position: ON_TRIP }, ALBUM)).toBe(navigation)
    expect(openScreen(navigation, { depth: 3, position: ON_TRIP }, ALBUM)).toBe(navigation)
  })
})

describe('goBack', () => {
  it('should return to the screen below with the focus where it was', () => {
    const sut = goBack(opened(), 2)

    expect(sut.current).toStrictEqual({ screen: ALBUMS, position: ON_TRIP })
    expect(depthOf(sut)).toBe(1)
  })

  it('should walk back to the start screen', () => {
    const sut = goBack(goBack(opened(), 2), 1)

    expect(sut).toStrictEqual({ current: { screen: HOME, position: ON_ALBUMS }, below: [] })
  })

  it('should stay on the start screen', () => {
    const navigation = startNavigation()

    expect(goBack(navigation, 0)).toBe(navigation)
  })

  it('should ignore a Back from a screen that is no longer on top', () => {
    const navigation = opened()

    expect(goBack(navigation, 1)).toBe(navigation)
    expect(goBack(navigation, 3)).toBe(navigation)
  })
})

describe('HOME_ENTRIES', () => {
  it('should open the albums, then the timeline by year', () => {
    expect(HOME_ENTRIES.map((entry) => entry.kind)).toStrictEqual([
      ScreenKind.Albums,
      ScreenKind.Years,
    ])
  })
})
