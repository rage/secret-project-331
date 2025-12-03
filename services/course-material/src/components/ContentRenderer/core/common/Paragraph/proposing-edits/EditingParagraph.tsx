import { css } from "@emotion/css"
import { useAtom, useSetAtom } from "jotai"
import React, { useEffect, useRef } from "react"
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

const editButtonStyles = css`
  position: absolute;
  bottom: 2px;
  right: 2px;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  background-color: ${baseTheme.colors.blue[500]};
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 0.3s;

  &:hover {
    background-color: ${baseTheme.colors.blue[600]};
    opacity: 1;
  }

  &:focus {
    outline: 2px solid ${baseTheme.colors.blue[700]};
    outline-offset: 2px;
    opacity: 1;
  }
`

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
  const wasEditingRef = useRef(false)

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

  useEffect(() => {
    const isCurrentlyEditing = selectedBlockId === id
    if (wasEditingRef.current && !isCurrentlyEditing && editButtonRef.current) {
      requestAnimationFrame(() => {
        editButtonRef.current?.focus()
      })
    }
    wasEditingRef.current = isCurrentlyEditing
  }, [selectedBlockId, id])

  if (selectedBlockId === id) {
    return (
      <EditableParagraph
        id={id}
        content={content ?? null}
        textColor={textColor ?? undefined}
        backgroundColor={backgroundColor ?? undefined}
        fontSize={fontSize ?? undefined}
        setEdits={setEdits}
        editButtonRef={editButtonRef as React.RefObject<HTMLButtonElement | null>}
      />
    )
  } else if (hasChanges) {
    // Only show the PreviewableParagraph with diff if there are actual changes
    return (
      <div
        className={css`
          position: relative;
        `}
      >
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
        <button
          ref={editButtonRef}
          {...editButtonProps}
          className={`edit-button ${editButtonStyles}`}
        >
          {t("edit")}
        </button>
      </div>
    )
  } else {
    // No changes, render the regular paragraph with edit button
    return (
      <div
        className={css`
          position: relative;
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
        >
          {content}
        </div>
        <button
          ref={editButtonRef}
          {...editButtonProps}
          className={`edit-button ${editButtonStyles}`}
        >
          {t("edit")}
        </button>
      </div>
    )
  }
}

export default EditingParagraph
