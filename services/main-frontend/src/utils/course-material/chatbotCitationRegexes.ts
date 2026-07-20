/** Captures citations */
export const MATCH_CITATIONS_REGEX = /【\d+:(\d+)†source】/g
/** Matches a string that only contains a single citation */
export const MATCH_CITATION_TAG_REGEX = /^【\d+:\d+†source】$/
/** Matches citations and a starting whitespace that should be removed */
export const REMOVE_CITATIONS_REGEX = /\s*?【\d+:\d+†source】/g
/** Matches only citations with the specified citation number */
export const matchSpecifiedCitationNumberRegex = (citation_number: number) => {
  return new RegExp(String.raw`【\d+:${citation_number}†source】`, "g")
}
