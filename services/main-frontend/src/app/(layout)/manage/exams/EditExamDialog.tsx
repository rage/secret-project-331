"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import EditExamForm, { EDIT_EXAM_FORM_ID } from "@/components/forms/EditExamForm"
import { editExamMutation } from "@/generated/api/@tanstack/react-query.generated"
import type { Exam, NewExam } from "@/generated/api/types.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { Dialog } from "@/shared-module/components"

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
    <Dialog
      open={open}
      onClose={onClose}
      title={t("edit-exam")}
      actions={[
        {
          label: t("button-text-submit"),
          variant: "primary",
          type: "submit",
          domProps: { form: EDIT_EXAM_FORM_ID },
        },
      ]}
    >
      {/* notify:true already announces this error via the toast; the banner is just the persistent copy */}
      {createExamMutation.isError && (
        // oxlint-disable-next-line i18next/no-literal-string -- "off" is an ErrorNoticeAnnouncement enum value, not UI text
        <ErrorBanner variant={"readOnly"} error={createExamMutation.error} announce="off" />
      )}
      <EditExamForm
        initialData={initialData}
        organizationId={organizationId}
        onEditExam={(exam: NewExam) =>
          createExamMutation.mutate({
            path: {
              id: examId,
            },
            body: exam,
          })
        }
      />
    </Dialog>
  )
}

export default EditExamDialog
