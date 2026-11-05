import type { JSX } from 'preact'

import markUrl from './assets/mirante-mark.svg'
import { MESSAGES } from './messages.ts'

// The logo of Mirante (scripts/logo/ draws the mark): the mark alone, small, on the screens of the
// gallery and their states, or with the name, set in the serif of the titles, widely spaced.
export const LogoLayout = {
  // The mark beside the name: the start screen.
  Inline: 'inline',
  // The mark above the name: the opening of the app.
  Stacked: 'stacked',
} as const

export type LogoLayout = (typeof LogoLayout)[keyof typeof LogoLayout]

export interface MarkProps {
  // Where it stands and how large: a class of styles.css.
  readonly class: string
}

// Decoration only: the text next to it says where people are.
export function Mark(props: MarkProps): JSX.Element {
  return <img class={`mark ${props.class}`} src={markUrl} alt="" aria-hidden="true" />
}

export interface LogoProps {
  readonly layout: LogoLayout
}

export function Logo({ layout }: LogoProps): JSX.Element {
  return (
    <span class={`logo logo-${layout}`}>
      <Mark class="logo-mark" />
      <span class="logo-name">{MESSAGES.appName}</span>
    </span>
  )
}
