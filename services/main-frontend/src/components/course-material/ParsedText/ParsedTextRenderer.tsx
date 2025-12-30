import React, { createElement, memo, RefObject, useContext, useMemo } from "react"

import { parseText } from "../ContentRenderer/util/textParsing"

import { ParsedTextProps, Tag } from "."

import { GlossaryContext } from "@/contexts/course-material/GlossaryContext"
import { sanitizeCourseMaterialHtml } from "@/utils/course-material/sanitizeCourseMaterialHtml"

const ParsedTextRenderer = <T extends Tag>(
  props: ParsedTextProps<T> & { wrapperRef?: RefObject<HTMLElement | null> },
) => {
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

  const elementProps = {
    dangerouslySetInnerHTML: { __html: parsedTextResult.parsedText },
    ...props.tagProps,
    ...(props.wrapperRef && { ref: props.wrapperRef }),
  }

  return createElement(Tag, elementProps as React.JSX.IntrinsicElements[T])
}

export default memo(ParsedTextRenderer)
