import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

import { commitChange } from '../core/edit-commit.ts'
import {
  CHECKING_ACCESS,
  type EditAccess,
  editAccessOf,
  FAILED_ACCESS,
  type LibraryEditor,
} from '../core/library-editor.ts'
import { type Change, ChangeKind, type LibraryEdits, NO_EDITS } from '../core/library-edits.ts'
import { LoadStatus, runLoad } from '../core/loading.ts'
import type { PhotoDate } from '../core/photo-library.ts'
import { doneText, failedText } from './edit-messages.ts'

// How long a notice stays on the screen, and how long the photos just deleted can come back.
const NOTICE_MS = 6000
const UNDO_MS = 30_000

// What a change said, at the bottom of the screen.
export interface Notice {
  readonly text: string
  readonly isError: boolean
}

// The changes of the visit, kept by the gallery and shared by every screen.
export interface EditingControls {
  readonly access: EditAccess
  readonly edits: LibraryEdits
  // Whether photos went to the trash a moment ago, and can come back (once).
  readonly canUndo: boolean
  // Shows the change at once and asks the server; resolves to whether the server took it.
  readonly commit: (change: Change) => Promise<boolean>
  readonly undo: () => void
  readonly notify: (text: string) => void
  readonly notice: Notice | undefined
  // A new number for each album on its way to the server.
  readonly nextSerial: () => number
  // The day on the TV's clock, which names a new album of photos of many months.
  readonly today: () => PhotoDate
}

export function useEditing(
  editor: LibraryEditor,
  reportError: (error: unknown) => void,
  today: () => PhotoDate,
): EditingControls {
  const access = useAccess(editor, reportError)
  const [edits, setEdits] = useState(NO_EDITS)
  const notices = useNotice()
  const [undoable, setUndoable] = useTimed<readonly string[]>(UNDO_MS)
  const commit = useCommit({ editor, reportError, setEdits, notices, setUndoable })
  const undo = useUndo(undoable, setUndoable, commit)
  const { notice, notify } = notices
  const canUndo = undoable !== undefined
  return { access, edits, canUndo, commit, undo, notify, notice, nextSerial: useSerial(), today }
}

interface CommitOptions {
  readonly editor: LibraryEditor
  readonly reportError: (error: unknown) => void
  readonly setEdits: (next: (edits: LibraryEdits) => LibraryEdits) => void
  readonly notices: NoticeControls
  readonly setUndoable: (photoIds: readonly string[] | undefined) => void
}

// Each change says what happened, or what failed; photos sent to the trash can come back a while.
function useCommit(options: CommitOptions): (change: Change) => Promise<boolean> {
  const { editor, reportError, setEdits, notices, setUndoable } = options
  const { notify, warn } = notices
  return useCallback(
    async (change: Change): Promise<boolean> => {
      const outcome = await commitChange(editor, change, { update: setEdits, reportError })
      if (outcome.status === LoadStatus.Failed) {
        warn(failedText(change, outcome.failure))
        return false
      }
      notify(doneText(change))
      setUndoable(change.kind === ChangeKind.Trash ? change.photoIds : undefined)
      return true
    },
    [editor, reportError, setEdits, notify, warn, setUndoable],
  )
}

// The photos just deleted come back, once: a double press restores them once.
function useUndo(
  undoable: readonly string[] | undefined,
  setUndoable: (photoIds: readonly string[] | undefined) => void,
  commit: (change: Change) => Promise<boolean>,
): () => void {
  const undoneRef = useRef<readonly string[] | undefined>(undefined)
  return useCallback(() => {
    if (undoable === undefined || undoable === undoneRef.current) {
      return
    }
    undoneRef.current = undoable
    setUndoable(undefined)
    void commit({ kind: ChangeKind.Restore, photoIds: undoable })
  }, [undoable, setUndoable, commit])
}

function useSerial(): () => number {
  const serialRef = useRef(0)
  return useCallback(() => {
    serialRef.current += 1
    return serialRef.current
  }, [])
}

// What this installation may change, asked of the server once a visit.
function useAccess(editor: LibraryEditor, reportError: (error: unknown) => void): EditAccess {
  const [access, setAccess] = useState(CHECKING_ACCESS)
  useEffect(() => {
    void runLoad(editor.readGrant, reportError).then((outcome) => {
      setAccess(outcome.status === LoadStatus.Loaded ? editAccessOf(outcome.value) : FAILED_ACCESS)
    })
  }, [editor, reportError])
  return access
}

interface NoticeControls {
  readonly notice: Notice | undefined
  readonly notify: (text: string) => void
  readonly warn: (text: string) => void
}

function useNotice(): NoticeControls {
  const [notice, setNotice] = useTimed<Notice>(NOTICE_MS)
  const notify = useCallback(
    (text: string) => {
      setNotice({ text, isError: false })
    },
    [setNotice],
  )
  const warn = useCallback(
    (text: string) => {
      setNotice({ text, isError: true })
    },
    [setNotice],
  )
  return { notice, notify, warn }
}

// A value that goes away by itself a while after it is set; a new one starts the while over.
function useTimed<T>(lastingMs: number): [T | undefined, (value: T | undefined) => void] {
  const [value, setValue] = useState<T | undefined>(undefined)
  useEffect(() => {
    if (value === undefined) {
      return undefined
    }
    const timer = setTimeout(() => {
      setValue(undefined)
    }, lastingMs)
    return () => {
      clearTimeout(timer)
    }
  }, [value, lastingMs])
  return [value, setValue]
}
