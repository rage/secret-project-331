"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import EditReferenceForm from "@/components/forms/EditReferenceForm"
import { deleteCourseReference, updateCourseReference } from "@/generated/api/sdk.generated"
import type { MaterialReference, NewMaterialReference } from "@/generated/api/types.generated"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

interface EditReferenceDialogProps {
  getCourseReferences: UseQueryResult<MaterialReference[], Error>
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
      courseId: updateCourseId,
      id,
      reference: updateReference,
    }: {
      courseId: string
      id: string
      reference: NewMaterialReference
    }) =>
      updateCourseReference({
        body: updateReference,
        path: {
          course_id: updateCourseId,
          reference_id: id,
        },
      }),
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
    ({ courseId: deleteCourseId, id }: { courseId: string; id: string }) =>
      deleteCourseReference({
        path: {
          course_id: deleteCourseId,
          reference_id: id,
        },
      }),
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
        onDelete={(deleteCourseId, id) =>
          deleteReferenceMutation.mutate({ courseId: deleteCourseId, id })
        }
        onEdit={(editCourseId, id, editReference) =>
          updateReferenceMutation.mutate({
            courseId: editCourseId,
            id,
            reference: editReference,
          })
        }
        reference={reference}
        courseId={courseId}
      />
    </StandardDialog>
  )
}

export default EditReferenceDialog
