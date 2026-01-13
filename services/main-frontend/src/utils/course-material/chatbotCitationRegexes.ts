/** Captures citations */
export const MATCH_CITATIONS_REGEX = /\[doc(\d+)\]/g
/** Matches a string that only contains a single citation */
export const MATCH_CITATION_TAG_REGEX = /^\[doc\d+\]$/
/** Matches citations and a starting whitespace that should be removed */
export const REMOVE_CITATIONS_REGEX = /\s*?\[doc\d+\]/g
