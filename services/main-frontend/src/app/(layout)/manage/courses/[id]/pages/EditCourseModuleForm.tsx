"use client"

import { css, cx } from "@emotion/css"
import { CheckCircle, Pencil, Trash, XmarkCircle } from "@vectopus/atlas-icons-react"
import React, { useEffect, useState } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { TONE } from "@/components/credit-registration/constants"
import CreditRegistrationConfigCallout, {
  hasCreditRegistrationConfigProblem,
} from "@/components/credit-registration/CreditRegistrationConfigCallout"
import {
  cardCss,
  noteCss,
  subheadingCss,
  subsectionCss,
} from "@/components/credit-registration/styles"
import type { CourseModuleCreditRegistrationConfig } from "@/generated/api/types.generated"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import {
  Badge,
  Button,
  Checkbox,
  NumberField,
  Radio,
  RadioGroup,
  Select,
  TextField,
} from "@/shared-module/components"

import type { ModuleView } from "./CourseModules"
import type { CreditRegistrationModuleFields } from "./creditRegistrationModuleFields"
import {
  DERIVED_GRADE_SCALE,
  EMPTY_CREDIT_REGISTRATION_FIELDS,
  EMPTY_REALISATION,
  NUMERIC_GRADE_SCALE_ID,
  PASS_FAIL_GRADE_SCALE_ID,
} from "./creditRegistrationModuleFields"

interface Props {
  module: ModuleView
  chapters: number[]
  creditRegistrationConfig: CourseModuleCreditRegistrationConfig | undefined
  /** Only support may turn the study registry path on or off; a teacher still sees which one is in use. */
  canConfigureStudyRegistry: boolean
  onSubmitForm: (id: string, fields: EditCourseModuleFormFields) => void
  onDeleteModule: (id: string) => void
}

/** What the module editor hands back; the two registration flags are exclusive by construction. */
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

/** Where a passed completion of this module is registered. The three are mutually exclusive. */
const REGISTRATION_PATHS = ["none", "open_university", "study_registry"] as const
type RegistrationPath = (typeof REGISTRATION_PATHS)[number]

const [NO_REGISTRATION, OPEN_UNIVERSITY, STUDY_REGISTRY] = REGISTRATION_PATHS

/** Shorter than this is a fragment, not a link a student can follow. */
const MIN_COMPLETION_LINK_LENGTH = 10

interface EditCourseModuleFormState extends Omit<
  EditCourseModuleFormFields,
  "enable_registering_completion_to_uh_open_university" | "starts" | "ends"
> {
  /** Chapter numbers as the select holds them; `onSubmitForm` gets them back as numbers. */
  starts: string
  ends: string
  registration_path: RegistrationPath
}

const formCss = css`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
`

const headerCss = css`
  flex-grow: 1;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  ${respondToOrLarger.sm} {
    max-width: 22rem;
  }
`

const groupCss = css`
  display: grid;
  gap: var(--space-4);
  padding: 0;
  border: 0;
`

const fieldRowCss = css`
  display: grid;
  gap: var(--space-4);
  ${respondToOrLarger.md} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
`

const realisationRowCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: start;
  gap: var(--space-3);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-clear-300);
`

// The icon variant's default grey is too faint for an icon-only control on this header.
const iconButtonCss = css`
  color: var(--color-gray-700);
`

const deleteButtonCss = css`
  color: var(--color-red-600);
`

const actionsCss = css`
  display: flex;
  justify-content: flex-end;
  gap: var(--space-4);
