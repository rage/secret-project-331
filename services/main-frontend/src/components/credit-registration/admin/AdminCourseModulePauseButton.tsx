"use client"

import { useRouter } from "next/navigation"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  adminPauseCourseModuleCreditRegistration,
  adminResumeCourseModuleCreditRegistration,
} from "@/generated/api/sdk.generated"
import { manageCourseModulesRoute } from "@/shared-module/common/utils/routes"
import { Menu } from "@/shared-module/components"

import { CREDIT_REGISTRATION_NS } from "../constants"
import { useInvalidateCourseStats } from "./adminCreditRegistrationHooks"
import { usePauseResumeAction } from "./usePauseResumeAction"

interface Props {
  courseId: string
  courseModuleId: string
  courseModuleName: string
  paused: boolean
}

/** Pause/resume and configuration link for one course module's row, collapsed behind one menu. */
const AdminCourseModulePauseButton: React.FC<Props> = ({
  courseId,
  courseModuleId,
  courseModuleName,
  paused,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const router = useRouter()
  const invalidateCourseStats = useInvalidateCourseStats()

  const { pauseItem, resumeItem, dialog } = usePauseResumeAction({
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
    pauseActionLabel: t("button-text-credit-registration-course-pause"),
    resumeActionLabel: t("button-text-credit-registration-course-resume"),
    pauseDialogTitle: t("credit-registration-admin-course-pause-title", {
      module: courseModuleName,
    }),
    pauseReasonDescription: t("credit-registration-admin-course-pause-reason-description"),
  })

  return (
    <>
      <Menu
        aria-label={t("credit-registration-admin-course-row-actions", {
          module: courseModuleName,
        })}
        items={[
          paused ? resumeItem : pauseItem,
          {
            // oxlint-disable-next-line i18next/no-literal-string -- menu item identity, not user-facing text
            key: "edit",
            label: t("credit-registration-admin-edit-module-configuration"),
            onAction: () => router.push(manageCourseModulesRoute(courseId)),
          },
        ]}
      />
      {dialog}
    </>
  )
}

export default AdminCourseModulePauseButton
