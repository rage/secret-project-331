"use client"

import { fromDate, parseDateTime, toCalendarDateTime } from "@internationalized/date"
import { useQuery } from "@tanstack/react-query"
import React, { useRef } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { adminGetExternalCreditTargetCodesOptions } from "@/generated/api/@tanstack/react-query.generated"
import {
  adminCreateExternalCreditTarget,
  adminUpdateExternalCreditTarget,
} from "@/generated/api/sdk.generated"
import type {
  AdminExternalCreditTargetPayload,
  ExternalCreditTarget,
  ExternalCreditTargetCode,
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
  QueryResult,
  TextField,
} from "@/shared-module/components"

import { BUTTON_PRIMARY, CREDIT_REGISTRATION_NS, TONE } from "../constants"
import { dialogFormCss } from "../styles"
import type { DialogOpenState } from "./AdminActionDialog"
import { useInvalidateCourseStats } from "./adminCreditRegistrationHooks"
import { AUDIT_ACTION } from "./auditActions"
import ExternalCreditTargetCodeRows, { fieldRowCss } from "./ExternalCreditTargetCodeRows"
import type { CodeFields } from "./externalCreditTargetCodes"
import {
  CircularPrerequisitesError,
  codeFieldsFrom,
  emptyCodeFields,
  saveTargetCodes,
} from "./externalCreditTargetCodes"
import { ReasonField } from "./ReasonConfirmDialog"

/** mooc.fi and its admins keep the cutoff in Helsinki time. */
const CUTOFF_TIME_ZONE = "Europe/Helsinki"
/** `YYYY-MM-DDTHH:mm`, the minute precision the date-time field edits. */
const LOCAL_MINUTE_LENGTH = 16

/** The database's own check on `external_credit_targets.language_code`. */
const LANGUAGE_CODE_PATTERN = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$/

const COURSE_CODE_TAKEN = "external_credit_target_course_code_taken"
const MOOCFI_COURSE_FIXED = "external_credit_target_moocfi_course_fixed"

const toCutoffLocal = (at: Date): string =>
  toCalendarDateTime(fromDate(at, CUTOFF_TIME_ZONE)).toString().slice(0, LOCAL_MINUTE_LENGTH)

const fromCutoffLocal = (value: string): string =>
  parseDateTime(value).toDate(CUTOFF_TIME_ZONE).toISOString()

interface Fields {
  moocfi_course_id: string
  moocfi_course_slug: string
  name: string
  language_code: string
  delegated_at: string
  enabled: boolean
  reason: string
  codes: CodeFields[]
}

const initialFields = (
  target: ExternalCreditTarget | null,
  codes: readonly ExternalCreditTargetCode[],
): Fields => ({
  moocfi_course_id: target?.moocfi_course_id ?? "",
  moocfi_course_slug: target?.moocfi_course_slug ?? "",
  name: target?.name ?? "",
  language_code: target?.language_code ?? "",
  delegated_at: toCutoffLocal(target ? new Date(target.delegated_at) : new Date()),
  enabled: target ? Boolean(target.enabled_at) : false,
  reason: "",
  codes: target ? codes.map((code) => codeFieldsFrom(code)) : [emptyCodeFields()],
})

interface Props extends DialogOpenState {
  /** `null` adds a new target. */
  target: ExternalCreditTarget | null
  /** The cutoff and the mooc.fi course are fixed once the target has registrations. */
  hasRegistrations: boolean
}

interface FormProps extends Props {
  codes: readonly ExternalCreditTargetCode[]
}

