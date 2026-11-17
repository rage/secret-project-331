"use client"

import { css } from "@emotion/css"
import { useAtom, useSetAtom } from "jotai"
import React, { useEffect, useId, useRef } from "react"
import { useButton } from "react-aria"
import { useTranslation } from "react-i18next"

import type { ParagraphAttributes } from "@/../types/GutenbergBlockAttributes"
import { baseTheme } from "@/shared-module/common/styles"
import { omitUndefined } from "@/shared-module/common/utils/nullability"
import {
  blockEditsAtom,
  currentlyOpenFeedbackDialogAtom,
  selectedBlockIdAtom,
} from "@/stores/course-material/materialFeedbackStore"

import { getEditableHoverStyles, getParagraphStyles } from "../styles"
import EditableParagraph from "./EditableParagraph"
import { useParagraphEditing } from "./hooks/useParagraphEditing"
import PreviewableParagraph from "./PreviewableParagraph"

const editButtonStyles = css`
  display: inline-block;
  margin-left: 0.5rem;
  vertical-align: baseline;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  background-color: ${baseTheme.colors.green[700]};
  color: ${baseTheme.colors.primary[100]};
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;

  &:hover {
    background-color: ${baseTheme.colors.green[700]};
  }

  &:focus {
    outline: 2px solid ${baseTheme.colors.green[600]};
    outline-offset: 2px;
  }
`

const DESCRIPTION_MAX_LENGTH = 60

// Start of the paragraph as plain text, so each Edit button says which paragraph it edits.
const paragraphStart = (content: string | null | undefined) => {
  const text = (content ?? "").replaceAll(/<[^>]*>/g, "").trim()
  return text.length > DESCRIPTION_MAX_LENGTH
    ? `${text.slice(0, DESCRIPTION_MAX_LENGTH).trimEnd()}…`
    : text
}

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
  const descriptionId = useId()

  // Get the edited content even when not actively editing this paragraph
  const { editedContent } = useParagraphEditing({
    id,
    editing: true, // editing is always true in this component
    selectedBlockId,
    content: content ?? null,
    setEdits,
    isEditingEnabled: type === "proposed-edits",
  })

  const hasChanges = (content ?? null) !== editedContent

  const handleEditClick = () => {
    setSelectedBlockId(id)
  }

  const { buttonProps: editButtonProps } = useButton(
    {
      onPress: handleEditClick,
    },
    editButtonRef,
  )

  useEffect(() => {
    const isCurrentlyEditing = selectedBlockId === id
    // Only when editing closed: on a switch, focusing here would steal it from the newly opened paragraph.
    if (wasEditingRef.current && selectedBlockId === null && editButtonRef.current) {
      requestAnimationFrame(() => {
        editButtonRef.current?.focus()
      })
    }
    wasEditingRef.current = isCurrentlyEditing
  }, [selectedBlockId, id])

  const editButton = (
    <>
      <button
        ref={editButtonRef}
        {...editButtonProps}
        aria-describedby={descriptionId}
        className={`edit-button ${editButtonStyles}`}
      >
        {t("edit")}
      </button>
      <span id={descriptionId} hidden>
        {paragraphStart(content)}
      </span>
    </>
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
      <div
        className={css`
          margin: 1.25rem 0;
          padding: 0.25rem;
          border-radius: 3px;
          transition:
            background-color 0.2s ease,
            box-shadow 0.2s ease;

          &:has(p:hover),
          &:has(.edit-button:hover) {
            background-color: rgba(121, 247, 96, 0.05);
            box-shadow: 0 0 0 2px rgba(93, 163, 36, 0.2);
          }

          p {
            display: inline;
            margin: 0;

            &:hover {
              background-color: transparent;
              box-shadow: none;
            }
          }
        `}
      >
        <PreviewableParagraph
          id={id}
          content={content ?? null}
          {...omitUndefined({
            textColor: textColor ?? undefined,
            backgroundColor: backgroundColor ?? undefined,
            fontSize: fontSize ?? undefined,
            align: align ?? undefined,
          })}
          setEdits={setEdits}
          editedContent={editedContent}
        />
        {editButton}
      </div>
    )
  }
  // No changes, render the regular paragraph with edit button
  return (
    <div
      className={css`
        margin: 1.25rem 0;
        padding: 0.25rem;
        border-radius: 3px;
        transition:
          background-color 0.2s ease,
          box-shadow 0.2s ease;

        &:has(> div:hover),
        &:has(.edit-button:hover) {
          background-color: rgba(121, 247, 96, 0.05);
          box-shadow: 0 0 0 2px rgba(93, 163, 36, 0.2);
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
        )} ${getEditableHoverStyles(false)} ${css`
          display: inline;
          margin: 0;

          &:hover {
            background-color: transparent;
            box-shadow: none;
          }
        `}`}
      >
        {content}
      </div>
      {editButton}
    </div>
  )
}

export default EditingParagraph
