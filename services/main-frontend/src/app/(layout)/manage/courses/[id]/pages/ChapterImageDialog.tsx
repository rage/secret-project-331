"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type { Chapter } from "@/generated/api/types.generated"
import { Dialog } from "@/shared-module/components"

import ChapterImageWidget from "./ChapterImageWidget"

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
    <Dialog open={open} onClose={onClose} title={t("button-text-edit-image")}>
      <ChapterImageWidget chapter={chapter} onChapterUpdated={onChapterUpdated} />
    </Dialog>
  )
}

export default ChapterImageDialog
