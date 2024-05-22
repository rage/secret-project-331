import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { newCourseInstance } from "../../../../../../services/backend/courses"

import NewCourseInstanceForm from "./NewCourseInstanceForm"

import { CourseInstanceForm } from "@/shared-module/common/bindings"
import Dialog from "@/shared-module/common/components/Dialog"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
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
      await newCourseInstance(courseId, form)
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
    <Dialog
      open={showDialog}
      role="dialog"
      aria-labelledby="label"
      noPadding={true}
      title={t("new-course-instance-dialog")}
      className={css`
        z-index: 10000;
        display: flex;
        flex-direction: column;
        align-content: center;
      `}
    >
      <div
        className={css`
          padding: 1rem;
        `}
      >
        <h1
          id="label"
          className={css`
            font-size: 32px;
          `}
        >
          {t("new-course-instance")}
        </h1>
        {mutation.isError && <ErrorBanner variant={"readOnly"} error={mutation.error} />}
        <NewCourseInstanceForm
          initialData={null}
          onSubmit={(data) => {
            mutation.mutate(data)
          }}
          onCancel={onClose}
        />
      </div>
    </Dialog>
  )
}

export default NewCourseInstanceDialog
