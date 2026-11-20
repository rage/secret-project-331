"use client"

import { diffWords } from "diff"
import React from "react"

import type { NewProposedBlockEdit } from "@/generated/course-material-api/types.generated"
import DiffFormatter from "@/shared-module/common/components/DiffFormatter"

import { getEditableHoverStyles, getParagraphStyles } from "../styles"
import { useParagraphEditing } from "./hooks/useParagraphEditing"

interface PreviewableParagraphProps {
  id: string
  content: string | null
  textColor?: string
  backgroundColor?: string
  fontSize?: string
  align?: string
  setEdits: React.Dispatch<React.SetStateAction<Map<string, NewProposedBlockEdit>>>
  editedContent: string | null
}

const PreviewableParagraph: React.FC<PreviewableParagraphProps> = ({
  id,
  content,
  textColor,
  backgroundColor,
  fontSize,
  align,
  setEdits,
  editedContent: propEditedContent,
}) => {
  const { editedContent: hookEditedContent } = useParagraphEditing({
    id,
    editing: true,
    selectedBlockId: null,
    content,
    setEdits,
    isEditingEnabled: false,
  })

  const actualEditedContent = hookEditedContent !== content ? hookEditedContent : propEditedContent

  const diffChanges = React.useMemo(() => {
    if (content === actualEditedContent) {
      return []
    }
    return diffWords(content ?? "", actualEditedContent ?? "")
  }, [content, actualEditedContent])

  return (
    <p
      className={`${getParagraphStyles(textColor, backgroundColor, fontSize, false, align)} ${getEditableHoverStyles(false)}`}
    >
      {diffChanges.length > 0 ? <DiffFormatter changes={diffChanges} /> : content}
    </p>
  )
}

PreviewableParagraph.displayName = "PreviewableParagraph"

export default PreviewableParagraph
