import { css } from "@emotion/css"
import {
  JSX,
  memo,
  ReactPortal,
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

export type ParsedTextProps<T extends Tag> =
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

const glossaryTermStyle = css`
  border-bottom: 1px dotted;
  cursor: help;
`

const ParsedText = <T extends Tag>(props: ParsedTextProps<T>) => {
  const { terms } = useContext(GlossaryContext)
  const containerRef = useRef<HTMLDivElement>(null)
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
  }, [terms, readyForPortal])

  return (
    <div ref={containerRef}>
      <ParsedTextRenderer {...props} />
      {portals}
    </div>
  )
}

export default memo(ParsedText)
