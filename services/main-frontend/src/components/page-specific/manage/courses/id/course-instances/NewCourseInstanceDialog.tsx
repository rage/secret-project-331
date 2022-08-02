import { css } from "@emotion/css"
import { Dialog, DialogContentText } from "@mui/material"
import { useTranslation } from "react-i18next"

import { newCourseInstance } from "../../../../../../services/backend/courses"
import { CourseInstanceForm } from "../../../../../../shared-module/bindings"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import useToastMutation from "../../../../../../shared-module/hooks/useToastMutation"

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
      onClose={(_, reason) => {
        if (reason && reason === "backdropClick") {
          return
        }
        onClose()
      }}
      role="dialog"
      aria-labelledby="label"
      title={t("new-course-instance-dialog")}
      className={css`
        z-index: 10000;
      `}
    >
      <div
        className={css`
          padding: 1rem;
          width: 80vw;
          max-width: 500px;
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
        <DialogContentText role="main" id="alert-dialog-description">
          {mutation.isError && <ErrorBanner variant={"readOnly"} error={mutation.error} />}
          <NewCourseInstanceForm
            initialData={null}
            onSubmit={(data) => {
              mutation.mutate(data)
            }}
            onCancel={onClose}
          />
        </DialogContentText>
      </div>
    </Dialog>
  )
}

export default NewCourseInstanceDialog
