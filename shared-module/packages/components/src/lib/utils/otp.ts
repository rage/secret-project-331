export type OtpAllowedCharacters = RegExp | ((char: string) => boolean)

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

function isAllowedOtpCharacter(character: string, allowedCharacters: OtpAllowedCharacters) {
  if (typeof allowedCharacters === "function") {
    return allowedCharacters(character)
  }

  return toCharacterMatcher(allowedCharacters).test(character)
}

export function sanitizeOtpValue(
  value: string,
  allowedCharacters: OtpAllowedCharacters = DEFAULT_ALLOWED_CHARACTERS,
) {
  return Array.from(value)
    .filter((character) => isAllowedOtpCharacter(character, allowedCharacters))
    .join("")
}

export const sanitizeOtpText = sanitizeOtpValue

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
  allowedCharacters: OtpAllowedCharacters,
) {
  const nextSlots = [...slots]
  const sanitizedCharacter = sanitizeOtpValue(input, allowedCharacters).slice(-1)

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
  allowedCharacters: OtpAllowedCharacters,
) {
  const nextSlots = [...slots]
  const sanitizedCharacters = sanitizeOtpValue(pastedText, allowedCharacters)
  const characters = sanitizedCharacters.slice(0, nextSlots.length - startIndex).split("")

  for (let offset = 0; offset < characters.length; offset += 1) {
    nextSlots[startIndex + offset] = characters[offset]
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

export function resolveOtpSlotAriaLabel(
  index: number,
  length: number,
  getSlotAriaLabel?: (index: number, length: number) => string,
  fallback?: (index: number, length: number) => string,
) {
  return (
    getSlotAriaLabel?.(index, length) ??
    fallback?.(index, length) ??
    `Character ${index + 1} of ${length}`
  )
}
