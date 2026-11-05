import type { JSX } from 'preact'

import iconUrl from './assets/mirante-icon.svg'
import markUrl from './assets/mirante-mark.svg'
import { MESSAGES } from './messages.ts'

// The logo of Mirante (scripts/logo/ draws the mark and the icon): the mark alone, small, on the
// screens of the gallery and their states, or with the name, in lowercase: beside the mark, or
// under the icon of the app.
export const LogoLayout = {
  // The mark beside the name: the start screen.
  Inline: 'inline',
  // The icon of the app above the name: the opening of the app.
  Stacked: 'stacked',
} as const

export type LogoLayout = (typeof LogoLayout)[keyof typeof LogoLayout]

export interface MarkProps {
  // Where it stands and how large: a class of styles.css.
  readonly class: string
}

export function Mark(props: MarkProps): JSX.Element {
  return <Decoration url={markUrl} class={props.class} />
}

export interface LogoProps {
  readonly layout: LogoLayout
}

export function Logo({ layout }: LogoProps): JSX.Element {
  const url = layout === LogoLayout.Stacked ? iconUrl : markUrl
  return (
    <span class={`logo logo-${layout}`}>
      <Decoration url={url} class="logo-mark" />
      <span class="logo-name">{MESSAGES.appName}</span>
    </span>
  )
}

interface DecorationProps extends MarkProps {
  readonly url: string
}

// Decoration only: the text next to it says where people are.
function Decoration(props: DecorationProps): JSX.Element {
  return <img class={`mark ${props.class}`} src={props.url} alt="" aria-hidden="true" />
}
