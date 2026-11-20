"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type { ExerciseServiceNewOrUpdate } from "@/generated/api/types.generated"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { validURL } from "@/shared-module/common/utils/validation"
import { Dialog } from "@/shared-module/components"

import ContentArea from "./ContentArea"
import ExerciseServiceFlagFields, { type ExerciseServiceFlags } from "./ExerciseServiceFlagFields"

interface ExerciseServiceCreationModelProps {
  onChange: (key: string) => (value: string) => void
  onChangeName: (value: string) => void
  onChangeFlags: (flags: ExerciseServiceFlags) => void
  exercise_service: ExerciseServiceNewOrUpdate
  handleSubmit: () => Promise<void>
  handleClose: () => void
  open: boolean
}

const EXERCISE_SERVICE_SLUG = "slug"
const SERVICE_PUBLIC_URL = "public_url"
const SERVICE_INTERNAL_URL = "internal_url"
const MAX_REPROCESSING_SUBMISSION_AT_ONCE = "max_reprocessing_submissions_at_once"

const ExerciseServiceCreationModal: React.FC<
  React.PropsWithChildren<ExerciseServiceCreationModelProps>
> = ({
  open,
  handleClose,
  exercise_service,
  onChange,
  onChangeName,
  onChangeFlags,
  handleSubmit,
}) => {
  const { t } = useTranslation()
  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={t("title-new-exercise-service")}
      actions={[
        { label: t("button-text-cancel"), variant: "secondary", onPress: handleClose },
        { label: t("button-text-create"), variant: "primary", onPress: handleSubmit },
      ]}
    >
      <ContentArea
        title={t("text-field-label-name")}
        text={exercise_service.name}
        editing={true}
        onChange={onChangeName}
        type={"text"}
      />
      <ContentArea
        title={t("text-field-label-or-header-slug-or-short-name")}
        text={exercise_service.slug}
        editing={true}
        onChange={onChange(EXERCISE_SERVICE_SLUG)}
        type={"text"}
      />
      <ContentArea
        title={t("title-public-url")}
        text={exercise_service.public_url}
        editing={true}
        onChange={onChange(SERVICE_PUBLIC_URL)}
        type={"text"}
        {...includeIf(!!exercise_service.public_url && !validURL(exercise_service.public_url), {
          error: t("invalid-url"),
        })}
      />
      <ContentArea
        title={t("title-internal-url")}
        text={exercise_service.internal_url ?? null}
        editing={true}
        onChange={onChange(SERVICE_INTERNAL_URL)}
        type={"text"}
      />
      <ContentArea
        title={t("title-reprocessing-submissions")}
        text={exercise_service.max_reprocessing_submissions_at_once}
        editing={true}
        onChange={onChange(MAX_REPROCESSING_SUBMISSION_AT_ONCE)}
        type={"number"}
        {...includeIf(exercise_service.max_reprocessing_submissions_at_once < 0, {
          error: t("error-title"),
        })}
      />
      <ExerciseServiceFlagFields flags={exercise_service} onChange={onChangeFlags} />
    </Dialog>
  )
}

export default ExerciseServiceCreationModal