`

const registrationPathOf = (module: ModuleView): RegistrationPath => {
  if (module.credit_registration.enabled) {
    return STUDY_REGISTRY
  }
  return module.enable_registering_completion_to_uh_open_university
    ? OPEN_UNIVERSITY
    : NO_REGISTRATION
}

const makeDefaultValues = (module: ModuleView, chapters: number[]): EditCourseModuleFormState => ({
  name: module.name,
  starts: String(module.firstChapter ?? chapters[0] ?? 1),
  ends: String(module.lastChapter ?? chapters.at(-1) ?? 1),
  ects_credits: Number(module.ects_credits) || 0,
  uh_course_code: module.uh_course_code ?? "",
  automatic_completion: module.automatic_completion ?? false,
  automatic_completion_number_of_points_treshold:
    module.automatic_completion_number_of_points_treshold,
  automatic_completion_number_of_exercises_attempted_treshold:
    module.automatic_completion_number_of_exercises_attempted_treshold,
  automatic_completion_requires_exam: module.automatic_completion_requires_exam,
  override_completion_link: module.completion_registration_link_override !== null,
  completion_registration_link_override: module.completion_registration_link_override ?? "",
  registration_path: registrationPathOf(module),
  credit_registration: module.credit_registration,
})

const EditCourseModuleForm: React.FC<Props> = ({
  module,
  chapters,
  creditRegistrationConfig,
  canConfigureStudyRegistry,
  onSubmitForm,
  onDeleteModule,
}) => {
  const { t } = useTranslation()
  const [active, setActive] = useState(false)
  const {
    control,
    handleSubmit,
    formState: { isValid, isSubmitting },
    reset,
    watch,
  } = useForm<EditCourseModuleFormState>({
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

  const registrationPath = watch("registration_path")
  const automaticCompletion = watch("automatic_completion")
  const overrideLink = watch("override_completion_link")

  const onSubmitFormWrapper = ({
    registration_path,
    starts,
    ends,
    ...fields
  }: EditCourseModuleFormState): void => {
    setActive(false)
    onSubmitForm(module.id, {
      ...fields,
      starts: Number(starts),
      ends: Number(ends),
      // A disabled Checkbox still submits its value, unlike `register(name, { disabled })`.
      automatic_completion_requires_exam: fields.automatic_completion
        ? fields.automatic_completion_requires_exam
        : false,
      enable_registering_completion_to_uh_open_university: registration_path === OPEN_UNIVERSITY,
      // The study registry fields stay in form state once their section is hidden, so a module that
      // has left that path is saved with them blanked rather than with what it used to hold.
      credit_registration:
        registration_path === STUDY_REGISTRY
          ? { ...fields.credit_registration, enabled: true }
          : EMPTY_CREDIT_REGISTRATION_FIELDS,
    })
  }

  const chapterOptions = chapters.map((chapter) => ({
    value: chapter.toString(),
    label: chapter.toString(),
  }))
  const savedPath = registrationPathOf(module)
  const hasConfigProblem = hasCreditRegistrationConfigProblem(creditRegistrationConfig)

  return (
    <form onSubmit={handleSubmit(onSubmitFormWrapper)} className={cx(cardCss, formCss)}>
      <div className={headerCss}>
        {module.name && active ? (
          <TextField
            name="name"
            control={control}
            label={t("edit-module")}
            placeholder={t("name-of-module")}
            rules={{ required: t("required-field") }}
          />
        ) : (
          <span className={subheadingCss}>
            {module.name ? `${module.order_number}. ${module.name}` : t("default-module")}
          </span>
        )}
        {!active && (
          <>
            {savedPath === STUDY_REGISTRY && (
              <Badge tone={TONE.NEUTRAL}>{t("badge-registers-to-study-registry")}</Badge>
            )}
            {savedPath === OPEN_UNIVERSITY && (
              <Badge tone={TONE.NEUTRAL}>{t("badge-registers-to-open-university")}</Badge>
            )}
            {hasConfigProblem && (
              <Badge tone={TONE.WARNING}>{t("badge-credit-registration-config-problem")}</Badge>
            )}
          </>
        )}
      </div>
      <div
        className={css`
          ${active && `width: 100%;`}
          display: grid;
          gap: var(--space-4);
        `}
      >
        {active && (
          <>
            <fieldset className={groupCss}>
              <legend className={subheadingCss}>{t("heading-module-chapters")}</legend>
              <div className={fieldRowCss}>
                <Select
                  name="starts"
                  control={control}
                  id="editing-module-start"
                  label={t("starts")}
                  options={chapterOptions}
                />
                <Select
                  name="ends"
                  control={control}
                  id="editing-module-ends"
                  label={t("ends")}
                  options={chapterOptions}
                />
              </div>
            </fieldset>

            <fieldset className={groupCss}>
              <legend className={subheadingCss}>{t("heading-module-completion")}</legend>
              <Checkbox
                name="automatic_completion"
                control={control}
                label={t("enable-automatic-completion")}
              />
              <div className={fieldRowCss}>
                <NumberField
                  name="automatic_completion_number_of_points_treshold"
                  control={control}
                  label={t("automatic-completion-points-treshold")}
                  isDisabled={!automaticCompletion}
                  minValue={0}
                />
                <NumberField
                  name="automatic_completion_number_of_exercises_attempted_treshold"
                  control={control}
                  label={t("automatic-completion-exercise-treshold")}
                  isDisabled={!automaticCompletion}
                  minValue={0}
                />
              </div>
              {/* Only the default module can require an exam. */}
              {!module.name && (
                <Checkbox
                  name="automatic_completion_requires_exam"
                  control={control}
                  label={t("automatic-completion-requires-exam")}
                  isDisabled={!automaticCompletion}
                />
              )}
            </fieldset>

            <fieldset className={groupCss}>
              <legend className={subheadingCss}>{t("heading-module-credits")}</legend>
              <div className={fieldRowCss}>
                <TextField
                  name="uh_course_code"
                  control={control}
                  label={t("uh-course-code")}
                  placeholder={t("uh-course-code")}
                />
                <NumberField
                  name="ects_credits"
                  control={control}
                  label={t("ects-credits")}
                  minValue={0}
                  step={0.5}
                />
              </div>
            </fieldset>

            <fieldset className={groupCss}>
              <legend className={subheadingCss}>{t("heading-credit-registration")}</legend>
              <CreditRegistrationConfigCallout
                configs={[
                  {
                    moduleName: module.name ?? t("default-module"),
                    config: creditRegistrationConfig,
                  },
                ]}
              />
              <RadioGroup
                name="registration_path"
                control={control}
                label={t("label-module-registration-path")}
                isReadOnly={!canConfigureStudyRegistry && savedPath === STUDY_REGISTRY}
                {...(canConfigureStudyRegistry
                  ? {}
                  : { description: t("description-registration-path-support-only") })}
              >
                <Radio value={NO_REGISTRATION} label={t("registration-path-none")} />
                <Radio
                  value={OPEN_UNIVERSITY}
                  label={t("registration-path-open-university")}
                  description={t("description-registration-path-open-university")}
                />
                <Radio
                  value={STUDY_REGISTRY}
                  label={t("registration-path-study-registry")}
                  description={t("description-enable-credit-registration-via-suotar")}
                  isDisabled={!canConfigureStudyRegistry}
                />
              </RadioGroup>

              {registrationPath === STUDY_REGISTRY && canConfigureStudyRegistry && (
                <>
                  <TextField
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
                  <fieldset className={groupCss}>
                    <legend className={subheadingCss}>
                      {t("heading-credit-registration-realisations")}
                    </legend>
                    <p className={noteCss}>{t("hint-credit-registration-realisations")}</p>
                    {realisations.fields.length === 0 ? (
                      <p className={noteCss}>{t("credit-registration-no-realisations")}</p>
                    ) : (
                      <div className={subsectionCss}>
                        {realisations.fields.map((field, index) => (
                          <div className={realisationRowCss} key={field.id}>
                            <TextField
                              name={`credit_registration.realisations.${index}.course_unit_realisation_id`}
                              control={control}
                              label={t("label-course-unit-realisation-id")}
                              rules={{ required: t("required-field") }}
                            />
                            <TextField
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
                      </div>
                    )}
                    <div>
                      <Button
                        variant="secondary"
                        size="small"
                        onPress={() => realisations.append(EMPTY_REALISATION)}
                      >
                        {t("button-text-add-realisation")}
                      </Button>
                    </div>
                  </fieldset>
                </>
              )}

              <Checkbox
                name="override_completion_link"
                control={control}
                label={t("override-completion-registration-link")}
              />
              <TextField
                name="completion_registration_link_override"
                control={control}
                label={t("completion-registration-link")}
                placeholder={t("completion-registration-link")}
                isDisabled={!overrideLink}
                // The field stays mounted while the override is off, so its rule has to go with it.
                rules={
                  overrideLink
                    ? {
                        minLength: {
                          value: MIN_COMPLETION_LINK_LENGTH,
                          message: t("error-completion-registration-link-too-short"),
                        },
                      }
                    : {}
                }
              />
            </fieldset>
          </>
        )}
        <div className={actionsCss}>
          {active ? (
            <>
              <Button
                aria-label={t("confirm")}
                className={iconButtonCss}
                disabled={!isValid || isSubmitting}
                type="submit"
                variant="icon"
                size="small"
              >
                <CheckCircle size={20} />
              </Button>
              <Button
                aria-label={t("button-text-cancel")}
                className={iconButtonCss}
                onClick={() => {
                  setActive(false)
                  reset()
                }}
                disabled={isSubmitting}
                type="button"
                variant="icon"
                size="small"
              >
                <XmarkCircle size={20} />
              </Button>
            </>
          ) : (
            <Button
              aria-label={t("edit")}
              className={iconButtonCss}
              onClick={() => setActive(true)}
              type="button"
              variant="icon"
              size="small"
            >
              <Pencil size={14} />
            </Button>
          )}
          {module.name !== null && (
            <Button
              aria-label={t("button-text-delete")}
              className={cx(iconButtonCss, deleteButtonCss)}
              onClick={() => onDeleteModule(module.id)}
              disabled={isSubmitting}
              type="button"
              variant="icon"
              size="small"
            >
              <Trash size={16} />
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}

export default EditCourseModuleForm
