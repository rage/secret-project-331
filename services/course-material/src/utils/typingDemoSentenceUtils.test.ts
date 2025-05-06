import { parseSentenceDifference } from "./typingDemoSentenceUtils"

describe("parseSentenceDifference", () => {
  // Define English fallbacks to use in all tests
  const englishIncorrect = "The small brown fox jumps over the lazy dog."
  const englishCorrect = "The quick brown fox jumps over the lazy dog."

  // Tests for single contiguous differences

  it("should correctly identify single word differences", () => {
    const result = parseSentenceDifference(
      "The small brown fox jumps over the lazy dog.",
      "The quick brown fox jumps over the lazy dog.",
      englishIncorrect,
      englishCorrect,
    )

    expect(result).toEqual({
      prefix: "The ",
      incorrectPart: "small",
      correctPart: "quick",
      suffix: " brown fox jumps over the lazy dog.",
    })
  })

  it("should correctly identify differences at the beginning", () => {
    const result = parseSentenceDifference(
      "Small brown fox jumps over the lazy dog.",
      "Quick brown fox jumps over the lazy dog.",
      englishIncorrect,
      englishCorrect,
    )

    expect(result).toEqual({
      prefix: "",
      incorrectPart: "Small",
      correctPart: "Quick",
      suffix: " brown fox jumps over the lazy dog.",
    })
  })

  it("should handle punctuation differences", () => {
    const result = parseSentenceDifference(
      "The quick brown fox jumps over the lazy dog",
      "The quick brown fox jumps over the lazy dog.",
      englishIncorrect,
      englishCorrect,
    )

    expect(result).toEqual({
      prefix: "The quick brown fox jumps over the lazy dog",
      incorrectPart: "",
      correctPart: ".",
      suffix: "",
    })
  })

  it("should fall back on identical sentences", () => {
    const sentence = "The quick brown fox jumps over the lazy dog."
    const result = parseSentenceDifference(sentence, sentence, englishIncorrect, englishCorrect)

    expect(result).toEqual({
      prefix: "The ",
      incorrectPart: "small",
      correctPart: "quick",
      suffix: " brown fox jumps over the lazy dog.",
    })
  })

  it("should fall back on empty strings", () => {
    const result1 = parseSentenceDifference("", "Hello world.", englishIncorrect, englishCorrect)
    expect(result1).toEqual({
      prefix: "The ",
      incorrectPart: "small",
      correctPart: "quick",
      suffix: " brown fox jumps over the lazy dog.",
    })

    const result2 = parseSentenceDifference("Hello world.", "", englishIncorrect, englishCorrect)
    expect(result2).toEqual({
      prefix: "The ",
      incorrectPart: "small",
      correctPart: "quick",
      suffix: " brown fox jumps over the lazy dog.",
    })

    const result3 = parseSentenceDifference("", "", englishIncorrect, englishCorrect)
    expect(result3).toEqual({
      prefix: "The ",
      incorrectPart: "small",
      correctPart: "quick",
      suffix: " brown fox jumps over the lazy dog.",
    })
  })

  // Tests for falling back with non-contiguous differences

  it("should use fallback for completely different sentences", () => {
    // These sentences share no common prefix or suffix
    const result = parseSentenceDifference(
      "The sky is blue and the clouds are white.",
      "Roses are red and violets are blue.",
      englishIncorrect,
      englishCorrect,
    )

    // Should use fallback since there's no single contiguous difference
    expect(result.prefix).toBe("The ")
    expect(result.incorrectPart).toBe("small")
    expect(result.correctPart).toBe("quick")
    expect(result.suffix).toBe(" brown fox jumps over the lazy dog.")
  })

  it("should use fallback for sentences with large differences", () => {
    const result = parseSentenceDifference(
      "The small brown cat jumps over the tired dog.",
      "The quick brown fox jumps over the lazy dog and then continues running through the meadow, past the old oak tree, across the bubbling stream, into the dense forest where woodland creatures scatter at its approach, and finally reaches the distant mountains as the sun sets gloriously on the horizon.",
      englishIncorrect,
      englishCorrect,
    )

    expect(result.prefix).toBe("The ")
    expect(result.incorrectPart).toBe("small")
    expect(result.correctPart).toBe("quick")
    expect(result.suffix).toBe(" brown fox jumps over the lazy dog.")
  })
})
