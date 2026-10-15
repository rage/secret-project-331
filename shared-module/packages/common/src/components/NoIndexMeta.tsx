"use client"

import React from "react"

interface NoIndexMetaProps {
  /** When true, ask search engines not to index the current page. */
  noIndex: boolean
}

/**
 * Renders `<meta name="robots" content="noindex">` when {@link NoIndexMetaProps.noIndex} is true,
 * and nothing otherwise. React (19+) hoists the tag into `<head>`, so crawlers that execute
 * JavaScript pick it up — used to keep hidden pages (e.g. a course-material `Page` with
 * `hidden: true`) out of search engine indexes. When indexing is allowed it renders nothing and
 * the meta is removed, so the directive does not leak across client-side navigations.
 */
const NoIndexMeta: React.FC<NoIndexMetaProps> = ({ noIndex }) => {
  if (!noIndex) {
    return null
  }
  return <meta name="robots" content="noindex" />
}

export default NoIndexMeta
