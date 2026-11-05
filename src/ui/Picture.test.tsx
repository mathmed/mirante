import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { Picture } from './Picture.tsx'

const URL = 'https://images.test/thumbnail/a'

describe('Picture', () => {
  it('should load the image from its address', () => {
    render(<Picture url={URL} alt="12 de março de 2024" missingText="Foto indisponível" />)

    const image = screen.getByRole('img', { name: '12 de março de 2024' })
    expect(image.getAttribute('src')).toBe(URL)
    expect(image.getAttribute('decoding')).toBe('async')
  })

  it('should show a text in place of an image that fails', () => {
    render(<Picture url={URL} alt="" missingText="Foto indisponível" />)

    fireEvent.error(screen.getByRole('presentation'))

    expect(screen.queryByRole('presentation')).toBeNull()
    expect(screen.getByText('Foto indisponível')).toBeTruthy()
  })
})
