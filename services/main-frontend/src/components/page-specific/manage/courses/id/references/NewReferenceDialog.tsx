import { css } from "@emotion/css"
import { Dialog, DialogContentText } from "@mui/material"
import { t } from "i18next"
import { UseQueryResult } from "react-query"

import { postNewReferences } from "../../../../../../services/backend/courses"
import { MaterialReference, NewMaterialReference } from "../../../../../../shared-module/bindings"
import useToastMutation from "../../../../../../shared-module/hooks/useToastMutation"
import NewReferenceForm from "../../../../../forms/NewReferenceForm"

interface NewReferenceModalProps {
  onClose: () => void
  open: boolean
  courseId: string
  fetchCourseReferences: UseQueryResult<MaterialReference[], unknown>
}

const NewReferenceDialog: React.FC<NewReferenceModalProps> = ({
  onClose,
  open,
  courseId,
  fetchCourseReferences,
}) => {
  const createReferenceMutation = useToastMutation(
    (references: NewMaterialReference[]) => postNewReferences(courseId, references),
    {
      notify: true,
      successMessage: t("reference-added-succesfully"),
      method: "POST",
    },
    { onSuccess: () => fetchCourseReferences.refetch() },
  )

  return (
    <div>
      <Dialog
        open={open}
        onClose={onClose}
        role="dialog"
        aria-labelledby="label"
        title={t("new-reference-dialog")}
      >
        <div
          id="new-reference-dialog"
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
            {t("new-reference")}
          </h1>
          <DialogContentText role="main" id="alert-dialog-description">
            <NewReferenceForm
              onCancel={onClose}
              onCreateNewReference={(newReference) => createReferenceMutation.mutate(newReference)}
            />
          </DialogContentText>
        </div>
      </Dialog>
    </div>
  )
}

export default NewReferenceDialog
