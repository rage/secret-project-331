"use client"

import { css } from "@emotion/css"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button } from "@/shared-module/components/"

import NewExternalCourseDialog from "./NewExternalCourseDialog"

// interface ExternalCourseFormProps {
//   onSubmitForm: (data: ExternalCourseData) => void
//   open: boolean
//   onClose: () => void
// }

const ExternalCourses = () => {
  const { t } = useTranslation()
  usePageTitle(t("external-courses"))
  const [newExternalCourseFormOpen, setNewExternalCourseFormOpen] = useState(false)

  return (
    <div>
      <NewExternalCourseDialog
        open={newExternalCourseFormOpen}
        onClose={() => setNewExternalCourseFormOpen(false)}
      />
      <Button size="medium" variant="primary" onClick={() => setNewExternalCourseFormOpen(true)}>
        {t("button-text-create")}
      </Button>
    </div>
  )
}
export default withErrorBoundary(withSignedIn(ExternalCourses))