const ExternalCreditTargetForm: React.FC<FormProps> = ({
  isOpen,
  onClose,
  target,
  codes,
  hasRegistrations,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const invalidateCourseStats = useInvalidateCourseStats()
  const initial = initialFields(target, codes)
  const form = useForm<Fields>({ defaultValues: initial })
  const {
    control,
    handleSubmit,
    getValues,
    setValue,
    setError,
    formState: { errors },
  } = form
  const createdTargetId = useRef<string | null>(null)
  const removedCodeIds = useRef<string[]>([])

  const mutation = useToastMutation(
    async (fields: Fields) => {
      const body: AdminExternalCreditTargetPayload = {
        moocfi_course_id: fields.moocfi_course_id.trim(),
        moocfi_course_slug: fields.moocfi_course_slug,
        name: fields.name,
        language_code: fields.language_code.trim(),
        // The field edits minutes, so an untouched cutoff is sent back as stored, seconds and all.
        delegated_at:
          target && fields.delegated_at === initial.delegated_at
            ? target.delegated_at
            : fromCutoffLocal(fields.delegated_at),
        enabled: fields.enabled,
        reason: fields.reason,
      }
      let targetId = target?.id ?? createdTargetId.current
      if (targetId) {
        await adminUpdateExternalCreditTarget({
          path: { external_credit_target_id: targetId },
          body,
        })
      } else {
        targetId = await adminCreateExternalCreditTarget({ body })
        createdTargetId.current = targetId
      }
      await saveTargetCodes({
        targetId,
        rows: fields.codes,
        removedIds: removedCodeIds.current,
        reason: fields.reason,
        onCreated: (key, id) => {
          const index = getValues("codes").findIndex((row) => row.key === key)
          setValue(`codes.${index}.savedId`, id)
        },
        onDeleted: (id) => {
          removedCodeIds.current = removedCodeIds.current.filter((other) => other !== id)
        },
      })
    },
    { notify: false },
    {
      onSuccess: onClose,
      onSettled: () => void invalidateCourseStats(),
      onError: (error) => {
        const messageKey = isAppApiError(error) ? error.messageKey : null
        if (messageKey === MOOCFI_COURSE_FIXED) {
          setError("moocfi_course_id", {
            message: t("credit-registration-admin-moocfi-course-id-fixed"),
          })
        } else if (messageKey === COURSE_CODE_TAKEN) {
          setError("root", {
            message: t("credit-registration-admin-moocfi-course-code-taken"),
          })
        } else if (error instanceof CircularPrerequisitesError) {
          setError("root", {
            message: t("credit-registration-admin-prerequisites-circular"),
          })
        } else {
          setError("root", {
            message: isAppApiError(error) ? (error.userMessage ?? error.message) : String(error),
          })
        }
      },
    },
  )

  const submit = handleSubmit((fields) => mutation.mutate(fields))

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
          ? t("credit-registration-admin-moocfi-edit-title", {
              name: target.name,
            })
          : t("button-text-add-moocfi-course")
      }
      actions={actions}
    >
      <FormProvider {...form}>
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
                validate: (value) =>
                  validateUUID(value.trim()) ||
                  t("credit-registration-admin-moocfi-course-id-invalid"),
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
          <ExternalCreditTargetCodeRows
            onRemoveSaved={(id) => {
              removedCodeIds.current = [...removedCodeIds.current, id]
            }}
          />
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
          <ReasonField
            control={control}
            auditAction={AUDIT_ACTION.CONFIGURE_EXTERNAL_CREDIT_TARGET}
          />
        </form>
      </FormProvider>
    </Dialog>
  )
}

const ExistingTargetDialog: React.FC<Props & { target: ExternalCreditTarget }> = (props) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const codesQuery = useQuery(
    adminGetExternalCreditTargetCodesOptions({
      path: { external_credit_target_id: props.target.id },
    }),
  )
  if (codesQuery.data) {
    return <ExternalCreditTargetForm {...props} codes={codesQuery.data} />
  }
  return (
    <Dialog
      open={props.isOpen}
      onClose={props.onClose}
      size="wide"
      title={t("credit-registration-admin-moocfi-edit-title", {
        name: props.target.name,
      })}
    >
      <QueryResult query={codesQuery}>{() => null}</QueryResult>
    </Dialog>
  )
}

/** Adds a mooc.fi course to register credits for, or edits one, with its Sisu courses. Every save is audited. */
const ExternalCreditTargetDialog: React.FC<Props> = (props) =>
  props.target ? (
    <ExistingTargetDialog {...props} target={props.target} />
  ) : (
    <ExternalCreditTargetForm {...props} codes={[]} />
  )

export default ExternalCreditTargetDialog
