// The first item of a list, or this one when the list is empty.
export function firstOr<T>(items: readonly T[], fallback: T): T {
  return items[0] ?? fallback
}

// The items of two lists side by side, as far as the shorter one goes.
export function zipWith<A, B, R>(
  first: readonly A[],
  second: readonly B[],
  combine: (one: A, other: B) => R,
): readonly R[] {
  const others = second[Symbol.iterator]()
  const combined: R[] = []
  for (const one of first) {
    const other = others.next()
    if (other.done === true) {
      return combined
    }
    combined.push(combine(one, other.value))
  }
  return combined
}
