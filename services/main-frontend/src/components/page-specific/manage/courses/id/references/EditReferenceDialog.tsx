import { css } from "@emotion/css"
import { UseQueryResult } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { deleteReference, postReferenceUpdate } from "../../../../../../services/backend/courses"
import EditReferenceForm from "../../../../../forms/EditReferenceForm"

import { MaterialReference, NewMaterialReference } from "@/shared-module/common/bindings"
import Dialog from "@/shared-module/common/components/Dialog"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

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
  const { t } = useTranslation()
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
      title={t("edit-reference")}
      noPadding={true}
    >
      <h3
        id="dialog-label"
        className={css`
          font-size: 32px !important;
          padding: 16px 24px;
        `}
      >
        {t("edit-reference")}
      </h3>
      <div
        className={css`
          padding: 0px 24px 20px;
        `}
      >
        <EditReferenceForm
          onCancel={onClose}
          onDelete={(courseId, id) => deleteReferenceMutation.mutate({ courseId, id })}
          onEdit={(courseId, id, reference) =>
            updateReferenceMutation.mutate({ courseId, id, reference })
          }
          reference={reference}
          courseId={courseId}
        />
      </div>
    </Dialog>
  )
}

export default EditReferenceDialog
