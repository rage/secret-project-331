"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import EditReferenceForm, { EDIT_REFERENCE_FORM_ID } from "@/components/forms/EditReferenceForm"
import { deleteCourseReference, updateCourseReference } from "@/generated/api/sdk.generated"
import type { MaterialReference, NewMaterialReference } from "@/generated/api/types.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { Dialog } from "@/shared-module/components"

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
    <Dialog
      open={open}
      onClose={onClose}
      title={t("edit-reference")}
      actions={[
        {
          label: t("delete"),
          variant: "secondary",
          onPress: () => deleteReferenceMutation.mutate({ courseId, id: reference.id }),
        },
        {
          label: t("save"),
          variant: "primary",
          type: "submit",
          domProps: { form: EDIT_REFERENCE_FORM_ID },
        },
      ]}
    >
      <EditReferenceForm
        onCancel={onClose}
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
    </Dialog>
  )
}

export default EditReferenceDialog
