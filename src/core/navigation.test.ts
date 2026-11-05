import { describe, expect, it } from 'vitest'

import { START_POSITION } from './grid.ts'
import {
  albumScreen,
  depthOf,
  goBack,
  HOME,
  HOME_ENTRIES,
  Intent,
  monthScreen,
  type Navigation,
  openScreen,
  PRESENT_OPTIONS,
  PresentChoice,
  type Screen,
  ScreenKind,
  startNavigation,
  yearScreen,
} from './navigation.ts'
import { PhotoOrder } from './photo-library.ts'
import { LIBRARY_SOURCE, SourceKind } from './presentation-source.ts'

const ALBUMS: Screen = { kind: ScreenKind.Albums, intent: Intent.Browse }
const TRIP = { id: 'trip', name: 'Trip', photoCount: 3, order: PhotoOrder.NewestFirst }
const MARCH = { key: '2024-03-01', year: 2024, month: 3 }
const YEAR = { year: 2024, months: [MARCH] }
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
  it('should open the albums, the timeline by year, the presentations and their settings', () => {
    expect(HOME_ENTRIES).toStrictEqual([
      { kind: ScreenKind.Albums, intent: Intent.Browse },
      { kind: ScreenKind.Years, intent: Intent.Browse },
      { kind: ScreenKind.Present },
      { kind: ScreenKind.Settings },
    ])
  })
})

describe('PRESENT_OPTIONS', () => {
  it('should present the library at once, or choose an album, a year or a month first', () => {
    expect(PRESENT_OPTIONS).toStrictEqual([
      {
        choice: PresentChoice.Library,
        screen: { kind: ScreenKind.Presentation, source: LIBRARY_SOURCE },
      },
      {
        choice: PresentChoice.Album,
        screen: { kind: ScreenKind.Albums, intent: Intent.PresentAlbum },
      },
      {
        choice: PresentChoice.Year,
        screen: { kind: ScreenKind.Years, intent: Intent.PresentYear },
      },
      {
        choice: PresentChoice.Month,
        screen: { kind: ScreenKind.Years, intent: Intent.PresentMonth },
      },
    ])
  })
})

describe('albumScreen', () => {
  it('should open the photos of the album to browse it', () => {
    expect(albumScreen(TRIP, Intent.Browse)).toStrictEqual({ kind: ScreenKind.Album, album: TRIP })
  })

  it('should present the album chosen to present', () => {
    expect(albumScreen(TRIP, Intent.PresentAlbum)).toStrictEqual({
      kind: ScreenKind.Presentation,
      source: { kind: SourceKind.Album, album: TRIP },
    })
  })
})

describe('yearScreen', () => {
  it('should open the months of the year to browse them', () => {
    expect(yearScreen(YEAR, Intent.Browse)).toStrictEqual({
      kind: ScreenKind.Months,
      year: YEAR,
      intent: Intent.Browse,
    })
  })

  it('should present the year chosen to present', () => {
    expect(yearScreen(YEAR, Intent.PresentYear)).toStrictEqual({
      kind: ScreenKind.Presentation,
      source: { kind: SourceKind.Year, year: YEAR },
    })
  })

  it('should open the months of the year to choose one to present', () => {
    expect(yearScreen(YEAR, Intent.PresentMonth)).toStrictEqual({
      kind: ScreenKind.Months,
      year: YEAR,
      intent: Intent.PresentMonth,
    })
  })
})

describe('monthScreen', () => {
  it('should open the photos of the month to browse them', () => {
    expect(monthScreen(MARCH, Intent.Browse)).toStrictEqual({
      kind: ScreenKind.Month,
      month: MARCH,
    })
  })

  it('should present the month chosen to present', () => {
    expect(monthScreen(MARCH, Intent.PresentMonth)).toStrictEqual({
      kind: ScreenKind.Presentation,
      source: { kind: SourceKind.Month, month: MARCH },
    })
  })
})
