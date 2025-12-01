import { css } from "@emotion/css"
import React, { memo, useRef } from "react"
import { useFocusRing, useFocusWithin } from "react-aria"
import { useTranslation } from "react-i18next"

import { getEditableHoverStyles, getEditingStyles } from "../styles"

import { useParagraphEditing } from "./hooks/useParagraphEditing"

import { NewProposedBlockEdit } from "@/shared-module/common/bindings"
import { baseTheme } from "@/shared-module/common/styles"

interface EditableParagraphProps {
  id: string
  content: string | null
  textColor?: string
  backgroundColor?: string
  fontSize?: string
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
    textColor?: string
    backgroundColor?: string
    fontSize?: string
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
        aria-multiline="true"
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
