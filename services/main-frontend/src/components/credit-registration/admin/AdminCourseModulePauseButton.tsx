"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import {
  adminPauseCourseModuleCreditRegistration,
  adminResumeCourseModuleCreditRegistration,
} from "@/generated/api/sdk.generated"

import { useInvalidateCourseStats } from "./adminCreditRegistrationHooks"
import { pauseResumeRootCss, usePauseResumeAction } from "./usePauseResumeAction"

interface Props {
  courseModuleId: string
  courseModuleName: string
  paused: boolean
}

/** Pausing a module stops every phase claiming its rows; it is not an item-level pause. */
const AdminCourseModulePauseButton: React.FC<Props> = ({
  courseModuleId,
  courseModuleName,
  paused,
}) => {
  const { t } = useTranslation()
  const invalidateCourseStats = useInvalidateCourseStats()

  const { pauseButton, resumeButton, dialog } = usePauseResumeAction({
    pause: (fields) =>
      adminPauseCourseModuleCreditRegistration({
        path: { course_module_id: courseModuleId },
        body: { reason: fields.reason },
      }),
    resume: () =>
      adminResumeCourseModuleCreditRegistration({
        path: { course_module_id: courseModuleId },
        body: { reason: null },
      }),
    invalidate: () => void invalidateCourseStats(),
    resumeConfirmMessage: t("credit-registration-admin-course-resume-confirm", {
      module: courseModuleName,
    }),
    pauseButtonLabel: t("button-text-credit-registration-course-pause"),
    resumeButtonLabel: t("button-text-credit-registration-course-resume"),
    pauseDialogTitle: t("credit-registration-admin-course-pause-title", {
      module: courseModuleName,
    }),
    pauseReasonDescription: t("credit-registration-admin-course-pause-reason-description"),
  })

  return (
    <div className={pauseResumeRootCss}>
      {paused ? resumeButton : pauseButton}
      {dialog}
    </div>
  )
}

export default AdminCourseModulePauseButton
