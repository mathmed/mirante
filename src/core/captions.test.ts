import { describe, expect, it } from 'vitest'

import { CAPTION_CACHE_SIZE, createCaptionCache } from './captions.ts'

interface Reads {
  readonly asked: string[]
  readonly reported: unknown[]
  readonly read: (photoId: string) => Promise<string | undefined>
}

function reads(answer: (photoId: string) => Promise<string | undefined>): Reads {
  const asked: string[] = []
  return {
    asked,
    reported: [],
    read: async (photoId) => {
      asked.push(photoId)
      return answer(photoId)
    },
  }
}

const CAPTIONS = async (photoId: string): Promise<string | undefined> =>
  Promise.resolve(photoId === 'none' ? undefined : `Legenda de ${photoId}`)

describe('createCaptionCache', () => {
  it('should read the caption of a photo, or none', async () => {
    const library = reads(CAPTIONS)
    const sut = createCaptionCache(library.read, (error) => library.reported.push(error))

    expect(await sut.captionOf('p-1')).toBe('Legenda de p-1')
    expect(await sut.captionOf('none')).toBeUndefined()
  })

  it('should read a photo once, while it is asked for again and after', async () => {
    const library = reads(CAPTIONS)
    const sut = createCaptionCache(library.read, (error) => library.reported.push(error))

    const first = sut.captionOf('p-1')
    const second = sut.captionOf('p-1')

    expect(await Promise.all([first, second])).toStrictEqual(['Legenda de p-1', 'Legenda de p-1'])
    expect(await sut.captionOf('p-1')).toBe('Legenda de p-1')
    expect(library.asked).toStrictEqual(['p-1'])
  })

  it('should forget the photo asked for the longest ago once it is full', async () => {
    const library = reads(CAPTIONS)
    const sut = createCaptionCache(library.read, (error) => library.reported.push(error))
    const ids = [...Array(CAPTION_CACHE_SIZE).keys()].map((index) => `p-${String(index)}`)

    for (const id of ids) {
      await sut.captionOf(id)
    }
    await sut.captionOf('p-0')
    await sut.captionOf('p-new')
    await sut.captionOf('p-0')
    await sut.captionOf('p-1')

    expect(CAPTION_CACHE_SIZE).toBe(6)
    expect(library.asked).toStrictEqual([...ids, 'p-new', 'p-1'])
  })

  it('should give no caption for a read that fails, log it, and read it again later', async () => {
    const error = new Error('unreachable')
    let isFailing = true
    const library = reads(async (photoId) =>
      isFailing ? Promise.reject(error) : CAPTIONS(photoId),
    )
    const sut = createCaptionCache(library.read, (cause) => library.reported.push(cause))

    expect(await sut.captionOf('p-1')).toBeUndefined()
    isFailing = false
    expect(await sut.captionOf('p-1')).toBe('Legenda de p-1')
    expect(library.reported).toStrictEqual([error])
    expect(library.asked).toStrictEqual(['p-1', 'p-1'])
  })

  it('should keep a newer read of a photo when an older one fails', async () => {
    const error = new Error('unreachable')
    const pending: ((caption: string) => void)[] = []
    const rejections: ((reason: Error) => void)[] = []
    const library = reads(
      async () =>
        new Promise<string>((resolve, reject) => {
          pending.push(resolve)
          rejections.push(reject)
        }),
    )
    const sut = createCaptionCache(library.read, (cause) => library.reported.push(cause))

    const failed = sut.captionOf('p-1')
    for (const index of [...Array(CAPTION_CACHE_SIZE).keys()]) {
      void sut.captionOf(`other-${String(index)}`)
    }
    const newer = sut.captionOf('p-1')
    rejections[0]?.(error)
    await failed
    pending[CAPTION_CACHE_SIZE + 1]?.('Legenda nova')

    expect(await newer).toBe('Legenda nova')
    expect(await sut.captionOf('p-1')).toBe('Legenda nova')
    expect(library.asked.filter((id) => id === 'p-1')).toHaveLength(2)
  })
})
