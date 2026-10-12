"use client"

import { css } from "@emotion/css"
import { fromDate, parseDateTime, toCalendarDateTime } from "@internationalized/date"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  adminCreateExternalCreditTarget,
  adminUpdateExternalCreditTarget,
} from "@/generated/api/sdk.generated"
import type {
  AdminExternalCreditTargetPayload,
  ExternalCreditTarget,
  ExternalGrading,
} from "@/generated/api/types.generated"
import { isAppApiError } from "@/shared-module/common/errors/AppApiError"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { validateUUID } from "@/shared-module/common/utils/strings"
import type { DialogAction } from "@/shared-module/components"
import {
  Checkbox,
  DateTimeLocalField,
  Dialog,
  Infobox,
  NumberField,
  Select,
  TextField,
} from "@/shared-module/components"

import { BUTTON_PRIMARY, CREDIT_REGISTRATION_NS, TONE } from "../constants"
import { dialogFormCss } from "../styles"
import type { DialogOpenState } from "./AdminActionDialog"
import { useInvalidateCourseStats } from "./adminCreditRegistrationHooks"
import { ReasonField } from "./ReasonConfirmDialog"

/** mooc.fi and its admins keep the cutoff in Helsinki time. */
const CUTOFF_TIME_ZONE = "Europe/Helsinki"
/** `YYYY-MM-DDTHH:mm`, the minute precision the date-time field edits. */
const LOCAL_MINUTE_LENGTH = 16

/** The database's own check on `external_credit_targets.language_code`. */
const LANGUAGE_CODE_PATTERN = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$/

const TIERS_OVERLAP = "external_credit_target_tiers_overlap"
const COURSE_CODE_TAKEN = "external_credit_target_course_code_taken"
const MOOCFI_COURSE_FIXED = "external_credit_target_moocfi_course_fixed"

const PASS_FAIL: ExternalGrading = "pass_fail"
const NUMERIC: ExternalGrading = "numeric"
const VALIDATE_ON_COMMIT = "validate" as const

const fieldRowCss = css`
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  align-items: start;
`

const toCutoffLocal = (at: Date): string =>
  toCalendarDateTime(fromDate(at, CUTOFF_TIME_ZONE)).toString().slice(0, LOCAL_MINUTE_LENGTH)

const fromCutoffLocal = (value: string): string =>
  parseDateTime(value).toDate(CUTOFF_TIME_ZONE).toISOString()

interface Fields {
  moocfi_course_id: string
  moocfi_course_slug: string
  name: string
  language_code: string
  uh_course_code: string
  ects_credits: number | null
  grading: ExternalGrading
  enrolment_link: string
  lowest_tier: number | null
  highest_tier: number | null
  delegated_at: string
  enabled: boolean
  reason: string
}

const initialFields = (target: ExternalCreditTarget | null): Fields => ({
  moocfi_course_id: target?.moocfi_course_id ?? "",
  moocfi_course_slug: target?.moocfi_course_slug ?? "",
  name: target?.name ?? "",
  language_code: target?.language_code ?? "",
  uh_course_code: target?.uh_course_code ?? "",
  ects_credits: target?.ects_credits ?? null,
  grading: target?.grading ?? PASS_FAIL,
  enrolment_link: target?.enrolment_link ?? "",
  lowest_tier: target?.tiers?.lowest ?? null,
  highest_tier: target?.tiers?.highest ?? null,
  delegated_at: toCutoffLocal(target ? new Date(target.delegated_at) : new Date()),
  enabled: target ? Boolean(target.enabled_at) : false,
  reason: "",
})

interface Props extends DialogOpenState {
  /** `null` adds a new target. */
  target: ExternalCreditTarget | null
  /** The cutoff and the mooc.fi course are fixed once the target has registrations. */
  hasRegistrations: boolean
}

