import { diffChars } from "diff"
import React from "react"

import { useParagraphEditing } from "./hooks/useParagraphEditing"
import { getParagraphStyles } from "./styles"

import { NewProposedBlockEdit } from "@/shared-module/common/bindings"
import DiffFormatter from "@/shared-module/common/components/DiffFormatter"

interface ViewableParagraphProps {
  id: string
  content: string | null
  textColor?: string
  backgroundColor?: string
  fontSize?: string
  align?: string
  setEdits: React.Dispatch<React.SetStateAction<Map<string, NewProposedBlockEdit>>>
  editedContent: string | null
}

export const ViewableParagraph: React.FC<ViewableParagraphProps> = ({
  id,
  content,
  textColor,
  backgroundColor,
  fontSize,
  align,
  setEdits,
  editedContent,
}) => {
  const { handleClick } = useParagraphEditing(id, true, null, content, setEdits)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      handleClick(e as unknown as React.MouseEvent)
    }
  }

  const diffChanges = React.useMemo(() => {
    return diffChars(content ?? "", editedContent ?? "")
  }, [content, editedContent])

  return (
    <p
      className={getParagraphStyles(textColor, backgroundColor, fontSize, true, false, align)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role
      role="button"
      tabIndex={0}
    >
      <DiffFormatter changes={diffChanges} />
    </p>
  )
}
