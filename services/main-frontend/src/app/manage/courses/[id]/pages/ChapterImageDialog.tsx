"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import ChapterImageWidget from "./ChapterImageWidget"

import type { Chapter } from "@/generated/api/types.generated"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"

export interface ChapterImageDialogProps {
  open: boolean
  onClose: () => void
  chapter: Chapter
  onChapterUpdated: () => void
}

const ChapterImageDialog: React.FC<ChapterImageDialogProps> = ({
  open,
  onClose,
  chapter,
  onChapterUpdated,
}) => {
  const { t } = useTranslation()

  return (
    <StandardDialog open={open} onClose={onClose} title={t("button-text-edit-image")}>
      <ChapterImageWidget chapter={chapter} onChapterUpdated={onChapterUpdated} />
    </StandardDialog>
  )
}

export default ChapterImageDialog
