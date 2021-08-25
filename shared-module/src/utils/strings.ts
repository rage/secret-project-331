export function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

export function normalizeIETFLanguageTag(tag: string): string {
  const subtags = tag.split(/[-_]/)
  if (subtags.length < 2) {
    throw new Error("Language tag should follow the format aa-BB or aa-Bbbb-CC")
  } else if (subtags.length === 2) {
    return formatIETFLanguageTagWithRegion(subtags[0], undefined, subtags[1])
  } else {
    return formatIETFLanguageTagWithRegion(subtags[0], subtags[1], subtags[2])
  }
}

type IETFLanguageTagSubtagSeparator = "-" | "_"

/**
 * Formats an IETF language tag with region specified. Only the syntax of subtags are validated, and
 * not whether they represent anything valid.
 *
 * @param language Two to three letter language subtag.
 * @param script Optional four letter script subtag.
 * @param region Two letter language subtag.
 * @param separator Separator for subtags. Defaults to `-`.
 */
export function formatIETFLanguageTagWithRegion(
  language: string,
  script: string | undefined,
  region: string,
  separator: IETFLanguageTagSubtagSeparator = "-",
): string {
  if (!language.match(/^[a-z]{2,3}$/i)) {
    throw new Error("Primary language should be between two and three letters.")
  }
  language = language.toLowerCase()

  if (!region.match(/^[a-z]{2}$/i)) {
    throw new Error("region should be two letters.")
  }
  region = region.toUpperCase()

  if (script === undefined) {
    return `${language}${separator}${region}`
  }

  if (!script.match(/^[a-z]{4}$/i)) {
    throw new Error("Script should be four letters.")
  }
  script = capitalizeFirstLetter(script.toLowerCase())

  return `${language}${separator}${script}${separator}${region}`
}
