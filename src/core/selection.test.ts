import { describe, expect, it } from 'vitest'

import { photos } from '../../test/library-stub.ts'
import {
  isSelected,
  NO_SELECTION,
  selectedPhotos,
  STARTED_SELECTION,
  toggleSelected,
} from './selection.ts'

const SHOWN = photos('march', 5)

describe('the selection of a grid', () => {
  it('should start empty, active or not', () => {
    expect(NO_SELECTION).toStrictEqual({ isActive: false, ids: new Set() })
    expect(STARTED_SELECTION).toStrictEqual({ isActive: true, ids: new Set() })
  })

  it('should mark a photo, and unmark it on a second press', () => {
    const sut = toggleSelected(STARTED_SELECTION, 'march-2')

    expect(sut).toStrictEqual({ isActive: true, ids: new Set(['march-2']) })
    expect(isSelected(sut, 'march-2')).toBe(true)
    expect(isSelected(sut, 'march-3')).toBe(false)
    expect(toggleSelected(sut, 'march-2')).toStrictEqual({ isActive: true, ids: new Set() })
    expect(STARTED_SELECTION.ids.size).toBe(0)
  })

  it('should start selecting with the first mark', () => {
    expect(toggleSelected(NO_SELECTION, 'march-1').isActive).toBe(true)
  })

  it('should give the photos marked in the order of the grid, without those gone', () => {
    const marked = ['march-4', 'gone', 'march-1'].reduce(toggleSelected, STARTED_SELECTION)

    expect(selectedPhotos(marked, SHOWN).map((photo) => photo.id)).toStrictEqual([
      'march-1',
      'march-4',
    ])
  })
})
