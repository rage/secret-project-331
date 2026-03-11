const DEFAULT_ALLOWED_CHARACTERS = /[0-9]/

function toCharacterMatcher(pattern: RegExp) {
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
