"use client"

import { useTranslation } from "react-i18next"

import NewCourseInstanceForm from "./NewCourseInstanceForm"

import { createCourseInstance } from "@/generated/api/sdk.generated"
import type { CourseInstanceForm } from "@/generated/api/types.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

interface NewCourseLanguageVersionDialogProps {
  showDialog: boolean
  courseId: string
  onClose: () => void
  onSubmit: () => Promise<void>
}

const NewCourseInstanceDialog: React.FC<
  React.PropsWithChildren<NewCourseLanguageVersionDialogProps>
> = ({ courseId, onClose, showDialog, onSubmit }) => {
  const { t } = useTranslation()
  const mutation = useToastMutation(
    async (form: CourseInstanceForm) => {
      await createCourseInstance({
        body: form,
        path: {
          course_id: courseId,
        },
        throwOnError: true,
      })
    },
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: () => {
        onSubmit()
      },
    },
  )

  return (
    <StandardDialog open={showDialog} onClose={onClose} title={t("new-course-instance")}>
      {mutation.isError && <ErrorBanner variant={"readOnly"} error={mutation.error} />}
      <NewCourseInstanceForm
        initialData={null}
        onSubmit={(data) => {
          mutation.mutate(data)
        }}
        onCancel={onClose}
      />
    </StandardDialog>
  )
}

export default NewCourseInstanceDialog
