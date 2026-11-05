import { render, screen } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { Logo, LogoLayout, Mark } from './Logo.tsx'
import { MESSAGES } from './messages.ts'

describe('Logo', () => {
  it.each(Object.values(LogoLayout))(
    'should set the name of the app beside the mark (%s)',
    (layout) => {
      render(
        <h1>
          <Logo layout={layout} />
        </h1>,
      )

      expect(screen.getByRole('heading', { name: MESSAGES.appName })).toBeTruthy()
      expect(document.querySelector('.logo')?.className).toBe(`logo logo-${layout}`)
      expect(document.querySelector('.logo-mark')).not.toBeNull()
    },
  )
})

describe('Mark', () => {
  it('should draw the mark of the app as a decoration nobody reads', () => {
    render(<Mark class="screen-mark" />)

    const sut = document.querySelector('img')
    expect(sut?.className).toBe('mark screen-mark')
    expect(sut?.getAttribute('src')).toMatch(/^data:image\/svg\+xml,.*MIRANTE/)
    expect(sut?.getAttribute('alt')).toBe('')
    expect(sut?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.queryAllByRole('img')).toStrictEqual([])
  })
})
