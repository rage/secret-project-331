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
  const array = Array(n)
  for (let i = 0; i < n; i++) {
    array[i] = i
  }

  const rng = createDeterministicRandom(seed)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }

  return array
}

/**
 * Returns a randomized array with the seed.
 *
 * @see generateRandomOrder
 * @param array Array of items
 * @param seed Seed for randomizer
 * @returns Array sorted with the randomizer
 */
const orderArrayBySeed = (array: [any], seed: number) => {
  const randomOrder = generateRandomOrder(array.length, seed)
  return randomOrder.map((index) => array[index])
}

export { orderArrayBySeed }
