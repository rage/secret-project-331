import { useAtom } from "jotai"
import React, { useContext, useMemo } from "react"

import { BlockRendererProps } from "../../.."
import { ParagraphAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import { GlossaryContext } from "../../../../../contexts/GlossaryContext"
import { parseText } from "../../../util/textParsing"

import EditingParagraph from "./proposing-edits/EditingParagraph"
import { getParagraphStyles } from "./styles"

import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { currentlyOpenFeedbackDialogAtom } from "@/stores/materialFeedbackStore"

const LatexParagraph = dynamicImport(() => import("./LatexParagraph"))

interface ExtraAttributes {
  backgroundColor?: string
  textColor?: string
}

const P = "p"

const ParagraphBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<ParagraphAttributes & ExtraAttributes>>
> = ({ data, id }) => {
  const { textColor, backgroundColor, fontSize, content, dropCap, align } = data.attributes
  const [type] = useAtom(currentlyOpenFeedbackDialogAtom)
  const isEditing = type === "proposed-edits"

  const { terms } = useContext(GlossaryContext)
  const parsedTextResult = useMemo(() => parseText(content, terms), [content, terms])
  const { count, parsedText, hasCitationsOrGlossary } = parsedTextResult
  const ParagraphComponent = useMemo(() => (count > 0 ? LatexParagraph : P), [count])
  const hideOverflow = useMemo(() => !hasCitationsOrGlossary, [hasCitationsOrGlossary])

  if (isEditing) {
    return <EditingParagraph data={data} id={id} />
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

const exported = withErrorBoundary(ParagraphBlock)
// @ts-expect-error: Custom property
exported.dontUseDefaultBlockMargin = true

export default exported
