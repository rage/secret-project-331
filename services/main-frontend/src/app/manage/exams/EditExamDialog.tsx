"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import EditExamForm from "@/components/forms/EditExamForm"
import { editExamMutationOptions } from "@/services/backend/exams"
import { Exam, NewExam } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"

interface ExamDialogProps {
  initialData: Exam
  examId: string
  organizationId: string
  open: boolean
  close: () => void
}

const EditExamDialog: React.FC<React.PropsWithChildren<ExamDialogProps>> = ({
  examId,
  open,
  close,
  initialData,
  organizationId,
}) => {
  const { t } = useTranslation()
  const createExamMutation = useToastMutationOptions(
    editExamMutationOptions(),
    {
      notify: true,
      successMessage: t("exam-edited-successfully"),
      method: "POST",
    },
    {
      onSuccess: async () => {
        close()
      },
    },
  )

  const onClose = () => {
    createExamMutation.reset()
    close()
  }

  return (
    <StandardDialog open={open} onClose={onClose} title={t("edit-exam")}>
      {createExamMutation.isError && (
        <ErrorBanner variant={"readOnly"} error={createExamMutation.error} />
      )}
      <EditExamForm
        initialData={initialData}
        organizationId={organizationId}
        onCancel={close}
        onEditExam={(exam: NewExam) =>
          createExamMutation.mutate({
            path: {
              id: examId,
            },
            body: exam,
          })
        }
      />
    </StandardDialog>
  )
}

export default EditExamDialog
