import React from "react"
import { useTranslation } from "react-i18next"

import { ParagraphAttributes } from "../../../../../../../types/GutenbergBlockAttributes"
import { getEditableHoverStyles, getParagraphStyles } from "../styles"

import EditableParagraph from "./EditableParagraph"
import PreviewableParagraph from "./PreviewableParagraph"
import { useParagraphEditing } from "./hooks/useParagraphEditing"

import { useFeedbackStore } from "@/stores/materialFeedbackStore"

interface EditingParagraphProps {
  data: {
    attributes: ParagraphAttributes & {
      backgroundColor?: string
      textColor?: string
    }
  }
  id: string
}

const EditingParagraph: React.FC<React.PropsWithChildren<EditingParagraphProps>> = ({
  data,
  id,
}) => {
  const { t } = useTranslation()
  const { textColor, backgroundColor, fontSize, content, dropCap, align } = data.attributes

  const feedbackStore = useFeedbackStore()
  const selectedBlockId =
    feedbackStore.type === "proposed-edits" ? feedbackStore.selectedBlockId : null
  const setEdits = feedbackStore.type === "proposed-edits" ? feedbackStore.setBlockEdits : () => {}

  // Get the edited content even when not actively editing this paragraph
  const { editedContent } = useParagraphEditing(
    id,
    true, // editing is always true in this component
    selectedBlockId,
    content ?? null,
    setEdits,
  )

  const hasChanges = content !== editedContent

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
          true,
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

export default EditingParagraph
