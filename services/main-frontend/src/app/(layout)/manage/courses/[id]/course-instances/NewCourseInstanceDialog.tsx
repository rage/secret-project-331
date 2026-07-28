"use client"

import { useTranslation } from "react-i18next"

import { createCourseInstance } from "@/generated/api/sdk.generated"
import type { CourseInstanceForm } from "@/generated/api/types.generated"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

import NewCourseInstanceForm from "./NewCourseInstanceForm"

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
