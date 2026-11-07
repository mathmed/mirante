import type { JSX } from 'preact'
import { useCallback, useMemo, useState } from 'preact/hooks'

import { pickableAlbums } from '../core/album-picker.ts'
import { loadAlbums } from '../core/gallery.ts'
import type { LibraryEdits } from '../core/library-edits.ts'
import { Axis } from '../core/line-focus.ts'
import { type LoadState, LoadStatus } from '../core/loading.ts'
import type { Album, PhotoLibrary } from '../core/photo-library.ts'
import type { KeySource } from '../core/remote-key.ts'
import { type Choice, ChoiceLine } from './ChoiceLine.tsx'
import { EDIT_MESSAGES, pickTitle } from './edit-messages.ts'
import { photoCountText, shortText } from './messages.ts'
import { Overlay } from './Overlay.tsx'
import { useLibraryLoad } from './use-load.ts'

// The items of the list on the screen at once, whatever the number of albums.
const VISIBLE_ITEMS = 7
// What fits on one line of an item.
const NAME_LENGTH = 40
const NEW_ALBUM = 0

export interface AlbumPickerProps {
  readonly library: PhotoLibrary
  readonly edits: LibraryEdits
  // The album the photos are in, left out of the list.
  readonly currentAlbumId: string | undefined
  // How many photos are added.
  readonly count: number
  readonly keys: KeySource
  readonly reportError: (error: unknown) => void
  readonly onPick: (album: Album) => void
  readonly onNew: () => void
  readonly onCancel: () => void
}

// Where the photos go: "Novo álbum" first, ready at once, then the albums as they load, the most
// recent first. Up and Down choose, Enter adds, Back cancels.
export function AlbumPicker(props: AlbumPickerProps): JSX.Element {
  const { keys, onPick, onNew } = props
  const { state, albums } = usePickable(props)
  const [focus, setFocus] = useState(NEW_ALBUM)
  const title = pickTitle(props.count)
  return (
    <Overlay title={title} keysText={EDIT_MESSAGES.pickKeys}>
      <ChoiceLine
        label={title}
        choices={[{ key: 'new', text: EDIT_MESSAGES.newAlbum }, ...albums.map(choiceOf)]}
        axis={Axis.Column}
        visible={VISIBLE_ITEMS}
        focus={focus}
        keys={keys}
        onMove={setFocus}
        onChoose={(index) => {
          const album = albums[index - 1]
          if (album === undefined) {
            onNew()
          } else {
            onPick(album)
          }
        }}
        onLeave={() => undefined}
        onBack={props.onCancel}
      />
      <StateLine state={state} />
    </Overlay>
  )
}

interface Pickable {
  readonly state: LoadState<readonly Album[]>
  readonly albums: readonly Album[]
}

function usePickable(props: AlbumPickerProps): Pickable {
  const { library, edits, currentAlbumId, reportError } = props
  const task = useCallback(async () => loadAlbums(library), [library])
  const { state } = useLibraryLoad(task, reportError)
  const albums = useMemo(
    () => pickableAlbums(loadedOf(state), edits, currentAlbumId),
    [state, edits, currentAlbumId],
  )
  return { state, albums }
}

function loadedOf(state: LoadState<readonly Album[]>): readonly Album[] {
  return state.status === LoadStatus.Loaded ? state.value : []
}

function choiceOf(album: Album): Choice {
  return {
    key: album.id,
    text: shortText(album.name, NAME_LENGTH),
    detail: photoCountText(album.photoCount),
  }
}

interface StateLineProps {
  readonly state: LoadState<readonly Album[]>
}

// While the albums load, or when they could not: "Novo álbum" works meanwhile.
function StateLine({ state }: StateLineProps): JSX.Element | null {
  if (state.status === LoadStatus.Loaded) {
    return null
  }
  const text =
    state.status === LoadStatus.Loading ? EDIT_MESSAGES.loadingAlbums : EDIT_MESSAGES.albumsFailed
  return <p class="overlay-hint">{text}</p>
}
