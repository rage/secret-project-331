"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import EditExamForm from "@/components/forms/EditExamForm"
import { editExamMutation } from "@/generated/api/@tanstack/react-query.generated"
import type { Exam, NewExam } from "@/generated/api/types.generated"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
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
    editExamMutation(),
    {
      notify: true,
      successMessage: t("exam-edited-successfully"),
      method: "POST",
    },
    {
      onSuccess: () => {
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
