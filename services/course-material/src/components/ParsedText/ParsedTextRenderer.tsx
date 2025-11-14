import { createElement, memo, useContext, useMemo } from "react"

import { parseText } from "../ContentRenderer/util/textParsing"

import { ParsedTextProps, Tag } from "."

import { GlossaryContext } from "@/contexts/GlossaryContext"
import { sanitizeCourseMaterialHtml } from "@/utils/sanitizeCourseMaterialHtml"

const ParsedTextRenderer = <T extends Tag>(props: ParsedTextProps<T>) => {
  const { terms } = useContext(GlossaryContext)

  const parsedTextResult = useMemo(() => {
    const res = parseText(props.text, terms, props.options)

    const parsedText = sanitizeCourseMaterialHtml(res.parsedText)
    return { ...res, parsedText }
  }, [props.text, terms, props.options])

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

export default memo(ParsedTextRenderer)
