"use client"
import { useAtom } from "jotai"
import React, { useMemo } from "react"

import { BlockRendererProps } from "../../.."

import EditingParagraph from "./proposing-edits/EditingParagraph"
import { getParagraphStyles } from "./styles"

import { ParagraphAttributes } from "@/../types/GutenbergBlockAttributes"
import ParsedText from "@/components/course-material/ParsedText"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { currentlyOpenFeedbackDialogAtom } from "@/stores/course-material/materialFeedbackStore"

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

  const renderFunction = useMemo(() => {
    const renderParagraph = ({
      __html,
      count,
      hasCitationsOrGlossary,
    }: {
      __html: string
      count: number
      hasCitationsOrGlossary: boolean
    }) => {
      const ParagraphComponent = count > 0 ? LatexParagraph : P
      const hideOverflow = !hasCitationsOrGlossary
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
            __html,
          }}
        />
      )
    }
    return renderParagraph
  }, [textColor, backgroundColor, fontSize, dropCap, align])

  if (isEditing) {
    return <EditingParagraph data={data} id={id} />
  }

  return <ParsedText text={content} render={renderFunction} useWrapperElement={true} />
}

const exported = withErrorBoundary(ParagraphBlock)
// @ts-expect-error: Custom property
exported.dontUseDefaultBlockMargin = true

export default exported
