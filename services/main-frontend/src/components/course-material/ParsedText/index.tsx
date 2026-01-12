import { css } from "@emotion/css"
import { JSX, memo, RefObject, useContext, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import ParsedTextRenderer from "./ParsedTextRenderer"

import TooltipNTrigger from "@/components/course-material/TooltipNTrigger"
import { GlossaryContext } from "@/contexts/course-material/GlossaryContext"

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

type GlossaryTarget = { node: HTMLElement; glossaryId: string }

// https://github.com/facebook/react/issues/31600
const RESCAN_DELAYS_MS = [0, 2000] as const

const scanGlossaryTargets = (container: HTMLElement | null): GlossaryTarget[] => {
  if (!container) {
    return []
  }
  const glossaryNodes = Array.from(container.querySelectorAll<HTMLElement>("[data-glossary-id]"))

  return glossaryNodes.flatMap((node) => {
    const glossaryId = node.getAttribute("data-glossary-id")
    return glossaryId ? [{ node, glossaryId }] : []
  })
}

const sameTargets = (a: GlossaryTarget[], b: GlossaryTarget[]) => {
  if (a.length !== b.length) {
    return false
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i].node !== b[i].node || a[i].glossaryId !== b[i].glossaryId) {
      return false
    }
  }
  return true
}

const targetsAreUsable = (container: HTMLElement | null, targets: GlossaryTarget[]) => {
  if (!container) {
    return targets.length === 0
  }
  return targets.every(({ node }) => node.isConnected && container.contains(node))
}

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

  const [glossaryTargets, setGlossaryTargets] = useState<GlossaryTarget[]>([])

  const timersRef = useRef<number[]>([])

  useLayoutEffect(() => {
    // clear any prior timers when inputs change
    timersRef.current.forEach((t) => window.clearTimeout(t))
    timersRef.current = []

    const initialContainer = containerRef.current

    // First scan immediately (layout effect)
    const first = scanGlossaryTargets(initialContainer)
    setGlossaryTargets(first)

    // Then a few deferred rescans to catch cases where the container/subtree
    // is replaced shortly after the initial scan.
    // https://github.com/facebook/react/issues/31600
    for (const delay of RESCAN_DELAYS_MS) {
      const id = window.setTimeout(() => {
        const currentContainer = containerRef.current

        setGlossaryTargets((prev) => {
          const containerChanged = currentContainer !== initialContainer
          const stale = !targetsAreUsable(currentContainer, prev)

          if (!containerChanged && !stale) {
            return prev
          }

          const next = scanGlossaryTargets(currentContainer)
          return sameTargets(prev, next) ? prev : next
        })
      }, delay)

      timersRef.current.push(id)
    }

    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t))
      timersRef.current = []
    }
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
