import { describe, expect, it } from 'vitest'

import {
  AccessBlock,
  canEdit,
  CHECKING_ACCESS,
  editAccessOf,
  EditPermission,
  FAILED_ACCESS,
} from './library-editor.ts'

const ALL = new Set(Object.values(EditPermission))

function allBut(permission: EditPermission): ReadonlySet<EditPermission> {
  return new Set([...ALL].filter((candidate) => candidate !== permission))
}

describe('editAccessOf', () => {
  it('should allow everything to a key with every permission, on a server with a trash', () => {
    const sut = editAccessOf({ permissions: ALL, isTrashKept: true })

    expect(sut).toStrictEqual({ albums: undefined, trash: undefined })
  })

  it('should allow nothing without a key for the changes', () => {
    const sut = editAccessOf({ permissions: undefined, isTrashKept: true })

    expect(sut).toStrictEqual({ albums: AccessBlock.NoKey, trash: AccessBlock.NoKey })
  })

  it('should refuse to delete on a server that deletes for good', () => {
    const sut = editAccessOf({ permissions: ALL, isTrashKept: false })

    expect(sut).toStrictEqual({ albums: undefined, trash: AccessBlock.TrashOff })
  })

  it('should refuse to delete to a key that may not, whatever the trash', () => {
    const permissions = allBut(EditPermission.Trash)

    expect(editAccessOf({ permissions, isTrashKept: true })).toStrictEqual({
      albums: undefined,
      trash: AccessBlock.MissingPermission,
    })
    expect(editAccessOf({ permissions, isTrashKept: false }).trash).toBe(
      AccessBlock.MissingPermission,
    )
  })

  it.each([
    EditPermission.CreateAlbum,
    EditPermission.RenameAlbum,
    EditPermission.DeleteAlbum,
    EditPermission.AddToAlbum,
    EditPermission.RemoveFromAlbum,
  ])('should refuse the albums to a key without %s', (permission) => {
    const sut = editAccessOf({ permissions: allBut(permission), isTrashKept: true })

    expect(sut).toStrictEqual({ albums: AccessBlock.MissingPermission, trash: undefined })
  })

  it('should allow the albums alone to a key that may only manage them', () => {
    const sut = editAccessOf({ permissions: allBut(EditPermission.Trash), isTrashKept: true })

    expect(canEdit(sut)).toBe(true)
  })
})

describe('canEdit', () => {
  it('should tell whether anything at all can change', () => {
    expect(canEdit({ albums: undefined, trash: AccessBlock.TrashOff })).toBe(true)
    expect(canEdit({ albums: AccessBlock.MissingPermission, trash: undefined })).toBe(true)
    expect(canEdit(CHECKING_ACCESS)).toBe(false)
    expect(canEdit(FAILED_ACCESS)).toBe(false)
  })

  it('should block both kinds of change while checking, and after a failed check', () => {
    expect(CHECKING_ACCESS).toStrictEqual({
      albums: AccessBlock.Checking,
      trash: AccessBlock.Checking,
    })
    expect(FAILED_ACCESS).toStrictEqual({
      albums: AccessBlock.CheckFailed,
      trash: AccessBlock.CheckFailed,
    })
  })
})
