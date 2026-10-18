"use client"

import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  adminDeleteExternalCreditTarget,
  adminPauseExternalCreditTarget,
  adminResumeExternalCreditTarget,
} from "@/generated/api/sdk.generated"
import type { ExternalCreditTarget } from "@/generated/api/types.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { Menu } from "@/shared-module/components"

import { CREDIT_REGISTRATION_NS } from "../constants"
import { useInvalidateCourseStats } from "./adminCreditRegistrationHooks"
import ExternalCreditTargetDialog from "./ExternalCreditTargetDialog"
import { ReasonConfirmDialog } from "./ReasonConfirmDialog"
import { usePauseResumeAction } from "./usePauseResumeAction"

interface Props {
  target: ExternalCreditTarget
  hasRegistrations: boolean
}

/** Edit, pause/resume and delete for one mooc.fi target's row on the Courses tab. */
const ExternalCreditTargetActions: React.FC<Props> = ({ target, hasRegistrations }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const invalidateCourseStats = useInvalidateCourseStats()
  const [isEditOpen, setEditOpen] = useState(false)
  const [isDeleteOpen, setDeleteOpen] = useState(false)
  const name = `mooc.fi: ${target.name}`

  const { pauseItem, resumeItem, dialog } = usePauseResumeAction({
    pause: (fields) =>
      adminPauseExternalCreditTarget({
        path: { external_credit_target_id: target.id },
        body: { reason: fields.reason },
      }),
    resume: () =>
      adminResumeExternalCreditTarget({
        path: { external_credit_target_id: target.id },
        body: { reason: null },
      }),
    invalidate: () => void invalidateCourseStats(),
    resumeConfirmMessage: t("credit-registration-admin-moocfi-resume-confirm", { name }),
    pauseActionLabel: t("button-text-credit-registration-course-pause"),
    resumeActionLabel: t("button-text-credit-registration-course-resume"),
    pauseDialogTitle: t("credit-registration-admin-moocfi-pause-title", { name }),
    pauseReasonDescription: t("credit-registration-admin-moocfi-pause-reason-description"),
  })

  const deleteMutation = useToastMutation(
    (reason: string) =>
      adminDeleteExternalCreditTarget({
        path: { external_credit_target_id: target.id },
        body: { reason },
      }),
    { notify: true, method: "DELETE" },
    {
      onSuccess: () => {
        setDeleteOpen(false)
        void invalidateCourseStats()
      },
    },
  )

  return (
    <>
      <Menu
        aria-label={t("credit-registration-admin-course-row-actions", { module: name })}
        items={[
          {
            // oxlint-disable-next-line i18next/no-literal-string -- menu item identity, not user-facing text
            key: "edit",
            label: t("credit-registration-admin-moocfi-edit"),
            onAction: () => setEditOpen(true),
          },
          target.paused_at ? resumeItem : pauseItem,
          {
            // oxlint-disable-next-line i18next/no-literal-string -- menu item identity, not user-facing text
            key: "delete",
            label: t("credit-registration-admin-moocfi-delete"),
            onAction: () => setDeleteOpen(true),
          },
        ]}
      />
      {dialog}
      {isEditOpen && (
        <ExternalCreditTargetDialog
          isOpen
          onClose={() => setEditOpen(false)}
          target={target}
          hasRegistrations={hasRegistrations}
        />
      )}
      <ReasonConfirmDialog
        open={isDeleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t("credit-registration-admin-moocfi-delete-title", { name })}
        description={t("credit-registration-admin-moocfi-delete-description")}
        confirmLabel={t("credit-registration-admin-moocfi-delete")}
        isDestructive
        isPending={deleteMutation.isPending}
        onConfirm={(reason) => deleteMutation.mutate(reason)}
      />
    </>
  )
}

export default ExternalCreditTargetActions
