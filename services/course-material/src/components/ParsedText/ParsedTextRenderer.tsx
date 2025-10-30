import { createElement, JSX, useContext, useMemo } from "react"

import { parseText } from "../ContentRenderer/util/textParsing"

import { ParsedTextProps, Tag } from "."

import { GlossaryContext } from "@/contexts/GlossaryContext"
import { sanitizeCourseMaterialHtml } from "@/utils/sanitizeCourseMaterialHtml"

/**
 * ParsedTextRenderer
 *
 * Short: parse course material text (uses glossary), sanitize the generated HTML and render it.
 *
 * Details:
 * - Accepts a plain `text` string which is parsed by the internal parser (parseText).
 * - The parser can use glossary terms from GlossaryContext when producing HTML.
 * - The produced HTML is passed through sanitizeCourseMaterialHtml before rendering.
 *
 * Rendering modes (mutually exclusive):
 * - tag + tagProps: creates an intrinsic element (e.g. 'div', 'span') and sets its inner HTML
 *   via dangerouslySetInnerHTML. tagProps are forwarded to that element.
 * - render: a custom render function receives { __html: sanitized } and must return a React element.
 *
 * Security:
 * - Output from the parser is sanitized, but this component still uses dangerouslySetInnerHTML when
 *   using the `tag` mode. Avoid passing pre-sanitized or trusted HTML into `text` unless you know
 *   what you're doing.
 *
 * Example:
 * <ParsedText text="Definition of term" tag="div" tagProps={{ className: 'cm-text' }} />
 * <ParsedText text="..." render={(sanitizedHTML) => <div dangerouslySetInnerHTML={sanitizedHTML} />} />
 */
const ParsedText = <T extends Tag>(props: ParsedTextProps<T>) => {
  const { terms } = useContext(GlossaryContext)

  // why do we need to assign portals to variable why not just blast
  const parsedTextResult = useMemo(() => {
    // 1. todo make parsetext return the glossary entries that were found in this text (why? we have useContext Glossary already)
    const res = parseText(props.text, terms, props.options)

    // for portalMarker in res.portalIds:
    // blast portals of tooltiparia
    const parsedText = sanitizeCourseMaterialHtml(res.parsedText)
    console.log(terms)
    return { ...res, parsedText }
  }, [props.text, terms, props.options])

  // 2. todo render the createportal stuff and whats inside the portals
  // 3 .also handle attaching (requires modifying parsetext too) attaching??

  if (props.render) {
    return props.render({
      __html: parsedTextResult.parsedText,
      count: parsedTextResult.count,
      hasCitationsOrGlossary: parsedTextResult.hasCitationsOrGlossary,
    })
  }

  const Tag: T = props.tag

  return createElement(Tag, {
    dangerouslySetInnerHTML: { __html: parsedTextResult.parsedText },
    ...props.tagProps,
  })
}

export default ParsedText
