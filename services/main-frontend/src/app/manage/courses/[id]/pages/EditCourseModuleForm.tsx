"use client"

import { css } from "@emotion/css"
import { CheckCircle, Pencil, Trash, XmarkCircle } from "@vectopus/atlas-icons-react"
import React, { useEffect, useState } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import SelectField from "@/shared-module/common/components/InputFields/SelectField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { Button, Checkbox, Select, TextField as NewTextField } from "@/shared-module/components"

import type { ModuleView } from "./CourseModules"
import type { CreditRegistrationModuleFields } from "./creditRegistrationModuleFields"
import {
  DERIVED_GRADE_SCALE,
  EMPTY_REALISATION,
  NUMERIC_GRADE_SCALE_ID,
  PASS_FAIL_GRADE_SCALE_ID,
} from "./creditRegistrationModuleFields"

interface Props {
  module: ModuleView
  chapters: number[]
  onSubmitForm: (id: string, fields: EditCourseModuleFormFields) => void
  onDeleteModule: (id: string) => void
}

export interface EditCourseModuleFormFields {
  name: string | null
  starts: number
  ends: number
  ects_credits: number | null
  uh_course_code: string | null
  automatic_completion: boolean
  automatic_completion_number_of_points_treshold: number | null
  automatic_completion_number_of_exercises_attempted_treshold: number | null
  automatic_completion_requires_exam: boolean
  override_completion_link: boolean
  completion_registration_link_override: string
  enable_registering_completion_to_uh_open_university: boolean
  credit_registration: CreditRegistrationModuleFields
}

const creditRegistrationSectionCss = css`
  border-top: 1px solid ${baseTheme.colors.gray[100]};
  padding-top: 1rem;
  margin-bottom: 1rem;
`

const creditRegistrationBodyCss = css`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
`

const realisationsHeadingCss = css`
  font-weight: 500;
  margin-bottom: 0.25rem;
`

const realisationsHintCss = css`
  color: ${baseTheme.colors.gray[500]};
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
`

const realisationRowCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
`

/** `useController` puts the new value in `target.value`, never in `target.checked`. */
const isTurningOn = (event: { target: { value?: unknown } }): boolean => Boolean(event.target.value)

const makeDefaultValues = (module: ModuleView, chapters: number[]): EditCourseModuleFormFields => {
  return {
    name: module.name,
    starts: module.firstChapter ?? (chapters.length > 0 ? (chapters[0] ?? 1) : 1),
    ends: module.lastChapter ?? chapters.at(-1) ?? 1,
    ects_credits: Number(module.ects_credits) || 0,
    uh_course_code: module.uh_course_code ?? "",
    automatic_completion: module.automatic_completion ?? false,
    automatic_completion_number_of_points_treshold:
      module.automatic_completion_number_of_points_treshold
        ? Number(module.automatic_completion_number_of_points_treshold)
        : null,
    automatic_completion_number_of_exercises_attempted_treshold:
      module.automatic_completion_number_of_exercises_attempted_treshold
        ? Number(module.automatic_completion_number_of_exercises_attempted_treshold)
        : null,
    automatic_completion_requires_exam: module.automatic_completion_requires_exam,
    override_completion_link: module.completion_registration_link_override !== null,
    completion_registration_link_override: module.completion_registration_link_override ?? "",
    enable_registering_completion_to_uh_open_university:
      module.enable_registering_completion_to_uh_open_university,
    credit_registration: module.credit_registration,
  }
}

const EditCourseModuleForm: React.FC<Props> = ({
  module,
  chapters,
  onSubmitForm,
  onDeleteModule,
}) => {
  const { t } = useTranslation()
  const [active, setActive] = useState(false)
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
    reset,
    setValue,
    watch,
  } = useForm<EditCourseModuleFormFields>({
    // oxlint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: makeDefaultValues(module, chapters),
  })
  useEffect(() => {
    reset(makeDefaultValues(module, chapters))
  }, [reset, module, chapters])
  const realisations = useFieldArray({
    control,
    // oxlint-disable-next-line i18next/no-literal-string
    name: "credit_registration.realisations",
  })

  const onSubmitFormWrapper = (fields: EditCourseModuleFormFields) => {
    setActive(false)
    onSubmitForm(module.id, {
      ...fields,
      // A disabled Checkbox still submits its value, unlike `register(name, { disabled })`.
      automatic_completion_requires_exam: fields.automatic_completion
        ? fields.automatic_completion_requires_exam
        : false,
    })
  }

  const isChecked = watch("automatic_completion")
  const overrideLink = watch("override_completion_link")
  const creditRegistrationEnabled = watch("credit_registration.enabled")

  return (
    <form
      onSubmit={handleSubmit(onSubmitFormWrapper)}
      className={css`
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        background-color: #f7f8f9;
        color: #1a2333;
        align-items: center;
        justify-content: space-between;
        border: 2px solid #e1e3e5;
        border-top-right-radius: 4px;
        border-top-left-radius: 4px;
      `}
    >
      <div
        className={css`
          text-transform: uppercase;
          font-weight: 600;
          margin: 1rem 1.25rem;
          flex-grow: 1;
          ${respondToOrLarger.sm} {
            max-width: 16rem;
          }
        `}
      >
        {module.name ? (
          active ? (
            <TextField
              label={t("edit-module")}
              labelStyle={css`
                color: ${baseTheme.colors.clear[100]};
              `}
              placeholder={t("name-of-module")}
              {...register("name", { required: true })}
              {...includeIf(errors["name"]?.message, { error: errors["name"]?.message })}
            />
          ) : (
            `${module.order_number}. ${module.name}`
          )
        ) : (
          t("default-module")
        )}
      </div>
      <div
        className={css`
          ${active && `width: 100%;`}
        `}
      >
        {active && (
          <div
            className={css`
              margin-left: 1rem;
              margin-right: 1rem;
              margin-bottom: 1rem;
            `}
          >
            <div
              className={css`
                display: flex;
                flex-wrap: wrap;
                flex-direction: column;
                justify-content: left;
                column-gap: 1rem;
                margin-bottom: 1rem;

                ${respondToOrLarger.md} {
                  align-items: flex-end;
                  flex-direction: row;
                }
              `}
            >
              <div
                className={css`
                  column-gap: 1rem;
                  display: flex;
                  flex: 2;
                `}
              >
                <SelectField
                  className={css`
                    flex: 1;
                    min-width: 5rem;
                    margin-bottom: 0;
                  `}
                  id="editing-module-start"
                  label={t("starts")}
                  labelStyle={css`
                    color: ${baseTheme.colors.gray[500]};
                  `}
                  options={chapters.map((c) => {
                    return { value: c.toString(), label: c.toString() }
                  })}
                  {...register("starts", { required: true, valueAsNumber: true })}
                  {...includeIf(errors["starts"]?.message, { error: errors["starts"]?.message })}
                />
                <SelectField
                  className={css`
                    flex: 1;
                    min-width: 5rem;
                    margin-bottom: 0;
                  `}
                  id="editing-module-ends"
                  label={t("ends")}
                  labelStyle={css`
                    color: ${baseTheme.colors.gray[500]};
                  `}
                  options={chapters.map((cn) => {
                    return { value: cn.toString(), label: cn.toString() }
                  })}
                  {...register("ends", { required: true, valueAsNumber: true })}
                  {...includeIf(errors["ends"]?.message, { error: errors["ends"]?.message })}
                />
              </div>
            </div>

            <Checkbox
              name="automatic_completion"
              control={control}
              label={t("enable-automatic-completion")}
            />
            <div
              className={css`
                align-items: center;
                display: flex;
                column-gap: 1rem;
                margin-bottom: 1rem;
              `}
            >
              <TextField
                className={css`
                  flex: 1;
                  margin-bottom: 0;
                `}
                type="number"
                label={t("automatic-completion-points-treshold")}
                placeholder={t("automatic-completion-points-treshold")}
                {...register("automatic_completion_number_of_points_treshold", {
                  valueAsNumber: true,
                  disabled: !isChecked,
                })}
                {...includeIf(errors["name"]?.message, { error: errors["name"]?.message })}
              />
              <TextField
                className={css`
                  flex: 1;
                  margin-bottom: 0;
                `}
                label={t("automatic-completion-exercise-treshold")}
                placeholder={t("automatic-completion-exercise-treshold")}
                type="number"
                {...register("automatic_completion_number_of_exercises_attempted_treshold", {
                  valueAsNumber: true,
                  disabled: !isChecked,
                })}
                {...includeIf(errors["name"]?.message, { error: errors["name"]?.message })}
              />
              {/* Only for default module */}
              {!module.name && (
                <div
                  className={css`
                    flex: 1;
                  `}
                >
                  <Checkbox
                    name="automatic_completion_requires_exam"
                    control={control}
                    label={t("automatic-completion-requires-exam")}
                    isDisabled={!isChecked}
                    className={css`
                      margin-bottom: 0;
                      position: relative;
                      top: 10px;
                    `}
                  />
                </div>
              )}
            </div>
            <div
              className={css`
                margin-top: 1rem;
                margin-bottom: 1rem;
              `}
            >
              <Checkbox
                name="override_completion_link"
                control={control}
                label={t("override-completion-registration-link")}
              />
              <TextField
                label={t("completion-registration-link")}
                placeholder={t("completion-registration-link")}
                className={css`
                  margin-bottom: 0;
                `}
                {...register("completion_registration_link_override", {
                  disabled: !overrideLink,
                  minLength: 10,
                })}
                {...includeIf(errors["completion_registration_link_override"]?.message, {
                  error: errors["completion_registration_link_override"]?.message,
                })}
              />
            </div>
            <Checkbox
              name="enable_registering_completion_to_uh_open_university"
              control={control}
              label={t("label-enable-registering-completion-to-uh-open-university")}
              rules={{
                onChange: (event) => {
                  // The backend rejects both registration paths at once.
                  if (isTurningOn(event)) {
                    setValue("credit_registration.enabled", false)
                  }
                },
              }}
            />
            <div
              className={css`
                display: flex;
                flex-wrap: wrap;
                flex-direction: column;
                justify-content: left;
                column-gap: 1rem;
                margin-bottom: 1.4rem;
                ${respondToOrLarger.md} {
                  align-items: flex-end;
                  flex-direction: row;
                }
              `}
            >
              <TextField
                className={css`
                  flex: 1;
                  min-width: 8rem;
                  margin-bottom: 0;
                `}
                label={t("uh-course-code")}
                placeholder={t("uh-course-code")}
                {...register("uh_course_code")}
                {...includeIf(errors["name"]?.message, { error: errors["name"]?.message })}
              />
              <TextField
                className={css`
                  flex: 1;
                  min-width: 8rem;
                  margin-bottom: 0;
                `}
                label={t("ects-credits")}
                placeholder={t("ects-credits")}
                type="number"
                // oxlint-disable-next-line i18next/no-literal-string
                step="any"
                {...register("ects_credits", {
                  valueAsNumber: true,
                })}
              />
            </div>
            <div className={creditRegistrationSectionCss}>
              <Checkbox
                name="credit_registration.enabled"
                control={control}
                label={t("label-enable-credit-registration-via-suotar")}
                description={t("description-enable-credit-registration-via-suotar")}
                rules={{
                  onChange: (event) => {
                    if (isTurningOn(event)) {
                      setValue("enable_registering_completion_to_uh_open_university", false)
                    } else {
                      // Otherwise these survive in form state and still go out in the submit payload.
                      setValue("credit_registration.open_university_product_id", "")
                      setValue("credit_registration.grade_scale_id", DERIVED_GRADE_SCALE)
                      realisations.replace([])
                    }
                  },
                }}
              />
              {creditRegistrationEnabled && (
                <div className={creditRegistrationBodyCss}>
                  <NewTextField
                    name="credit_registration.open_university_product_id"
                    control={control}
                    label={t("label-open-university-product-id")}
                    description={t("description-open-university-product-id")}
                  />
                  <Select
                    name="credit_registration.grade_scale_id"
                    control={control}
                    label={t("label-credit-registration-grade-scale")}
                    description={t("description-credit-registration-grade-scale")}
                    options={[
                      {
                        value: DERIVED_GRADE_SCALE,
                        label: t("grade-scale-derive-from-completion"),
                      },
                      { value: PASS_FAIL_GRADE_SCALE_ID, label: t("grade-scale-pass-fail") },
                      { value: NUMERIC_GRADE_SCALE_ID, label: t("grade-scale-numeric") },
                    ]}
                  />
                  <div>
                    <div className={realisationsHeadingCss}>
                      {t("heading-credit-registration-realisations")}
                    </div>
                    <div className={realisationsHintCss}>
                      {t("hint-credit-registration-realisations")}
                    </div>
                    {realisations.fields.map((field, index) => (
                      <div className={realisationRowCss} key={field.id}>
                        <NewTextField
                          name={`credit_registration.realisations.${index}.course_unit_realisation_id`}
                          control={control}
                          label={t("label-course-unit-realisation-id")}
                          rules={{ required: t("required-field") }}
                        />
                        <NewTextField
                          name={`credit_registration.realisations.${index}.label`}
                          control={control}
                          label={t("label-realisation-name-shown-to-students")}
                        />
                        <Checkbox
                          name={`credit_registration.realisations.${index}.active`}
                          control={control}
                          label={t("label-realisation-active")}
                        />
                        <Button
                          variant="secondary"
                          size="small"
                          onPress={() => realisations.remove(index)}
                        >
                          {t("button-text-remove")}
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="secondary"
                      size="small"
                      onPress={() => realisations.append(EMPTY_REALISATION)}
                    >
                      {t("button-text-add-realisation")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        <div
          className={css`
            display: flex;

            button {
              margin-right: 1rem;
            }
          `}
        >
          <div
            className={css`
              flex-grow: 1;
            `}
          />
          {active ? (
            <>
              <Button
                aria-label={t("confirm")}
                className={css`
                  display: flex !important;
                  padding: 0 !important;
                  justify-content: center;
                  align-items: center;
                  height: 2rem;
                  width: 2rem;
                  background: #e1e3e5 !important;
                  border-radius: 100%;
                `}
                disabled={!isValid || isSubmitting}
                type={"submit"}
                variant={"icon"}
                size={"small"}
              >
                <CheckCircle
                  size={20}
                  className={css`
                    color: #1a2333;
                  `}
                />
              </Button>
              <Button
                aria-label={t("button-text-cancel")}
                className={css`
                  display: flex !important;
                  padding: 0 !important;
                  justify-content: center;
                  align-items: center;
                  height: 2rem;
                  width: 2rem;
                  background: #e1e3e5 !important;
                  border-radius: 100%;
                  margin-bottom: 1rem;
                `}
                onClick={() => {
                  setActive(false)
                  reset()
                }}
                disabled={isSubmitting}
                variant={"icon"}
                size={"small"}
              >
                <XmarkCircle size={20} />
              </Button>
            </>
          ) : (
            <Button
              aria-label={t("edit")}
              className={css`
                border-radius: 100%;
                height: 2rem;
                width: 2rem;
                background: #e1e3e5 !important;
              `}
              onClick={() => setActive(true)}
              variant={"icon"}
              size={"small"}
            >
              <Pencil size={14} color={"#313947"} />
            </Button>
          )}
          {module.name !== null && (
            <Button
              aria-label={t("button-text-delete")}
              className={css`
                height: 2rem;
                width: 2rem;
                background: #fbeef0 !important;
                border-radius: 100%;
                display: flex !important;
                padding: 0 !important;
                align-items: center;
                justify-content: center;
              `}
              onClick={() => onDeleteModule(module.id)}
              disabled={isSubmitting}
              variant={"icon"}
              size={"small"}
            >
              <Trash size={16} color={"#D85762"} />
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}

export default EditCourseModuleForm
