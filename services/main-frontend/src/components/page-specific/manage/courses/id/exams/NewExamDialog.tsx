import { css } from "@emotion/css"
import { UseQueryResult } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { createExam, createExamDuplicate } from "../../../../../../services/backend/exams"
import { NewExam, OrgExam } from "../../../../../../shared-module/common/bindings"
import Dialog from "../../../../../../shared-module/common/components/Dialog"
import ErrorBanner from "../../../../../../shared-module/common/components/ErrorBanner"
import useToastMutation from "../../../../../../shared-module/common/hooks/useToastMutation"
import NewExamForm from "../../../../../forms/NewExamForm"

interface ExamDialogProps {
  organizationId: string
  getOrgExams: UseQueryResult<OrgExam[], unknown>
  open: boolean
  close: () => void
}

const NewExamDialog: React.FC<React.PropsWithChildren<ExamDialogProps>> = ({
  organizationId,
  getOrgExams,
  open,
  close,
}) => {
  const { t } = useTranslation()
  const createExamMutation = useToastMutation(
    (exam: NewExam) => createExam(organizationId, exam),
    {
      notify: true,
      successMessage: t("exam-created-succesfully"),
      method: "POST",
    },
    {
      onSuccess: async () => {
        await getOrgExams.refetch()
        close()
      },
    },
  )

  const duplicateExamMutation = useToastMutation(
    (data: { examId: string; newExam: NewExam }) => createExamDuplicate(data.examId, data.newExam),
    {
      notify: true,
      successMessage: t("exam-duplicated-succesfully"),
      method: "POST",
    },
    {
      onSuccess: async () => {
        await getOrgExams.refetch()
        close()
      },
    },
  )

  const onClose = () => {
    createExamMutation.reset()
    duplicateExamMutation.reset()
    close()
  }

  if (!getOrgExams.data) {
    return null
  }

  return (
    <div>
      <Dialog
        open={open}
        onClose={onClose}
        role="dialog"
        aria-labelledby="label"
        title={t("new-exam-dialog")}
        noPadding={true}
      >
        <div
          className={css`
            padding: 1rem;
          `}
        >
          <div id="new-exam-dialog">
            <h1
              id="label"
              className={css`
                font-size: 32px !important;
              `}
            >
              {t("new-exam")}
            </h1>
            {createExamMutation.isError && <ErrorBanner error={createExamMutation.error} />}
            {duplicateExamMutation.isError && <ErrorBanner error={duplicateExamMutation.error} />}
            <NewExamForm
              exams={getOrgExams.data}
              initialData={null}
              organizationId={organizationId}
              onCancel={close}
              onCreateNewExam={(newExam) => createExamMutation.mutate(newExam)}
              onDuplicateExam={(parentId: string, newExam: NewExam) =>
                duplicateExamMutation.mutate({ examId: parentId, newExam: newExam })
              }
            />
          </div>
        </div>
      </Dialog>
    </div>
  )
}

export default NewExamDialog
