"use client"

import { css } from "@emotion/css"
import { useSetAtom } from "jotai"
import React, { memo, useEffect, useRef } from "react"
import { useFocusRing, useFocusWithin } from "react-aria"
import { useTranslation } from "react-i18next"

import type { NewProposedBlockEdit } from "@/generated/course-material-api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { selectedBlockIdAtom } from "@/stores/course-material/materialFeedbackStore"

import { getEditableHoverStyles, getEditingStyles } from "../styles"
import { useParagraphEditing } from "./hooks/useParagraphEditing"

interface EditableParagraphProps {
  id: string
  content: string | null
  textColor?: string | undefined
  backgroundColor?: string | undefined
  fontSize?: string | undefined
  setEdits: React.Dispatch<React.SetStateAction<Map<string, NewProposedBlockEdit>>>
}

// The inner component that won't re-render during typing
const EditableParagraphContent = memo(
  ({
    textColor,
    backgroundColor,
    fontSize,
    contentEditableRef,
    handleInput,
    initialContent,
    ariaLabel,
  }: {
    textColor?: string | undefined
    backgroundColor?: string | undefined
    fontSize?: string | undefined
    contentEditableRef: React.RefObject<HTMLParagraphElement>
    handleInput: (e: React.FormEvent<HTMLParagraphElement>) => void
    initialContent: string | null
    ariaLabel: string
  }) => {
    const { isFocusVisible, focusProps } = useFocusRing()

    return (
      <p
        ref={contentEditableRef}
        className={`${getEditingStyles(textColor, backgroundColor, fontSize)} ${getEditableHoverStyles(true)} ${css`
          ${isFocusVisible &&
          `
            outline: 2px solid ${baseTheme.colors.green[500]};
            outline-offset: 2px;
          `}
        `}`}
        contentEditable
        aria-label={ariaLabel}
        onInput={handleInput}
        suppressContentEditableWarning
        {...focusProps}
      >
        {initialContent}
      </p>
    )
  },
  // Only re-render if these props change
  (prevProps, nextProps) => {
    // We never want to re-render based on content changes during editing
    return (
      prevProps.textColor === nextProps.textColor &&
      prevProps.backgroundColor === nextProps.backgroundColor &&
      prevProps.fontSize === nextProps.fontSize &&
      prevProps.initialContent === nextProps.initialContent
    )
  },
)

EditableParagraphContent.displayName = "EditableParagraphContent"

const EditableParagraph: React.FC<EditableParagraphProps> = ({
  id,
  content,
  textColor,
  backgroundColor,
  fontSize,
  setEdits,
}) => {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const setSelectedBlockId = useSetAtom(selectedBlockIdAtom)
  const { contentEditableRef, handleInput } = useParagraphEditing({
    id,
    editing: true,
    selectedBlockId: id,
    content,
    setEdits,
    isEditingEnabled: true,
  })

  // Use a ref to the initial content to avoid re-renders
  const initialContentRef = useRef(content)

  const { focusWithinProps } = useFocusWithin({})

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        setSelectedBlockId(null)
      }
    }

    const editableElement = contentEditableRef.current
    if (editableElement) {
      editableElement.addEventListener("keydown", handleKeyDown)
      return () => {
        editableElement.removeEventListener("keydown", handleKeyDown)
      }
    }
    return undefined
  }, [setSelectedBlockId, contentEditableRef])

  return (
    <div
      ref={containerRef}
      {...focusWithinProps}
      className={css`
        position: relative;
      `}
    >
      <EditableParagraphContent
        textColor={textColor}
        backgroundColor={backgroundColor}
        fontSize={fontSize}
        contentEditableRef={contentEditableRef as React.RefObject<HTMLParagraphElement>}
        handleInput={handleInput}
        initialContent={initialContentRef.current}
        ariaLabel={t("edit-paragraph")}
      />
    </div>
  )
}

EditableParagraph.displayName = "EditableParagraph"

export default EditableParagraph
