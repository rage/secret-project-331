import React, { memo, useRef } from "react"

import { getEditableHoverStyles, getEditingStyles } from "../styles"

import { useParagraphEditing } from "./hooks/useParagraphEditing"

import { NewProposedBlockEdit } from "@/shared-module/common/bindings"

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
  }: {
    textColor?: string
    backgroundColor?: string
    fontSize?: string
    contentEditableRef: React.RefObject<HTMLParagraphElement>
    handleInput: (e: React.FormEvent<HTMLParagraphElement>) => void
    initialContent: string | null
  }) => {
    return (
      <p
        ref={contentEditableRef}
        className={`${getEditingStyles(textColor, backgroundColor, fontSize)} ${getEditableHoverStyles(true)}`}
        contentEditable
        onInput={handleInput}
        suppressContentEditableWarning
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
  const { contentEditableRef, handleInput } = useParagraphEditing(id, true, id, content, setEdits)

  // Use a ref to the initial content to avoid re-renders
  const initialContentRef = useRef(content)

  return (
    <EditableParagraphContent
      textColor={textColor}
      backgroundColor={backgroundColor}
      fontSize={fontSize}
      contentEditableRef={contentEditableRef as React.RefObject<HTMLParagraphElement>}
      handleInput={handleInput}
      initialContent={initialContentRef.current}
    />
  )
}

EditableParagraph.displayName = "EditableParagraph"

export default EditableParagraph
