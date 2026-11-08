import type { JSX } from 'preact'

import type { Notice as NoticeState } from './use-editing.ts'

export interface NoticeProps {
  readonly notice: NoticeState | undefined
}

// What a change said, at the bottom of the screen for a while, over whatever screen is on top.
export function Notice({ notice }: NoticeProps): JSX.Element | null {
  if (notice === undefined) {
    return null
  }
  return (
    <div
      class={notice.isError ? 'notice is-error' : 'notice'}
      role={notice.isError ? 'alert' : 'status'}
    >
      <span class="notice-text">{notice.text}</span>
    </div>
  )
}
