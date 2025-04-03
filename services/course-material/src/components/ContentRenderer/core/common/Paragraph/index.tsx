import dynamic from "next/dynamic"
import React, { useContext, useMemo } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../../.."
import { ParagraphAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import { GlossaryContext } from "../../../../../contexts/GlossaryContext"
import { parseText } from "../../../util/textParsing"

import EditableParagraph from "./proposing-edits/EditableParagraph"
import PreviewableParagraph from "./proposing-edits/PreviewableParagraph"
import { useParagraphEditing } from "./proposing-edits/hooks/useParagraphEditing"
import { getEditableHoverStyles, getParagraphStyles } from "./styles"

import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
const LatexParagraph = dynamic(() => import("./LatexParagraph"))

interface ExtraAttributes {
  backgroundColor?: string
  textColor?: string
}

const P = "p"

const ParagraphBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<ParagraphAttributes & ExtraAttributes>>
> = ({ data, id, editing, selectedBlockId, setEdits }) => {
  const { t } = useTranslation()
  const { textColor, backgroundColor, fontSize, content, dropCap, align } = data.attributes

  // Get the edited content even when not actively editing this paragraph
  const { editedContent } = useParagraphEditing(
    id,
    editing,
    selectedBlockId,
    content ?? null,
    setEdits,
  )

  const { terms } = useContext(GlossaryContext)
  const parsedTextResult = useMemo(() => parseText(content, terms), [content, terms])
  const { count, parsedText, hasCitationsOrGlossary } = parsedTextResult
  const ParagraphComponent = useMemo(() => (count > 0 ? LatexParagraph : P), [count])
  const hideOverflow = useMemo(() => !hasCitationsOrGlossary, [hasCitationsOrGlossary])

  const hasChanges = content !== editedContent

  if (editing) {
    if (selectedBlockId === id) {
      return (
        <EditableParagraph
          id={id}
          content={content ?? null}
          textColor={textColor ?? undefined}
          backgroundColor={backgroundColor ?? undefined}
          fontSize={fontSize ?? undefined}
          setEdits={setEdits}
        />
      )
    } else if (hasChanges) {
      // Only show the PreviewableParagraph with diff if there are actual changes
      return (
        <PreviewableParagraph
          id={id}
          content={content ?? null}
          textColor={textColor ?? undefined}
          backgroundColor={backgroundColor ?? undefined}
          fontSize={fontSize ?? undefined}
          align={align ?? undefined}
          setEdits={setEdits}
          editedContent={editedContent}
        />
      )
    } else {
      // No changes, render the regular paragraph with hover styles
      return (
        <p
          className={`${getParagraphStyles(
            textColor,
            backgroundColor,
            fontSize,
            hideOverflow,
            dropCap,
            align,
          )} ${getEditableHoverStyles(false)}`}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role
          role="button"
          tabIndex={0}
          title={t("click-to-edit")}
        >
          {content}
        </p>
      )
    }
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
