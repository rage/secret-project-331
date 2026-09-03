"use client"

import { useTranslation } from "react-i18next"

import { createCourseInstance } from "@/generated/api/sdk.generated"
import type { CourseInstanceForm } from "@/generated/api/types.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { Dialog } from "@/shared-module/components"

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
    <Dialog open={showDialog} onClose={onClose} title={t("new-course-instance")}>
      {/* notify:true already announces this error via the toast; the banner is just the persistent copy */}
      {mutation.isError && (
        // oxlint-disable-next-line i18next/no-literal-string -- "off" is an ErrorNoticeAnnouncement enum value, not UI text
        <ErrorBanner variant={"readOnly"} error={mutation.error} announce="off" />
      )}
      <NewCourseInstanceForm
        initialData={null}
        onSubmit={(data) => {
          mutation.mutate(data)
        }}
        onCancel={onClose}
      />
    </Dialog>
  )
}

export default NewCourseInstanceDialog
