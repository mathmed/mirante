import { describe, expect, it } from 'vitest'

import { photos } from '../../test/library-stub.ts'
import {
  applyChange,
  type Change,
  ChangeKind,
  type LibraryEdits,
  NO_EDITS,
  revertChange,
  settleCreated,
  visibleAlbum,
  visibleAlbums,
  visiblePhotos,
} from './library-edits.ts'
import { type Album, PhotoOrder } from './photo-library.ts'

const SHOWN = photos('march', 4)
const TRIP: Album = { id: 'trip', name: 'Viagem', photoCount: 4, order: PhotoOrder.OldestFirst }
const FAMILY: Album = {
  id: 'family',
  name: 'Família',
  photoCount: 2,
  order: PhotoOrder.NewestFirst,
}
const NEW: Album = { id: 'new-album-1', name: 'Nova', photoCount: 1, order: PhotoOrder.NewestFirst }

function idsOf(list: readonly { readonly id: string }[]): readonly string[] {
  return list.map((item) => item.id)
}

function applied(...changes: readonly Change[]): LibraryEdits {
  return changes.reduce(applyChange, NO_EDITS)
}

const TRASH: Change = { kind: ChangeKind.Trash, photoIds: ['march-2', 'march-3'] }
const REMOVE: Change = { kind: ChangeKind.RemoveFromAlbum, album: TRIP, photoIds: ['march-1'] }

describe('the photos as the changes leave them', () => {
  it('should leave out the photos sent to the trash, everywhere', () => {
    const sut = applied(TRASH)

    expect(idsOf(visiblePhotos(SHOWN, sut))).toStrictEqual(['march-1', 'march-4'])
    expect(idsOf(visiblePhotos(SHOWN, sut, TRIP.id))).toStrictEqual(['march-1', 'march-4'])
  })

  it('should bring back the photos restored, and those whose trashing failed', () => {
    const restored = applyChange(applied(TRASH), {
      kind: ChangeKind.Restore,
      photoIds: ['march-2'],
    })
    const failed = revertChange(applied(TRASH), TRASH)

    expect(idsOf(visiblePhotos(SHOWN, restored))).toStrictEqual(['march-1', 'march-2', 'march-4'])
    expect(idsOf(visiblePhotos(SHOWN, failed))).toStrictEqual(idsOf(SHOWN))
  })

  it('should hide again photos whose restoring failed', () => {
    const restore: Change = { kind: ChangeKind.Restore, photoIds: ['march-2'] }
    const sut = revertChange(applyChange(applied(TRASH), restore), restore)

    expect(idsOf(visiblePhotos(SHOWN, sut))).toStrictEqual(['march-1', 'march-4'])
  })

  it('should leave the photos taken out of an album out of that album alone', () => {
    const sut = applied(REMOVE)

    expect(idsOf(visiblePhotos(SHOWN, sut, TRIP.id))).toStrictEqual([
      'march-2',
      'march-3',
      'march-4',
    ])
    expect(idsOf(visiblePhotos(SHOWN, sut, FAMILY.id))).toStrictEqual(idsOf(SHOWN))
    expect(idsOf(visiblePhotos(SHOWN, sut))).toStrictEqual(idsOf(SHOWN))
  })

  it('should take more photos out of the same album, and bring back those it failed to', () => {
    const more: Change = { kind: ChangeKind.RemoveFromAlbum, album: TRIP, photoIds: ['march-4'] }
    const sut = applied(REMOVE, more)

    expect(idsOf(visiblePhotos(SHOWN, sut, TRIP.id))).toStrictEqual(['march-2', 'march-3'])
    expect(idsOf(visiblePhotos(SHOWN, revertChange(sut, more), TRIP.id))).toStrictEqual([
      'march-2',
      'march-3',
      'march-4',
    ])
    expect(revertChange(NO_EDITS, more).removed.get(TRIP.id)).toStrictEqual(new Set())
  })

  it('should change nothing on the screen for photos added to an album', () => {
    const add: Change = { kind: ChangeKind.AddToAlbum, album: TRIP, photoIds: ['march-1'] }

    expect(applyChange(NO_EDITS, add)).toBe(NO_EDITS)
    expect(revertChange(NO_EDITS, add)).toBe(NO_EDITS)
  })

  it('should lay the same change twice over a list as once', () => {
    expect(applied(TRASH, TRASH)).toStrictEqual(applied(TRASH))
    expect(applied(REMOVE, REMOVE)).toStrictEqual(applied(REMOVE))
  })
})

