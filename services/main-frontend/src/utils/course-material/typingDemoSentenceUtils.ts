/**
 * Represents the difference between two sentences, broken down into:
 * - prefix: The common part at the start
 * - incorrectPart: The differing part in the incorrect sentence
 * - correctPart: The differing part in the correct sentence
 * - suffix: The common part at the end
 */
interface SentenceDifference {
  prefix: string
  incorrectPart: string
  correctPart: string
  suffix: string
}

/**
 * Given two sentences that differ by one part, extracts the common prefix, the differing parts, and the common suffix.
 *
 * This function compares the sentences character by character from both start and end to find the differing section.
 * If the difference is too large (more than 50% of the sentence), it will fall back to using the provided fallback strings.
 *
 * Example: For "The small fox" and "The quick fox", it will return:
 * - prefix: "The "
 * - incorrectPart: "small"
 * - correctPart: "quick"
 * - suffix: " fox"
 *
 * @param incorrectSentence The sentence with the error
 * @param correctSentence The corrected sentence
 * @param fallbackIncorrect The English/fallback incorrect sentence to use if the difference is too large
 * @param fallbackCorrect The English/fallback correct sentence to use if the difference is too large
 * @returns Object containing prefix, incorrectPart, correctPart, and suffix
 */
export const parseSentenceDifference = (
  incorrectSentence: string,
  correctSentence: string,
  fallbackIncorrect: string,
  fallbackCorrect: string,
): SentenceDifference => {
  // Skip analysis and use fallbacks directly if we're already working with fallbacks
  if (incorrectSentence === fallbackIncorrect && correctSentence === fallbackCorrect) {
    return findDifference(incorrectSentence, correctSentence)
  }

  // Handle empty strings by falling back to English examples
  if (incorrectSentence === "" || correctSentence === "") {
    return parseSentenceDifference(
      fallbackIncorrect,
      fallbackCorrect,
      fallbackIncorrect,
      fallbackCorrect,
    )
  }

  // Handle identical sentences by falling back to English examples
  if (incorrectSentence === correctSentence) {
    return parseSentenceDifference(
      fallbackIncorrect,
      fallbackCorrect,
      fallbackIncorrect,
      fallbackCorrect,
    )
  }

  try {
    // Find the difference between the sentences
    const result: SentenceDifference = findDifference(incorrectSentence, correctSentence)

    // Check if the difference is too large (more than 50% of either sentence)
    const incorrectLength: number = incorrectSentence.length
    const correctLength: number = correctSentence.length
    const maxLength: number = Math.max(incorrectLength, correctLength)

    if (
      result.incorrectPart.length > maxLength * 0.5 ||
      result.correctPart.length > maxLength * 0.5
    ) {
      // Difference is too large, use fallback
      return parseSentenceDifference(
        fallbackIncorrect,
        fallbackCorrect,
        fallbackIncorrect,
        fallbackCorrect,
      )
    }

    return result
  } catch (error) {
    console.error("Error parsing example sentence difference:", error)
    // In case of errors, fall back to English
    return parseSentenceDifference(
      fallbackIncorrect,
      fallbackCorrect,
      fallbackIncorrect,
      fallbackCorrect,
    )
  }
}

/**
 * Helper function that finds the difference between two strings by comparing
 * character by character from both ends.
 *
 * This function:
 * 1. Finds the common prefix by comparing characters from the start
 * 2. Finds the common suffix by comparing characters from the end
 * 3. Extracts the differing parts in the middle
 *
 * @param incorrectSentence The sentence with the error
 * @param correctSentence The corrected sentence
 * @returns Object with prefix, incorrectPart, correctPart, and suffix
 */
function findDifference(incorrectSentence: string, correctSentence: string): SentenceDifference {
  // Find common prefix
  let prefixEnd: number = 0
  const minLength: number = Math.min(incorrectSentence.length, correctSentence.length)

  while (prefixEnd < minLength && incorrectSentence[prefixEnd] === correctSentence[prefixEnd]) {
    prefixEnd++
  }

  // Find common suffix (working backwards)
  let suffixStart: number = 0
  while (
    suffixStart < minLength - prefixEnd &&
    incorrectSentence[incorrectSentence.length - 1 - suffixStart] ===
      correctSentence[correctSentence.length - 1 - suffixStart]
  ) {
    suffixStart++
  }

  // Extract parts
  const prefix: string = incorrectSentence.substring(0, prefixEnd)
  const suffix: string =
    suffixStart > 0 ? incorrectSentence.substring(incorrectSentence.length - suffixStart) : ""

  const incorrectPart: string = incorrectSentence.substring(
    prefixEnd,
    incorrectSentence.length - (suffix ? suffix.length : 0),
  )

  const correctPart: string = correctSentence.substring(
    prefixEnd,
    correctSentence.length - (suffix ? suffix.length : 0),
  )

  return { prefix, incorrectPart, correctPart, suffix }
}
