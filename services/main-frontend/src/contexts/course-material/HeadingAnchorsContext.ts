import React from "react"

/**
 * The `id` each heading on the current page renders, keyed by its block client id.
 *
 * Empty wherever headings are not meant to be linkable, such as exams and previews, which is what
 * keeps the copy-link icon off those pages.
 */
export const HeadingAnchorsContext = React.createContext<ReadonlyMap<string, string>>(new Map())
