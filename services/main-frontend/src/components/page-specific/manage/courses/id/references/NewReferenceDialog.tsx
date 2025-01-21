import { UseQueryResult } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { postNewReferences } from "../../../../../../services/backend/courses"
import NewReferenceForm from "../../../../../forms/NewReferenceForm"

import { MaterialReference, NewMaterialReference } from "@/shared-module/common/bindings"
import StandardDialog from "@/shared-module/common/components/StandardDialog"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

interface NewReferenceModalProps {
  onClose: () => void
  open: boolean
  courseId: string
  fetchCourseReferences: UseQueryResult<MaterialReference[], unknown>
}

const NewReferenceDialog: React.FC<React.PropsWithChildren<NewReferenceModalProps>> = ({
  onClose,
  open,
  courseId,
  fetchCourseReferences,
}) => {
  const { t } = useTranslation()
  const createReferenceMutation = useToastMutation(
    (references: NewMaterialReference[]) => postNewReferences(courseId, references),
    {
      notify: true,
      successMessage: t("reference-added-succesfully"),
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
