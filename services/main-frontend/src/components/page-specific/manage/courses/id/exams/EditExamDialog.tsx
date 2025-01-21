import React from "react"
import { useTranslation } from "react-i18next"

import { EditExam } from "../../../../../../services/backend/exams"
import EditExamForm from "../../../../../forms/EditExamForm"

import { Exam, NewExam } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import StandardDialog from "@/shared-module/common/components/StandardDialog"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

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
  const createExamMutation = useToastMutation(
    (exam: NewExam) => EditExam(examId, exam),
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
        onEditExam={(exam) => createExamMutation.mutate(exam)}
      />
    </StandardDialog>
  )
}

export default EditExamDialog
