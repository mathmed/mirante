import { fireEvent, render } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { Backdrop } from './Backdrop.tsx'

const URL = 'https://images.test/preview/cover'

function photo(): HTMLImageElement {
  const image = document.querySelector<HTMLImageElement>('.backdrop-photo')
  if (image === null) {
    throw new Error('no photo behind the screen')
  }
  return image
}

describe('Backdrop', () => {
  it('should load the photo hidden, out of the reading of the screen', () => {
    render(<Backdrop url={URL} />)

    expect(photo().getAttribute('src')).toBe(URL)
    expect(photo().getAttribute('alt')).toBe('')
    expect(document.querySelector('.backdrop')?.className).toBe('backdrop')
    expect(document.querySelector('.backdrop')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('should fade the photo in once it loads', () => {
    render(<Backdrop url={URL} />)

    fireEvent.load(photo())

    expect(document.querySelector('.backdrop')?.className).toBe('backdrop is-shown')
  })

  it('should leave the plain background when the photo fails', () => {
    render(<Backdrop url={URL} />)

    fireEvent.error(photo())

    expect(document.querySelector('.backdrop')).toBeNull()
  })
})
