import { cleanup } from '@testing-library/preact'
import { afterAll, afterEach, beforeAll } from 'vitest'

import { fakeServer } from './fake-immich.ts'

beforeAll(() => {
  fakeServer.listen({ onUnhandledFrame: 'error' })
})

afterEach(() => {
  cleanup()
  fakeServer.resetHandlers()
})

afterAll(() => {
  fakeServer.close()
})
