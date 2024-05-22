import { css } from "@emotion/css"
import { UseQueryResult } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { postNewReferences } from "../../../../../../services/backend/courses"
import NewReferenceForm from "../../../../../forms/NewReferenceForm"

import { MaterialReference, NewMaterialReference } from "@/shared-module/common/bindings"
import Dialog from "@/shared-module/common/components/Dialog"
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
    <Dialog
      open={open}
      onClose={onClose}
      role="dialog"
      aria-labelledby="label"
      title={t("new-reference")}
      noPadding
    >
      <h3
        id="dialog-label"
        className={css`
          font-size: 32px !important;
          padding: 16px 24px;
        `}
      >
        {t("new-reference")}
      </h3>
      <div
        id="alert-dialog-description"
        className={css`
          padding: 0px 24px 20px;
        `}
      >
        <NewReferenceForm
          onCancel={onClose}
          onCreateNewReference={(newReference) => createReferenceMutation.mutate(newReference)}
        />
      </div>
    </Dialog>
  )
}

export default NewReferenceDialog
