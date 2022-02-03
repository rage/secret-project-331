import { css } from "@emotion/css"
import { Dialog } from "@material-ui/core"

import { newCourseInstance } from "../../../../../../services/backend/courses"
import { CourseInstanceForm } from "../../../../../../shared-module/bindings"
import useToastMutation from "../../../../../../shared-module/hooks/useToastMutation"

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
  const mutation = useToastMutation(
    async (form: CourseInstanceForm) => {
      await newCourseInstance(courseId, form)
    },
    {
      notify: true,
      method: "POST",
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
    >
      <div
        className={css`
          margin: 1rem;
        `}
      >
        <NewCourseInstanceForm
          initialData={null}
          onSubmit={async (data) => {
            mutation.mutate(data)
            await onSubmit()
          }}
          onCancel={onClose}
        />
      </div>
    </Dialog>
  )
}

export default NewCourseInstanceDialog
