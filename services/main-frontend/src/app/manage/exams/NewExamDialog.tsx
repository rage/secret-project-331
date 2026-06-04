"use client"

import { UseQueryResult } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import NewExamForm from "@/components/forms/NewExamForm"
import {
  createOrganizationExamMutation as createOrganizationExamMutationOptions,
  duplicateExamMutation as duplicateExamMutationOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { NewExam, OrgExam } from "@/generated/api/types.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { QueryResult } from "@/shared-module/components"

interface ExamDialogProps {
  organizationId: string
  getOrgExams: UseQueryResult<OrgExam[], Error>
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
  const createExamMutation = useToastMutationOptions(
    createOrganizationExamMutationOptions(),
    {
      notify: true,
      successMessage: t("exam-created-successfully"),
      method: "POST",
    },
    {
      onSuccess: async () => {
        await getOrgExams.refetch()
        close()
      },
    },
  )

  const duplicateExamMutation = useToastMutationOptions(
    duplicateExamMutationOptions(),
    {
      notify: true,
      successMessage: t("exam-duplicated-successfully"),
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

  const renderForm = (exams: OrgExam[]) => (
    <NewExamForm
      exams={exams}
      initialData={null}
      organizationId={organizationId}
      onCancel={close}
      onCreateNewExam={(newExam) =>
        createExamMutation.mutate({
          body: newExam,
          path: {
            organization_id: organizationId,
          },
        })
      }
      onDuplicateExam={(parentId: string, newExam: NewExam) =>
        duplicateExamMutation.mutate({
          path: {
            id: parentId,
          },
          body: newExam,
        })
      }
    />
  )

  return (
    <StandardDialog open={open} onClose={onClose} title={t("new-exam")}>
      {createExamMutation.isError && (
        <ErrorBanner variant={"readOnly"} error={createExamMutation.error} />
      )}
      {duplicateExamMutation.isError && (
        <ErrorBanner variant={"readOnly"} error={duplicateExamMutation.error} />
      )}
      <QueryResult query={getOrgExams} emptyFallback={renderForm([])}>
        {(exams) => renderForm(exams)}
      </QueryResult>
    </StandardDialog>
  )
}

export default NewExamDialog
