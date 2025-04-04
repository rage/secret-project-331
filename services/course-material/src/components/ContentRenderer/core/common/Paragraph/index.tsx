import dynamic from "next/dynamic"
import React, { useContext, useMemo } from "react"

import { BlockRendererProps } from "../../.."
import { ParagraphAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import { GlossaryContext } from "../../../../../contexts/GlossaryContext"
import { parseText } from "../../../util/textParsing"

import EditingParagraph from "./proposing-edits/EditingParagraph"
import { getParagraphStyles } from "./styles"

import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
const LatexParagraph = dynamic(() => import("./LatexParagraph"))

interface ExtraAttributes {
  backgroundColor?: string
  textColor?: string
}

const P = "p"

const ParagraphBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<ParagraphAttributes & ExtraAttributes>>
> = ({ data, id, editing, setEdits }) => {
  const { textColor, backgroundColor, fontSize, content, dropCap, align } = data.attributes

  const { terms } = useContext(GlossaryContext)
  const parsedTextResult = useMemo(() => parseText(content, terms), [content, terms])
  const { count, parsedText, hasCitationsOrGlossary } = parsedTextResult
  const ParagraphComponent = useMemo(() => (count > 0 ? LatexParagraph : P), [count])
  const hideOverflow = useMemo(() => !hasCitationsOrGlossary, [hasCitationsOrGlossary])

  if (editing) {
    return <EditingParagraph data={data} id={id} setEdits={setEdits} />
  }

  return (
    <ParagraphComponent
      className={getParagraphStyles(
        textColor,
        backgroundColor,
        fontSize,
        hideOverflow,
        dropCap,
        align,
      )}
      dangerouslySetInnerHTML={{
        __html: parsedText,
      }}
    />
  )
}

export default withErrorBoundary(ParagraphBlock)
