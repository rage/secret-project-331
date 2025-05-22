import { diffChars } from "diff"
import React from "react"
import { useTranslation } from "react-i18next"

import { getEditableHoverStyles, getParagraphStyles } from "../styles"

import { useParagraphEditing } from "./hooks/useParagraphEditing"

import { NewProposedBlockEdit } from "@/shared-module/common/bindings"
import DiffFormatter from "@/shared-module/common/components/DiffFormatter"

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
  const { t } = useTranslation()
  const { editedContent: hookEditedContent } = useParagraphEditing({
    id,
    editing: true,
    selectedBlockId: null,
    content,
    setEdits,
    isEditingEnabled: false,
  })

  const actualEditedContent = hookEditedContent !== content ? hookEditedContent : propEditedContent

  const handleSelectForEditing = () => {
    // This function will be passed to the onClick handler
    // It doesn't need to do anything special now, as the parent component
    // will handle setting the selectedBlockId
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      handleSelectForEditing()
    }
  }

  const diffChanges = React.useMemo(() => {
    if (content === actualEditedContent) {
      return []
    }
    return diffChars(content ?? "", actualEditedContent ?? "")
  }, [content, actualEditedContent])

  return (
    <p
      className={`${getParagraphStyles(textColor, backgroundColor, fontSize, true, false, align)} ${getEditableHoverStyles(false)}`}
      onClick={handleSelectForEditing}
      onKeyDown={handleKeyDown}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role
      role="button"
      tabIndex={0}
      title={t("click-to-edit")}
    >
      {diffChanges.length > 0 ? <DiffFormatter changes={diffChanges} /> : content}
    </p>
  )
}

PreviewableParagraph.displayName = "PreviewableParagraph"

export default PreviewableParagraph
