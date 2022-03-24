import { css } from "@emotion/css"
import { Dialog, DialogContentText, DialogTitle } from "@mui/material"
import { useTranslation } from "react-i18next"

import { newCourseInstance } from "../../../../../../services/backend/courses"
import { CourseInstanceForm } from "../../../../../../shared-module/bindings"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import useToastMutation from "../../../../../../shared-module/hooks/useToastMutation"
import { respondToOrLarger } from "../../../../../../shared-module/styles/respond"

import NewCourseInstanceForm from "./NewCourseInstanceForm"

interface NewCourseLanguageVersionDialogProps {
  showDialog: boolean
  courseId: string
  onClose: () => void
  onSubmit: () => Promise<void>
}

const NewCourseInstanceDialog: React.FC<NewCourseLanguageVersionDialogProps> = ({
  courseId,
  onClose,
  showDialog,
  onSubmit,
}) => {
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
      className={css`
        z-index: 10000;
      `}
      // eslint-disable-next-line i18next/no-literal-string
      aria-label={t("new-course-instance-dialog")}
      role="dialog"
    >
      <div
        className={css`
          padding: 1rem;
          width: 80vw;
          max-width: 500px;
        `}
      >
        {/* <DialogTitle id="alert-dialog-title">{t("new-course-instance")}</DialogTitle> */}
        <h2 aria-label={t("new-course-instance")}>{t("new-course-instance")}</h2>
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
