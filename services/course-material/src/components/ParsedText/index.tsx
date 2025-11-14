import { css } from "@emotion/css"
import {
  JSX,
  memo,
  ReactPortal,
  RefObject,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"

import ParsedTextRenderer from "./ParsedTextRenderer"

import TooltipNTrigger from "@/components/TooltipNTrigger"
import { GlossaryContext } from "@/contexts/GlossaryContext"

export type Tag = keyof JSX.IntrinsicElements

export type ParsedTextPropsWithWrapperElement = {
  useWrapperElement: true
}

export type ParsedTextPropsWithoutWrapperElement = {
  useWrapperElement: false
  wrapperRef: RefObject<HTMLElement | null>
}

export type BaseParsedTextProps<T extends Tag> =
  | {
      text: string | undefined
      tag: T
      tagProps?: JSX.IntrinsicElements[T]
      render?: undefined
      options?: { glossary: boolean }
    }
  | {
      text: string | undefined
      render: (rendered: {
        __html: string
        count: number
        hasCitationsOrGlossary: boolean
      }) => React.ReactElement
      tag?: undefined
      options?: { glossary: boolean }
    }

export type ParsedTextProps<T extends Tag> = BaseParsedTextProps<T> &
  (ParsedTextPropsWithWrapperElement | ParsedTextPropsWithoutWrapperElement)

const glossaryTermStyle = css`
  border-bottom: 1px dotted;
  cursor: help;
`

/**
 * Parses HTML from Gutenberg editor (can contain glossary entries, references, LaTeX, etc.),
 * sanitizes it, and renders it. Rendering: use `tag` + `tagProps` for intrinsic elements,
 * or `render` for custom rendering. In tag mode, sanitized HTML is injected via dangerouslySetInnerHTML.
 * Adds tooltip portals for glossary terms.
 */
const ParsedText = <T extends Tag>(props: ParsedTextProps<T>) => {
  const { terms } = useContext(GlossaryContext)
  const internalRef = useRef<HTMLSpanElement>(null)
  const containerRef = props.useWrapperElement === false ? props.wrapperRef : internalRef
  const [readyForPortal, setReadyForPortal] = useState(false)

  useLayoutEffect(() => {
    setReadyForPortal(true)
  }, [])

  const portals = useMemo(() => {
    if (!readyForPortal || !containerRef.current) {
      return null
    }

    const glossaryNodes = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>("[data-glossary-id]"),
    )

    if (glossaryNodes.length === 0) {
      return null
    }

    return glossaryNodes
      .map((node, idx): ReactPortal | null => {
        const glossaryId = node.getAttribute("data-glossary-id")
        if (!glossaryId) {
          return null
        }

        const term = terms.find((t) => t.id === glossaryId)
        if (!term) {
          return null
        }

        return createPortal(
          <TooltipNTrigger
            key={`glossary-${glossaryId}-${idx}`}
            variant="glossary"
            className={glossaryTermStyle}
            tooltipContent={term.definition}
          >
            {term.term}
          </TooltipNTrigger>,
          node,
          idx,
        )
      })
      .filter((portal): portal is ReactPortal => portal !== null)
  }, [terms, readyForPortal, containerRef])

  const content =
    props.useWrapperElement === false ? (
      <ParsedTextRenderer {...props} wrapperRef={props.wrapperRef} />
    ) : (
      <ParsedTextRenderer {...props} />
    )

  if (props.useWrapperElement === false) {
    return (
      <>
        {content}
        {portals}
      </>
    )
  }

  return (
    <span ref={internalRef}>
      {content}
      {portals}
    </span>
  )
}

export default memo(ParsedText)
