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
      expect(document.querySelector('.logo-mark')?.getAttribute('aria-hidden')).toBe('true')
    },
  )

  it('should open the app with its icon above the name, and set the mark beside it elsewhere', () => {
    render(<Logo layout={LogoLayout.Stacked} />)
    render(<Logo layout={LogoLayout.Inline} />)

    const [icon, mark] = [...document.querySelectorAll('.logo-mark')].map((image) =>
      decodeURIComponent(image.getAttribute('src') ?? ''),
    )
    expect(icon).toContain('<rect ')
    expect(mark).not.toContain('<rect ')
    expect(mark).toContain('<title>Mirante</title>')
  })
})

describe('Mark', () => {
  it('should draw the mark of the app as a decoration nobody reads', () => {
    render(<Mark class="screen-mark" />)

    const sut = document.querySelector('img')
    expect(sut?.className).toBe('mark screen-mark')
    expect(sut?.getAttribute('src')).toMatch(/^data:image\/svg\+xml,.*Mirante/)
    expect(sut?.getAttribute('alt')).toBe('')
    expect(sut?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.queryAllByRole('img')).toStrictEqual([])
  })
})
