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
import { Tooltip, TooltipTrigger } from "react-aria-components"
import { createPortal } from "react-dom"

import ParsedTextRenderer from "./ParsedTextRenderer"

import { GlossaryContext } from "@/contexts/GlossaryContext"
import { baseTheme } from "@/shared-module/common/styles"

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

const glossaryTooltipStyle = css`
  max-width: 300px;
  padding: 8px;
  background-color: #fff;
  border: 1px solid ${baseTheme.colors.clear[300]};
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  font-size: 14px;
  line-height: 1.4;
`

const ParsedText = <T extends Tag>(props: ParsedTextProps<T>) => {
  const { terms } = useContext(GlossaryContext)
  const containerRef = useRef<HTMLDivElement>(null)
  const [readyForPortal, setReadyForPortal] = useState(false)
  const [portalKey, setPortalKey] = useState(0)

  useLayoutEffect(() => {
    setReadyForPortal(true)
  }, [])

  useLayoutEffect(() => {
    if (readyForPortal && containerRef.current) {
      setPortalKey((prev) => prev + 1)
    }
  }, [readyForPortal, props.text, terms])

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
          <TooltipTrigger delay={200} closeDelay={200} key={`glossary-${glossaryId}-${idx}`}>
            <span className={glossaryTermStyle}>{term.term}</span>
            <Tooltip placement="top">
              <div className={glossaryTooltipStyle}>{term.definition}</div>
            </Tooltip>
          </TooltipTrigger>,
          node,
          idx,
        )
      })
      .filter((portal): portal is ReactPortal => portal !== null)
  }, [terms, readyForPortal, portalKey])

  return (
    <div ref={containerRef}>
      <ParsedTextRenderer {...props} />
      {portals}
    </div>
  )
}

export default memo(ParsedText)
