import React, {
  createElement,
  memo,
  RefObject,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react"

import { parseText } from "../ContentRenderer/util/textParsing"

import { ParsedTextProps, Tag } from "."

import { GlossaryContext } from "@/contexts/course-material/GlossaryContext"

const ParsedTextRenderer = <T extends Tag>(
  props: ParsedTextProps<T> & { wrapperRef?: RefObject<HTMLElement | null> },
) => {
  const { terms } = useContext(GlossaryContext)

  const parsedTextResult = useMemo(() => {
    return parseText(props.text, terms, props.options)
  }, [props.text, terms, props.options])

  const innerHTMLRef = useRef<string | null>(null)
  const prevElementRef = useRef<HTMLElement | null>(null)

  const setInnerHTML = useCallback(
    (element: HTMLElement | null) => {
      if (!element || typeof window === "undefined") {
        return
      }

      const elementChanged = prevElementRef.current !== element
      const newInnerHTML = parsedTextResult.parsedText
      if (elementChanged || innerHTMLRef.current !== newInnerHTML) {
        element.innerHTML = newInnerHTML
        innerHTMLRef.current = newInnerHTML
        prevElementRef.current = element
      }
    },
    [parsedTextResult.parsedText],
  )

  const renderRefCallback = useCallback(
    (node: HTMLElement | null) => {
      setInnerHTML(node)
    },
    [setInnerHTML],
  )

  if (props.render) {
    return props.render({
      ref: renderRefCallback,
      count: parsedTextResult.count,
      hasCitationsOrGlossary: parsedTextResult.hasCitationsOrGlossary,
    })
  }

  const Tag: T = props.tag

  const elementProps = {
    ...props.tagProps,
  }

  const element = createElement(Tag, {
    ...elementProps,
    ref: (node: HTMLElement | null) => {
      setInnerHTML(node)
      if (props.wrapperRef) {
        props.wrapperRef.current = node
      }
    },
  } as React.JSX.IntrinsicElements[T])

  return element
}

export default memo(ParsedTextRenderer)
