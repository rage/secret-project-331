const DEFAULT_ALLOWED_CHARACTERS = /[0-9]/

/**
 * Builds a single-character matcher from a RegExp that must be a simple
 * character class (e.g. `/[0-9]/`). Do not pass untrusted patterns or
 * constructs with quantifiers outside the character class or nested groups.
 */
function isSimpleCharacterClass(source: string) {
  if (!source.startsWith("[")) {
    return false
  }

  let index = 1

  if (source[index] === "^") {
    index += 1
  }

  let hasContent = false
  let isFirstClassToken = true

  while (index < source.length) {
    const character = source[index]

    if (character === "\\") {
      index += 2
      hasContent = true
      isFirstClassToken = false
      continue
    }

    if (character === "]") {
      if (isFirstClassToken) {
        index += 1
        hasContent = true
        isFirstClassToken = false
        continue
      }

      return hasContent && index === source.length - 1
    }

    index += 1
    hasContent = true
    isFirstClassToken = false
  }

  return false
}

function toCharacterMatcher(pattern: RegExp) {
  if (!isSimpleCharacterClass(pattern.source)) {
    throw new Error("toCharacterMatcher expects a simple character-class RegExp (e.g. /[0-9]/)")
  }

  const flags = pattern.flags.replace(/g/g, "")
  return new RegExp(pattern.source, flags)
}

export function sanitizeOtpText(
  value: string,
  allowedCharacters: RegExp = DEFAULT_ALLOWED_CHARACTERS,
) {
  const matcher = toCharacterMatcher(allowedCharacters)
  return Array.from(value)
    .filter((character) => matcher.test(character))
    .join("")
}

export function splitOtpValue(value: string, length: number) {
  return Array.from({ length }, (_, index) => value[index] ?? "")
}

export function joinOtpSlots(slots: string[]) {
  return slots.join("")
}

export function clampOtpIndex(index: number, length: number) {
  return Math.max(0, Math.min(length - 1, index))
}

export function applyOtpCharacter(
  slots: string[],
  index: number,
  input: string,
  allowedCharacters: RegExp,
) {
  const nextSlots = [...slots]
  const sanitizedCharacter = sanitizeOtpText(input, allowedCharacters).slice(-1)

  nextSlots[index] = sanitizedCharacter

  return {
    slots: nextSlots,
    nextIndex: sanitizedCharacter ? clampOtpIndex(index + 1, slots.length) : index,
  }
}

export function applyOtpPaste(
  slots: string[],
  startIndex: number,
  pastedText: string,
  allowedCharacters: RegExp,
) {
  const nextSlots = [...slots]
  const sanitizedCharacters = sanitizeOtpText(pastedText, allowedCharacters)
  const characters = sanitizedCharacters.slice(0, nextSlots.length - startIndex).split("")

  for (const [offset, character] of characters.entries()) {
    nextSlots[startIndex + offset] = character
  }

  const nextIndex =
    characters.length > 0
      ? clampOtpIndex(startIndex + characters.length, nextSlots.length)
      : startIndex

  return {
    slots: nextSlots,
    nextIndex,
  }
}

export function applyOtpBackspace(slots: string[], index: number) {
  const nextSlots = [...slots]

  if (nextSlots[index]) {
    nextSlots[index] = ""
    return {
      slots: nextSlots,
      nextIndex: index,
    }
  }

  const previousIndex = clampOtpIndex(index - 1, nextSlots.length)
  nextSlots[previousIndex] = ""

  return {
    slots: nextSlots,
    nextIndex: previousIndex,
  }
}
