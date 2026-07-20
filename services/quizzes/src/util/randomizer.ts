/**
 * Create a deterministic random number generator
 *
 * https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
 *
 * @param seed Seed for deterministic random number generator
 * @returns Random number generator with given seed
 */
const createDeterministicRandom = (seed: number) => {
  return () => {
    // Robert Jenkins’ 32 bit integer hash function
    seed = (seed + 0x7ed55d16 + (seed << 12)) & 0xffffffff
    seed = (seed ^ 0xc761c23c ^ (seed >>> 19)) & 0xffffffff
    seed = (seed + 0x165667b1 + (seed << 5)) & 0xffffffff
    seed = ((seed + 0xd3a2646c) ^ (seed << 9)) & 0xffffffff
    seed = (seed + 0xfd7046c5 + (seed << 3)) & 0xffffffff
    seed = (seed ^ 0xb55a4f09 ^ (seed >>> 16)) & 0xffffffff
    return (seed & 0xfffffff) / 0x10000000
  }
}

/**
 * Generate random order by using Robert Jenkins’ 32 bit hash function
 * and shuffling them with Durstenfeld shuffle.
 *
 * https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
 *
 * @see createDeterministicRandom
 * @param n Number of items in array
 * @param seed Seed for RNG
 * @returns Random ordering
 */
const generateRandomOrder = (n: number, seed: number) => {
  const array = Array.from({ length: n }, (_, i) => i)

  const rng = createDeterministicRandom(seed)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    // i and j are always valid indices within the array bounds
    const ai = array[i]
    const aj = array[j]
    if (ai === undefined || aj === undefined) {
      continue
    }
    array[i] = aj
    array[j] = ai
  }

  return array
}

/**
 * Returns a randomized array
 *
 * @see generateRandomOrder
 * @param array Array of items
 * @param seed Seed for randomizer
 * @returns Array sorted with the randomizer
 */
const orderArrayBySeed = <T>(array: T[], seed: number): T[] => {
  const randomOrder = generateRandomOrder(array.length, seed)
  // randomOrder is a permutation of valid indices into array
  return randomOrder.map((index) => array[index] as T)
}

/**
 * Returns a randomized array
 *
 * @param array Array of items
 * @param pseudonymId Pseudonymous ID
 * @returns Array sorted with the randomizer
 */
const orderArrayWithId = <T>(array: T[], pseudonymId: string): T[] => {
  const seed = pseudonymId
    .split("")
    .map((chr, idx) => {
      let val = Math.pow((chr.codePointAt(0) ?? 0) * 31, pseudonymId.length - idx)
      val &= val
      return val
    })
    .reduce((a, b) => a + b)

  return orderArrayBySeed(array, seed)
}

export { orderArrayWithId }
