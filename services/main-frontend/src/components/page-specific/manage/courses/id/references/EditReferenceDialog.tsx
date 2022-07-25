import { css } from "@emotion/css"
import { Dialog, DialogContent, DialogTitle } from "@mui/material"
import { UseQueryResult } from "@tanstack/react-query"
import { t } from "i18next"

import { deleteReference, postReferenceUpdate } from "../../../../../../services/backend/courses"
import { MaterialReference, NewMaterialReference } from "../../../../../../shared-module/bindings"
import useToastMutation from "../../../../../../shared-module/hooks/useToastMutation"
import EditReferenceForm from "../../../../../forms/EditReferenceForm"

interface EditReferenceDialogProps {
  getCourseReferences: UseQueryResult<MaterialReference[], unknown>
  courseId: string
  reference: MaterialReference
  onClose: () => void
  open: boolean
}

const EditReferenceDialog: React.FC<React.PropsWithChildren<EditReferenceDialogProps>> = ({
  courseId,
  getCourseReferences,
  reference,
  onClose,
  open,
}) => {
  const updateReferenceMutation = useToastMutation(
    ({
      courseId,
      id,
      reference,
    }: {
      courseId: string
      id: string
      reference: NewMaterialReference
    }) => postReferenceUpdate(courseId, id, reference),
    {
      notify: true,
      successMessage: t("reference-updated-succesfully"),
      method: "POST",
    },
    {
      onSuccess: () => {
        getCourseReferences.refetch()
        onClose()
      },
    },
  )

  const deleteReferenceMutation = useToastMutation(
    ({ courseId, id }: { courseId: string; id: string }) => deleteReference(courseId, id),
    {
      notify: true,
      successMessage: t("reference-deleted-succesfully"),
      method: "DELETE",
    },
    {
      onSuccess: () => {
        getCourseReferences.refetch()
        onClose()
      },
    },
  )

  return (
    <Dialog
      open={open}
      onClose={onClose}
      role="dialog"
      aria-labelledby="label"
      title={t("edit-reference-dialog")}
      fullWidth
    >
      <DialogTitle>
        <h3
          id="dialog-label"
          className={css`
            font-size: 32px;
          `}
        >
          {t("edit-reference")}
        </h3>
      </DialogTitle>
      <DialogContent role="main" id="alert-dialog-description">
        <EditReferenceForm
          onCancel={onClose}
          onDelete={(courseId, id) => deleteReferenceMutation.mutate({ courseId, id })}
          onEdit={(courseId, id, reference) =>
            updateReferenceMutation.mutate({ courseId, id, reference })
          }
          reference={reference}
          courseId={courseId}
        />
      </DialogContent>
    </Dialog>
  )
}

export default EditReferenceDialog
