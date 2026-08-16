"use client"

import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  adminPauseCourseModuleCreditRegistration,
  adminResumeCourseModuleCreditRegistration,
} from "@/generated/api/sdk.generated"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { Button } from "@/shared-module/components"

import { useInvalidateCourseStats } from "./adminCreditRegistrationHooks"
import { ReasonConfirmDialog } from "./ReasonConfirmDialog"

interface Props {
  courseModuleId: string
  courseModuleName: string
  paused: boolean
}

const rootCss = css`
  display: flex;
  gap: 0.4rem;
`

/** Pausing a module stops every phase claiming its rows; it is not an item-level pause. */
const AdminCourseModulePauseButton: React.FC<Props> = ({
  courseModuleId,
  courseModuleName,
  paused,
}) => {
  const { t } = useTranslation()
  const { confirm } = useDialog()
  const [pauseOpen, setPauseOpen] = useState(false)
  const invalidateCourseStats = useInvalidateCourseStats()

  const pauseMutation = useToastMutation(
    (fields: { reason: string }) =>
      adminPauseCourseModuleCreditRegistration({
        path: { course_module_id: courseModuleId },
        body: { reason: fields.reason },
      }),
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        setPauseOpen(false)
        void invalidateCourseStats()
      },
    },
  )
  const resumeMutation = useToastMutation(
    () =>
      adminResumeCourseModuleCreditRegistration({
        path: { course_module_id: courseModuleId },
        body: { reason: null },
      }),
    { notify: true, method: "POST" },
    { onSuccess: () => void invalidateCourseStats() },
  )

  return (
    <div className={rootCss}>
      {paused ? (
        <Button
          variant="tertiary"
          size="small"
          isLoading={resumeMutation.isPending}
          onClick={async () => {
            const confirmed = await confirm(
              t("credit-registration-admin-course-resume-confirm", { module: courseModuleName }),
            )
            if (confirmed) {
              resumeMutation.mutate()
            }
          }}
        >
          {t("button-text-credit-registration-course-resume")}
        </Button>
      ) : (
        <Button variant="tertiary" size="small" onClick={() => setPauseOpen(true)}>
          {t("button-text-credit-registration-course-pause")}
        </Button>
      )}
      <ReasonConfirmDialog
        open={pauseOpen}
        onClose={() => setPauseOpen(false)}
        title={t("credit-registration-admin-course-pause-title", { module: courseModuleName })}
        reasonDescription={t("credit-registration-admin-course-pause-reason-description")}
        isPending={pauseMutation.isPending}
        onConfirm={(reason) => pauseMutation.mutate({ reason })}
      />
    </div>
  )
}

export default AdminCourseModulePauseButton
