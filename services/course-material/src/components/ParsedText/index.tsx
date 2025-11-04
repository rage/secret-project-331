import { JSX, ReactPortal, useContext, useLayoutEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"

// import GlossaryTooltip from "./ContentRenderer/core/common/GlossaryTooltip"
import ParsedTextRenderer from "./ParsedTextRenderer"

import { GlossaryContext } from "@/contexts/GlossaryContext"
import Spinner from "@/shared-module/common/components/Spinner"

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

const ParsedText = <T extends Tag>(props: ParsedTextProps<T>) => {
  const { terms } = useContext(GlossaryContext)
  const [readyForPortal, setReadyForPortal] = useState(false)
  useLayoutEffect(() => {
    setReadyForPortal(true)
  }, [])

  let portals: ReactPortal[] | null = useMemo(() => {
    if (!readyForPortal) {
      return null
    }
    const portals = Array.from(document.querySelectorAll<HTMLElement>("[data-glossary-id]")).map(
      (node, idx) => {
        console.log(node)
        console.log(
          terms.find((term) => {
            return term.id === node.getAttribute("data-glossary-id")
          })?.term,
        )

        return createPortal(<Spinner></Spinner>, node, idx)
      },
    )
    return portals
  }, [terms, readyForPortal])

  // 2. todo render the createportal stuff and whats inside the portals
  // 3 .also handle attaching (requires modifying parsetext too) attaching??
  return (
    <>
      <ParsedTextRenderer {...props} />
      {portals}
    </>
  )
}

export default ParsedText
