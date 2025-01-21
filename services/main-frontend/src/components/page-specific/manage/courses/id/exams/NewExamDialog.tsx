import { UseQueryResult } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { createExam, createExamDuplicate } from "../../../../../../services/backend/exams"
import NewExamForm from "../../../../../forms/NewExamForm"

import { NewExam, OrgExam } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import StandardDialog from "@/shared-module/common/components/StandardDialog"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

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
    <StandardDialog open={open} onClose={onClose} title={t("new-exam")}>
      {createExamMutation.isError && (
        <ErrorBanner variant={"readOnly"} error={createExamMutation.error} />
      )}
      {duplicateExamMutation.isError && (
        <ErrorBanner variant={"readOnly"} error={duplicateExamMutation.error} />
      )}
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
    </StandardDialog>
  )
}

export default NewExamDialog
