import styled from "@emotion/styled"
import { useTranslation } from "react-i18next"

import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"

interface ClosedCourseWarningDialogProps {
  courseId: string
  open: boolean
  onClose: () => void
  additionalMessage?: string | null
}

const ClosedCourseWarningDialog = ({
  courseId,
  open,
  onClose,
  additionalMessage,
}: ClosedCourseWarningDialogProps) => {
  const { t } = useTranslation("course-material")

  return (
    <StandardDialog open={open} onClose={onClose} title={t("course-closed-warning-title")}>
      <div>
        <p>{t("course-closed-warning-message")}</p>
        <p>{t("course-closed-successor-message")}</p>
        {additionalMessage && (
          <p>{t("course-closed-additional-message", { message: additionalMessage })}</p>
        )}
      </div>
    </StandardDialog>
  )
}

export default ClosedCourseWarningDialog
