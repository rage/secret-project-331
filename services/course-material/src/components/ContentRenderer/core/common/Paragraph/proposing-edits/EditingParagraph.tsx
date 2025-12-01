import { css } from "@emotion/css"
import { useAtom, useSetAtom } from "jotai"
import React, { useRef } from "react"
import { useButton } from "react-aria"
import { useTranslation } from "react-i18next"

import { ParagraphAttributes } from "../../../../../../../types/GutenbergBlockAttributes"
import { getEditableHoverStyles, getParagraphStyles } from "../styles"

import EditableParagraph from "./EditableParagraph"
import PreviewableParagraph from "./PreviewableParagraph"
import { useParagraphEditing } from "./hooks/useParagraphEditing"

import { baseTheme } from "@/shared-module/common/styles"
import {
  blockEditsAtom,
  currentlyOpenFeedbackDialogAtom,
  selectedBlockIdAtom,
} from "@/stores/materialFeedbackStore"

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

  const [type] = useAtom(currentlyOpenFeedbackDialogAtom)
  const [selectedBlockId, setSelectedBlockId] = useAtom(selectedBlockIdAtom)
  const setEdits = useSetAtom(blockEditsAtom)
  const editButtonRef = useRef<HTMLButtonElement>(null)

  // Get the edited content even when not actively editing this paragraph
  const { editedContent } = useParagraphEditing({
    id,
    editing: true, // editing is always true in this component
    selectedBlockId,
    content: content ?? null,
    setEdits,
    isEditingEnabled: type === "proposed-edits",
  })

  const hasChanges = content !== editedContent

  const handleEditClick = () => {
    setSelectedBlockId(id)
  }

  const { buttonProps: editButtonProps } = useButton(
    {
      onPress: handleEditClick,
      "aria-label": t("click-to-edit"),
    },
    editButtonRef,
  )

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
    // No changes, render the regular paragraph with hover styles and edit button
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        handleEditClick()
      }
    }

    return (
      <div
        className={css`
          position: relative;
          &:hover .edit-button,
          &:focus-within .edit-button {
            opacity: 1;
          }
        `}
      >
        <div
          className={`${getParagraphStyles(
            textColor,
            backgroundColor,
            fontSize,
            true,
            dropCap,
            align,
          )} ${getEditableHoverStyles(false)}`}
          onClick={handleEditClick}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          aria-label={t("click-to-edit")}
        >
          {content}
        </div>
        <button
          ref={editButtonRef}
          {...editButtonProps}
          className={css`
            position: absolute;
            top: 0;
            right: 0;
            opacity: 0;
            transition: opacity 0.2s ease;
            padding: 0.25rem 0.5rem;
            font-size: 0.75rem;
            background-color: ${baseTheme.colors.blue[500]};
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;

            &:hover {
              background-color: ${baseTheme.colors.blue[600]};
            }

            &:focus {
              opacity: 1;
              outline: 2px solid ${baseTheme.colors.blue[700]};
              outline-offset: 2px;
            }
          `}
        >
          {t("edit")}
        </button>
      </div>
    )
  }
}

export default EditingParagraph
