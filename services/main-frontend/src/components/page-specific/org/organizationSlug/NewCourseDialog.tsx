import React from "react"
import { useTranslation } from "react-i18next"

import NewCourseForm from "../../../NewCourseForm"

import { NewCourse } from "@/shared-module/common/bindings"
import StandardDialog from "@/shared-module/common/components/StandardDialog"

interface NewCourseDialogProps {
  open: boolean
  onClose: () => void
  organizationId: string
  onSubmitNewCourse: (newCourse: NewCourse) => Promise<void>
  onSubmitDuplicateCourse: (oldCourseId: string, newCourse: NewCourse) => Promise<void>
}

const NewCourseDialog: React.FC<NewCourseDialogProps> = ({
  open,
  onClose,
  organizationId,
  onSubmitNewCourse,
  onSubmitDuplicateCourse,
}) => {
  const { t } = useTranslation()

  return (
    <StandardDialog open={open} onClose={onClose} title={t("new-course")}>
      <NewCourseForm
        organizationId={organizationId}
        onSubmitNewCourseForm={onSubmitNewCourse}
        onSubmitDuplicateCourseForm={onSubmitDuplicateCourse}
        onClose={onClose}
      />
    </StandardDialog>
  )
}

export default NewCourseDialog
