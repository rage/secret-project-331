const CHARACTER_REFERENCE = /&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi

// A Map, not an object: names come from the input, and `&constructor;` must not find Object's.
const NAMED_CHARACTERS = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
  ["nbsp", "\u00A0"],
])

/**
 * Decodes numeric character references and the named ones rich text holds; any other reference
 * stays as written. Dependency-free (no DOMParser), so it gives the same result during SSR.
 */
export const decodeHtmlEntities = (text: string): string =>
  text.replaceAll(
    CHARACTER_REFERENCE,
    (reference, decimal: string | undefined, hexadecimal: string | undefined, name?: string) => {
      if (name !== undefined) {
        return NAMED_CHARACTERS.get(name.toLowerCase()) ?? reference
      }
      const codePoint =
        decimal !== undefined ? Number(decimal) : Number.parseInt(hexadecimal ?? "", 16)
      return codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : reference
    },
  )
