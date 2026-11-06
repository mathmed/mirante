import { render } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { stubLibrary } from '../../test/library-stub.ts'
import { presentationControls } from '../../test/presentation-controls.ts'
import { fakeRemote } from '../../test/remote.ts'
import { BookDensity } from '../core/book-pagination.ts'
import { bookLayouts, planBook } from '../core/book.ts'
import { BookView } from './BookView.tsx'

describe('BookView', () => {
  it('should show nothing of a book without pages', () => {
    const book = planBook([], {
      title: 'Vazio',
      seed: 1,
      density: BookDensity.Normal,
      hasCover: true,
      weights: new Map(),
    })

    const { container } = render(
      <BookView
        book={book}
        layouts={bookLayouts(book)}
        start={{ spread: 0, frame: 0 }}
        library={stubLibrary({})}
        keys={fakeRemote().keys}
        reportError={() => undefined}
        presentation={presentationControls().controls}
        back={() => undefined}
        onOpen={() => undefined}
        onJump={() => undefined}
        onReorganize={() => undefined}
      />,
    )

    expect(container.innerHTML).toBe('<div class="book"></div>')
  })
})
