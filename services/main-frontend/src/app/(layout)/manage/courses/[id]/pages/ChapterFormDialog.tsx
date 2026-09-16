"use client"

import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import type { Chapter } from "@/generated/api/types.generated"
import { Dialog } from "@/shared-module/components"

import NewChapterForm, { NEW_CHAPTER_FORM_ID } from "./NewChapterForm"

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
  const [canSubmit, setCanSubmit] = useState(false)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={newRecord ? t("button-text-new-chapter") : t("edit-chapter")}
      actions={[
        {
          label: newRecord ? t("button-text-create") : t("button-text-update"),
          variant: "primary",
          type: "submit",
          domProps: { form: NEW_CHAPTER_FORM_ID },
          disabled: !canSubmit,
        },
      ]}
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
        onCanSubmitChange={setCanSubmit}
      />
    </Dialog>
  )
}

export default ChapterFormDialog
