import { UseQueryResult } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { deleteReference, postReferenceUpdate } from "../../../../../../services/backend/courses"
import EditReferenceForm from "../../../../../forms/EditReferenceForm"

import { MaterialReference, NewMaterialReference } from "@/shared-module/common/bindings"
import StandardDialog from "@/shared-module/common/components/StandardDialog"
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
      successMessage: t("reference-updated-successfully"),
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
      successMessage: t("reference-deleted-successfully"),
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
    <StandardDialog open={open} onClose={onClose} title={t("edit-reference")}>
      <EditReferenceForm
        onCancel={onClose}
        onDelete={(courseId, id) => deleteReferenceMutation.mutate({ courseId, id })}
        onEdit={(courseId, id, reference) =>
          updateReferenceMutation.mutate({ courseId, id, reference })
        }
        reference={reference}
        courseId={courseId}
      />
    </StandardDialog>
  )
}

export default EditReferenceDialog
