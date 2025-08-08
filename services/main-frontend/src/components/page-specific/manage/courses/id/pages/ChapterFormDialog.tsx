import React from "react"
import { useTranslation } from "react-i18next"

import NewChapterForm from "./NewChapterForm"

import { Chapter } from "@/shared-module/common/bindings"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"

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
    <StandardDialog
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
    </StandardDialog>
  )
}

export default ChapterFormDialog