describe('the albums as the changes leave them', () => {
  const create: Change = { kind: ChangeKind.CreateAlbum, album: NEW, photoIds: ['march-1'] }

  it('should show an album created before those read, until the read has it', () => {
    const sut = applied(create)
    const created = { ...NEW, id: 'server-id' }
    const settled = settleCreated(sut, NEW, created)

    expect(idsOf(visibleAlbums([TRIP, FAMILY], sut))).toStrictEqual([NEW.id, 'trip', 'family'])
    expect(idsOf(visibleAlbums([TRIP], settled))).toStrictEqual(['server-id', 'trip'])
    expect(idsOf(visibleAlbums([created, TRIP], settled))).toStrictEqual(['server-id', 'trip'])
  })

  it('should show the newest album created first', () => {
    const other = { ...NEW, id: 'new-album-2' }
    const sut = applied(create, { kind: ChangeKind.CreateAlbum, album: other, photoIds: [] })

    expect(idsOf(visibleAlbums([], sut))).toStrictEqual(['new-album-2', NEW.id])
    expect(idsOf(settleCreated(sut, NEW, TRIP).created)).toStrictEqual(['new-album-2', 'trip'])
  })

  it('should take back an album the server did not create', () => {
    const other = { ...NEW, id: 'new-album-2' }
    const both = applied(create, { kind: ChangeKind.CreateAlbum, album: other, photoIds: [] })

    expect(idsOf(visibleAlbums([TRIP], revertChange(both, create)))).toStrictEqual([
      'new-album-2',
      'trip',
    ])
  })

  it('should show an album renamed with its new name, and its old one when that failed', () => {
    const rename: Change = { kind: ChangeKind.RenameAlbum, album: TRIP, name: 'Lisboa' }
    const sut = applied(rename)

    expect(visibleAlbums([TRIP, FAMILY], sut).map((album) => album.name)).toStrictEqual([
      'Lisboa',
      'Família',
    ])
    expect(visibleAlbum(TRIP, sut)).toStrictEqual({ ...TRIP, name: 'Lisboa' })
    expect(visibleAlbum(FAMILY, sut)).toBe(FAMILY)
    expect(visibleAlbum(TRIP, revertChange(sut, rename)).name).toBe('Viagem')
  })

  it('should keep a later name when an earlier rename fails', () => {
    const first: Change = { kind: ChangeKind.RenameAlbum, album: TRIP, name: 'Lisboa' }
    const second: Change = {
      kind: ChangeKind.RenameAlbum,
      album: { ...TRIP, name: 'Lisboa' },
      name: 'Porto',
    }

    expect(visibleAlbum(TRIP, revertChange(applied(first, second), first)).name).toBe('Porto')
    expect(visibleAlbum(TRIP, revertChange(applied(first, second), second)).name).toBe('Lisboa')
  })

  it('should leave out an album deleted, and show it again when that failed', () => {
    const remove: Change = { kind: ChangeKind.DeleteAlbum, album: TRIP }
    const sut = applied(remove)

    expect(idsOf(visibleAlbums([TRIP, FAMILY], sut))).toStrictEqual(['family'])
    expect(idsOf(visibleAlbums([TRIP, FAMILY], revertChange(sut, remove)))).toStrictEqual([
      'trip',
      'family',
    ])
  })

  it('should start without any change', () => {
    expect(NO_EDITS).toStrictEqual({
      trashed: new Set(),
      removed: new Map(),
      created: [],
      renamed: new Map(),
      deleted: new Set(),
    })
    expect(visibleAlbums([TRIP], NO_EDITS)).toStrictEqual([TRIP])
  })
})
