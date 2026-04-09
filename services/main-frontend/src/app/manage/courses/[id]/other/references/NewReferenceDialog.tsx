"use client"

import { UseQueryResult } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import NewReferenceForm from "@/components/forms/NewReferenceForm"
import { createCourseReferences } from "@/generated/api/sdk.generated"
import type { MaterialReference, NewMaterialReference } from "@/generated/api/types.generated"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

interface NewReferenceModalProps {
  onClose: () => void
  open: boolean
  courseId: string
  fetchCourseReferences: UseQueryResult<MaterialReference[], Error>
}

const NewReferenceDialog: React.FC<React.PropsWithChildren<NewReferenceModalProps>> = ({
  onClose,
  open,
  courseId,
  fetchCourseReferences,
}) => {
  const { t } = useTranslation()
  const createReferenceMutation = useToastMutation(
    (references: NewMaterialReference[]) =>
      createCourseReferences({
        body: references,
        path: {
          course_id: courseId,
        },
      }),
    {
      notify: true,
      successMessage: t("reference-added-successfully"),
      method: "POST",
    },
    {
      onSuccess: () => {
        fetchCourseReferences.refetch()
        onClose()
      },
    },
  )

  return (
    <StandardDialog open={open} onClose={onClose} title={t("new-reference")}>
      <NewReferenceForm
        onCancel={onClose}
        onCreateNewReference={(newReference) => createReferenceMutation.mutate(newReference)}
      />
    </StandardDialog>
  )
}

export default NewReferenceDialog