/** Adds a mooc.fi course to register credits for, or edits one. Every save is audited. */
const ExternalCreditTargetDialog: React.FC<Props> = ({
  isOpen,
  onClose,
  target,
  hasRegistrations,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const invalidateCourseStats = useInvalidateCourseStats()
  const initial = initialFields(target)
  const {
    control,
    handleSubmit,
    getValues,
    setError,
    formState: { errors },
  } = useForm<Fields>({ defaultValues: initial })

  const mutation = useToastMutation(
    (body: AdminExternalCreditTargetPayload) =>
      target
        ? adminUpdateExternalCreditTarget({
            path: { external_credit_target_id: target.id },
            body,
          })
        : adminCreateExternalCreditTarget({ body }),
    { notify: false },
    {
      onSuccess: () => {
        void invalidateCourseStats()
        onClose()
      },
      onError: (error) => {
        const messageKey = isAppApiError(error) ? error.messageKey : null
        if (messageKey === TIERS_OVERLAP) {
          setError("lowest_tier", {
            message: t("credit-registration-admin-moocfi-tiers-overlap"),
          })
        } else if (messageKey === COURSE_CODE_TAKEN) {
          setError("uh_course_code", {
            message: t("credit-registration-admin-moocfi-course-code-taken"),
          })
        } else if (messageKey === MOOCFI_COURSE_FIXED) {
          setError("moocfi_course_id", {
            message: t("credit-registration-admin-moocfi-course-id-fixed"),
          })
        } else {
          setError("root", {
            message: isAppApiError(error) ? (error.userMessage ?? error.message) : String(error),
          })
        }
      },
    },
  )

  const submit = handleSubmit((fields) => {
    const isTiered = fields.lowest_tier !== null || fields.highest_tier !== null
    mutation.mutate({
      moocfi_course_id: fields.moocfi_course_id.trim(),
      moocfi_course_slug: fields.moocfi_course_slug,
      name: fields.name,
      language_code: fields.language_code.trim(),
      uh_course_code: fields.uh_course_code,
      ects_credits: fields.ects_credits ?? 0,
      grading: fields.grading,
      enrolment_link: fields.enrolment_link.trim() === "" ? null : fields.enrolment_link,
      tiers: isTiered ? { lowest: fields.lowest_tier, highest: fields.highest_tier } : null,
      // The field edits minutes, so an untouched cutoff is sent back as stored, seconds and all.
      delegated_at:
        target && fields.delegated_at === initial.delegated_at
          ? target.delegated_at
          : fromCutoffLocal(fields.delegated_at),
      enabled: fields.enabled,
      reason: fields.reason,
    })
  })

  const actions: readonly [DialogAction] = [
    {
      label: t("button-text-save"),
      variant: BUTTON_PRIMARY,
      isLoading: mutation.isPending,
      onPress: () => void submit(),
    },
  ]
  const required = { required: t("required-field") }

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      size="wide"
      title={
        target
          ? t("credit-registration-admin-moocfi-edit-title", { name: target.name })
          : t("button-text-add-moocfi-course")
      }
      actions={actions}
    >
      <form className={dialogFormCss} onSubmit={submit}>
        {errors.root?.message && <Infobox tone={TONE.DANGER}>{errors.root.message}</Infobox>}
        <div className={fieldRowCss}>
          <TextField
            name="moocfi_course_id"
            control={control}
            label={t("label-moocfi-course-id")}
            description={
              hasRegistrations
                ? t("credit-registration-admin-moocfi-course-id-fixed")
                : t("credit-registration-admin-moocfi-course-id-description")
            }
            isDisabled={hasRegistrations}
            isRequired
            rules={{
              ...required,
              validate: (value) => validateUUID(value.trim()) || t("invalid-uuid-format"),
            }}
          />
          <TextField
            name="moocfi_course_slug"
            control={control}
            label={t("label-moocfi-course-slug")}
            isRequired
            rules={required}
          />
        </div>
        <div className={fieldRowCss}>
          <TextField
            name="name"
            control={control}
            label={t("label-name")}
            description={t("credit-registration-admin-moocfi-name-description")}
            isRequired
            rules={required}
          />
          <TextField
            name="language_code"
            control={control}
            label={t("label-language-code")}
            description={t("credit-registration-admin-moocfi-language-description")}
            isRequired
            rules={{
              ...required,
              validate: (value) =>
                LANGUAGE_CODE_PATTERN.test(value.trim()) ||
                t("credit-registration-admin-invalid-language-code"),
            }}
          />
        </div>
        <div className={fieldRowCss}>
          <TextField
            name="uh_course_code"
            control={control}
            label={t("uh-course-code")}
            isRequired
            rules={required}
          />
          <NumberField
            name="ects_credits"
            control={control}
            label={t("ects-credits")}
            minValue={0}
            step={0.5}
            commitBehavior={VALIDATE_ON_COMMIT}
            isRequired
            rules={{
              validate: (value) =>
                (value !== null && value > 0) || t("credit-registration-admin-ects-positive"),
            }}
          />
          <Select
            name="grading"
            control={control}
            label={t("label-grading")}
            options={[
              { value: PASS_FAIL, label: t("credit-registration-admin-grading-pass-fail") },
              { value: NUMERIC, label: t("credit-registration-admin-grading-numeric") },
            ]}
          />
        </div>
        <TextField
          name="enrolment_link"
          control={control}
          type="url"
          label={t("label-enrolment-link")}
          description={t("credit-registration-admin-moocfi-enrolment-link-description")}
        />
        <div className={fieldRowCss}>
          <NumberField
            name="lowest_tier"
            control={control}
            label={t("label-lowest-tier")}
            minValue={0}
            step={1}
            description={t("credit-registration-admin-moocfi-tiers-description")}
          />
          <NumberField
            name="highest_tier"
            control={control}
            label={t("label-highest-tier")}
            minValue={0}
            step={1}
            rules={{
              validate: (value) => {
                const lowest = getValues("lowest_tier")
                return (
                  value === null ||
                  lowest === null ||
                  value >= lowest ||
                  t("credit-registration-admin-moocfi-tiers-reversed")
                )
              },
            }}
          />
        </div>
        <DateTimeLocalField
          name="delegated_at"
          control={control}
          label={t("label-moocfi-cutoff")}
          description={
            hasRegistrations
              ? t("credit-registration-admin-moocfi-cutoff-fixed")
              : t("credit-registration-admin-moocfi-cutoff-description")
          }
          hourCycle={24}
          isDisabled={hasRegistrations}
          isRequired
          rules={required}
        />
        <Checkbox
          name="enabled"
          control={control}
          label={t("credit-registration-admin-moocfi-enabled")}
          description={t("credit-registration-admin-moocfi-enabled-description")}
        />
        <ReasonField control={control} />
      </form>
    </Dialog>
  )
}

export default ExternalCreditTargetDialog
