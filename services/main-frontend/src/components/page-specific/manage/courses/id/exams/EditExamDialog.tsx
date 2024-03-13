import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { EditExam } from "../../../../../../services/backend/exams"
import { Exam, NewExam } from "../../../../../../shared-module/bindings"
import Dialog from "../../../../../../shared-module/components/Dialog"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import useToastMutation from "../../../../../../shared-module/hooks/useToastMutation"
import EditExamForm from "../../../../../forms/EditExamForm"

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
    <div>
      <Dialog
        open={open}
        onClose={onClose}
        role="dialog"
        aria-labelledby="label"
        title={t("edit-exam")}
        noPadding={true}
      >
        <div
          className={css`
            padding: 1rem;
          `}
        >
          <div id="edit-exam-dialog">
            <h1
              id="label"
              className={css`
                font-size: 32px !important;
              `}
            >
              {t("edit-exam")}
            </h1>
            {createExamMutation.isError && (
              <ErrorBanner variant={"readOnly"} error={createExamMutation.error} />
            )}
            <EditExamForm
              initialData={initialData}
              organizationId={organizationId}
              onCancel={close}
              onEditExam={(exam) => createExamMutation.mutate(exam)}
            />
          </div>
        </div>
      </Dialog>
    </div>
  )
}

export default EditExamDialog
