import { css } from "@emotion/css"
import { JSX, memo, RefObject, useContext, useLayoutEffect, useRef, useState } from "react"
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
  const [glossaryTargets, setGlossaryTargets] = useState<
    Array<{ node: HTMLElement; glossaryId: string }>
  >([])

  useLayoutEffect(() => {
    if (!containerRef.current) {
      setGlossaryTargets([])
      return
    }

    const glossaryNodes = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>("[data-glossary-id]"),
    )

    const nextTargets = glossaryNodes.flatMap((node) => {
      const glossaryId = node.getAttribute("data-glossary-id")
      return glossaryId ? [{ node, glossaryId }] : []
    })

    setGlossaryTargets(nextTargets)
  }, [props.text, props.options, props.useWrapperElement, terms, containerRef])

  const portals = glossaryTargets
    .map(({ node, glossaryId }, idx) => {
      const term = terms.find((t) => t.id === glossaryId)
      if (!term) {
        return null
      }

      return createPortal(
        <TooltipNTrigger
          variant="glossary"
          className={glossaryTermStyle}
          tooltipContent={term.definition}
        >
          {term.term}
        </TooltipNTrigger>,
        node,
        // eslint-disable-next-line i18next/no-literal-string
        `glossary-${glossaryId}-${idx}`,
      )
    })
    .filter((portal): portal is NonNullable<typeof portal> => portal !== null)

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
