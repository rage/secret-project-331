import React from "react"

import { useParagraphEditing } from "./hooks/useParagraphEditing"
import { getEditingStyles } from "./styles"

import { NewProposedBlockEdit } from "@/shared-module/common/bindings"

interface EditableParagraphProps {
  id: string
  content: string | null
  textColor?: string
  backgroundColor?: string
  fontSize?: string
  setEdits: React.Dispatch<React.SetStateAction<Map<string, NewProposedBlockEdit>>>
}

export const EditableParagraph: React.FC<EditableParagraphProps> = ({
  id,
  content,
  textColor,
  backgroundColor,
  fontSize,
  setEdits,
}) => {
  const { editedContent, contentEditableRef, handleInput } = useParagraphEditing(
    id,
    true,
    id,
    content,
    setEdits,
  )

  return (
    <p
      ref={contentEditableRef}
      className={getEditingStyles(textColor, backgroundColor, fontSize)}
      contentEditable
      onInput={handleInput}
    >
      {editedContent}
    </p>
  )
}
