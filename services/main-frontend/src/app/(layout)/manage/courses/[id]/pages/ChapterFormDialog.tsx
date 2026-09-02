"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type { Chapter } from "@/generated/api/types.generated"
import { Dialog } from "@/shared-module/components"

import NewChapterForm from "./NewChapterForm"

interface ChapterFormDialogProps {
  open: boolean
  onClose: () => void
  courseId: string
  onSubmitForm: () => void
  chapterNumber: number
  initialData: Chapter | null
  newRecord: boolean
}

const ChapterFormDialog: React.FC<ChapterFormDialogProps> = ({
  open,
  onClose,
  courseId,
  onSubmitForm,
  chapterNumber,
  initialData,
  newRecord,
}) => {
  const { t } = useTranslation()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={newRecord ? t("button-text-new-chapter") : t("edit-chapter")}
    >
      <NewChapterForm
        courseId={courseId}
        onSubmitForm={() => {
          onSubmitForm()
          onClose()
        }}
        chapterNumber={chapterNumber}
        initialData={initialData}
        newRecord={newRecord}
      />
    </Dialog>
  )
}

export default ChapterFormDialog
