"use client"

import { css, cx } from "@emotion/css"
import { Trash } from "@vectopus/atlas-icons-react"
import type { TFunction } from "i18next"
import React, { useEffect, useState } from "react"
import type { Path } from "react-hook-form"
import { useFieldArray, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { ABSENT, MIDDLE_DOT, TONE } from "@/components/credit-registration/constants"
import CreditRegistrationConfigCallout, {
  hasCreditRegistrationConfigProblem,
} from "@/components/credit-registration/CreditRegistrationConfigCallout"
import { labelFrom, translateKey } from "@/components/credit-registration/labelFrom"
import {
  cardCss,
  dividedListCss,
  headingCss,
  monospaceCss,
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
  DescriptionList,
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

/** A card that is filling in a module that does not exist yet, or editing one that does. */
export type CourseModuleFormMode = "create" | "edit"

interface Props {
  mode: CourseModuleFormMode
  /** In create mode a blank module carrying the id the new module will be saved under. */
  module: ModuleView
  chapters: number[]
  creditRegistrationConfig: CourseModuleCreditRegistrationConfig | undefined
  /** Only support may turn the study registry path on or off; a teacher still sees which one is in use. */
  canConfigureStudyRegistry: boolean
  /** Whether the module carries edits that the page-level save has not sent yet. */
  hasUnsavedChanges?: boolean
  onSubmitForm: (id: string, fields: CourseModuleFormFields) => void
  onDeleteModule?: (id: string) => void
  /** Closes a create card, and leaves edit mode without saving. */
  onCancel?: () => void
  /** Shown inside the collapsed card, under the summary: the module's chapters and its registrations. */
  children?: React.ReactNode
}

/** What the module editor hands back; the two registration flags are exclusive by construction. */
export interface CourseModuleFormFields {
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

/** Sisu rejects a registration missing either of these. */
const SISU_REQUIRED_FIELDS: Path<CourseModuleFormState>[] = ["uh_course_code", "ects_credits"]

const VALIDATE_ON_COMMIT = "validate" as const

/** Realisation ids are validated as they are typed, so a bad one is caught before the save. */
const VALIDATE_ON_CHANGE = "onChange" as const
const REALISATIONS_FIELD = "credit_registration.realisations" as const

interface CourseModuleFormState extends Omit<
  CourseModuleFormFields,
  "enable_registering_completion_to_uh_open_university" | "starts" | "ends"
> {
  /** Chapter numbers as the select holds them; `onSubmitForm` gets them back as numbers. */
  starts: string
  ends: string
  registration_path: RegistrationPath
}

const formCss = css`
  display: grid;
  gap: var(--space-4);
`

const headerCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
`

const headerTitleCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
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

const deleteButtonCss = css`
  color: var(--color-red-600);
`

const supportReferenceCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
`

const actionsCss = css`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-3);
  /* Stays right-aligned on its own line when the title above wraps and pushes it off headerCss's row. */
  margin-left: auto;
`

const registrationPathOf = (module: ModuleView): RegistrationPath => {
  if (module.credit_registration.enabled) {
    return STUDY_REGISTRY
  }
  return module.enable_registering_completion_to_uh_open_university
    ? OPEN_UNIVERSITY
    : NO_REGISTRATION
}

const makeDefaultValues = (module: ModuleView, chapters: number[]): CourseModuleFormState => ({
  name: module.name,
  starts: String(module.firstChapter ?? chapters[0] ?? 1),
  ends: String(module.lastChapter ?? chapters.at(-1) ?? 1),
  ects_credits: module.ects_credits,
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

const GRADE_SCALE_IDS = [DERIVED_GRADE_SCALE, PASS_FAIL_GRADE_SCALE_ID, NUMERIC_GRADE_SCALE_ID]

const GRADE_SCALE_LABEL_KEYS = {
  [DERIVED_GRADE_SCALE]: "grade-scale-derive-from-completion",
  [PASS_FAIL_GRADE_SCALE_ID]: "grade-scale-pass-fail",
  [NUMERIC_GRADE_SCALE_ID]: "grade-scale-numeric",
} as const

const gradeScaleLabel = (t: TFunction, gradeScaleId: string): string =>
  labelFrom(t, GRADE_SCALE_LABEL_KEYS, gradeScaleId, GRADE_SCALE_LABEL_KEYS[DERIVED_GRADE_SCALE])

/** The grade scale as a fact about the module rather than as the select's option label. */
const GRADE_SCALE_SUMMARY_KEYS = {
  [DERIVED_GRADE_SCALE]: "module-summary-grade-same-as-course",
  [PASS_FAIL_GRADE_SCALE_ID]: "module-summary-grade-pass-fail",
  [NUMERIC_GRADE_SCALE_ID]: "module-summary-grade-numeric",
} as const

const REGISTRATION_PATH_BADGE_KEYS = {
  [NO_REGISTRATION]: "badge-no-completion-registration",
  [OPEN_UNIVERSITY]: "badge-registers-to-open-university",
  [STUDY_REGISTRY]: "badge-registers-to-study-registry",
} as const satisfies Record<RegistrationPath, string>

/** What the collapsed card says about a module, so "is this set up right?" needs no editor. */
const CollapsedSummary: React.FC<{ module: ModuleView }> = ({ module }) => {
  const { t } = useTranslation()
  const path = registrationPathOf(module)
  const parts: string[] = []
  if (module.uh_course_code) {
    parts.push(module.uh_course_code)
  }
  if (module.ects_credits !== null) {
    parts.push(t("module-summary-credits", { count: module.ects_credits }))
  }
  if (path === STUDY_REGISTRY) {
    parts.push(
      labelFrom(
        t,
        GRADE_SCALE_SUMMARY_KEYS,
        module.credit_registration.grade_scale_id,
        GRADE_SCALE_SUMMARY_KEYS[DERIVED_GRADE_SCALE],
      ),
      t("module-summary-sisu-course-instances", {
        count: module.credit_registration.realisations.length,
      }),
    )
  }
  if (parts.length === 0) {
    return null
  }
  return <p className={noteCss}>{parts.join(MIDDLE_DOT)}</p>
}

/** The saved Sisu configuration as a teacher reads it: quotable, not editable. */
const StudyRegistryReadOnly: React.FC<{ fields: CreditRegistrationModuleFields }> = ({
  fields,
}) => {
  const { t } = useTranslation()
  return (
    <div className={subsectionCss}>
      <DescriptionList
        items={[
          {
            label: t("label-credit-registration-grade-scale"),
            value: gradeScaleLabel(t, fields.grade_scale_id),
          },
          {
            label: t("label-credit-registration-support-reference-product"),
            value: (
              <span className={monospaceCss}>{fields.open_university_product_id || ABSENT}</span>
            ),
          },
        ]}
      />
      <h2 className={subheadingCss}>{t("heading-credit-registration-sisu-course-instances")}</h2>
      {fields.realisations.length === 0 ? (
        <p className={noteCss}>{t("credit-registration-no-sisu-course-instances")}</p>
      ) : (
        <ul className={dividedListCss}>
          {fields.realisations.map((realisation) => (
            <li key={realisation.course_unit_realisation_id}>
              <div>
                {realisation.label || t("credit-registration-sisu-course-instance-unnamed")}
                {!realisation.active &&
                  `${MIDDLE_DOT}${t("credit-registration-realisation-inactive")}`}
              </div>
              <div className={cx(noteCss, supportReferenceCss)}>
                <span>{t("label-credit-registration-support-reference-course-instance")}</span>
                <span className={monospaceCss}>{realisation.course_unit_realisation_id}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * One module's settings, whether it exists yet or not.
 *
 * The same card creates and edits, so a module can be given its study registry path at birth
 * instead of being created and then handed to support to configure.
 */
const CourseModuleForm: React.FC<Props> = ({
  mode,
  module,
  chapters,
  creditRegistrationConfig,
  canConfigureStudyRegistry,
  hasUnsavedChanges = false,
  onSubmitForm,
  onDeleteModule,
  onCancel,
  children,
}) => {
  const { t } = useTranslation()
  const isCreate = mode === "create"
  const [editing, setEditing] = useState(isCreate)
  const {
    control,
    handleSubmit,
    formState: { isValid, isSubmitting },
    reset,
    trigger,
    watch,
  } = useForm<CourseModuleFormState>({
    mode: VALIDATE_ON_CHANGE,
    defaultValues: makeDefaultValues(module, chapters),
  })
  useEffect(() => {
    reset(makeDefaultValues(module, chapters))
  }, [reset, module, chapters])
  const realisations = useFieldArray({
    control,
    name: REALISATIONS_FIELD,
  })

  const registrationPath = watch("registration_path")
  const automaticCompletion = watch("automatic_completion")
  const overrideLink = watch("override_completion_link")
  const registersToStudyRegistry = registrationPath === STUDY_REGISTRY
  // Without this, picking the Sisu path shows up only as a disabled Done button.
  useEffect(() => {
    if (registersToStudyRegistry) {
      trigger(SISU_REQUIRED_FIELDS)
    }
  }, [registersToStudyRegistry, trigger])

  const onSubmitFormWrapper = ({
    registration_path,
    starts,
    ends,
    ...fields
  }: CourseModuleFormState): void => {
    setEditing(isCreate)
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
    onCancel?.()
  }

  const chapterOptions = chapters.map((chapter) => ({
    value: chapter.toString(),
    label: chapter.toString(),
  }))
  const savedPath = registrationPathOf(module)
  const hasConfigProblem = hasCreditRegistrationConfigProblem(creditRegistrationConfig)
  const courseCodeFoundInSisu =
    module.uh_course_code !== null &&
    creditRegistrationConfig?.credit_registration_course_code_resolves === true
  const nameIsEditable = isCreate || module.name !== null

  const configCallout = (
    <CreditRegistrationConfigCallout
      configs={[
        { moduleName: module.name ?? t("default-module"), config: creditRegistrationConfig },
      ]}
    />
  )

  return (
    <form onSubmit={handleSubmit(onSubmitFormWrapper)} className={cx(cardCss, formCss)}>
      <div className={headerCss}>
        <div className={headerTitleCss}>
          {editing && nameIsEditable ? (
            <TextField
              name="name"
              control={control}
              label={isCreate ? t("name-of-module") : t("edit-module")}
              placeholder={t("name-of-module")}
              rules={{ required: t("required-field") }}
            />
          ) : (
            <span className={headingCss}>
              {module.name ? `${module.order_number}. ${module.name}` : t("default-module")}
            </span>
          )}
          {hasUnsavedChanges && <Badge tone={TONE.WARNING}>{t("badge-unsaved-changes")}</Badge>}
          {!editing && (
            <>
              {savedPath !== NO_REGISTRATION && (
                <Badge tone={savedPath === STUDY_REGISTRY ? TONE.INFO : TONE.NEUTRAL}>
                  {translateKey(t, REGISTRATION_PATH_BADGE_KEYS[savedPath])}
                </Badge>
              )}
              {hasConfigProblem && (
                <Badge tone={TONE.WARNING}>{t("badge-credit-registration-config-problem")}</Badge>
              )}
            </>
          )}
        </div>
        {!editing && (
          <div className={actionsCss}>
            <Button variant="secondary" size="small" type="button" onClick={() => setEditing(true)}>
              {t("edit")}
            </Button>
            {onDeleteModule && module.name !== null && (
              <Button
                aria-label={t("button-text-delete")}
                className={deleteButtonCss}
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
        )}
      </div>

      {!editing && (
        <>
          <CollapsedSummary module={module} />
          {/* A course whose credits are failing has to say so without the editor being opened. */}
          {configCallout}
          {children}
        </>
      )}

      {editing && (
        <>
          <fieldset className={groupCss}>
            <legend className={subheadingCss}>{t("heading-module-chapters")}</legend>
            <div className={fieldRowCss}>
              <Select
                name="starts"
                control={control}
                id={isCreate ? "new-module-start" : "editing-module-start"}
                label={t("starts")}
                options={chapterOptions}
              />
              <Select
                name="ends"
                control={control}
                id={isCreate ? "new-module-ends" : "editing-module-ends"}
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
            {!isCreate && !module.name && (
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
                isRequired={registersToStudyRegistry}
                rules={
                  registersToStudyRegistry
                    ? { required: t("error-course-code-required-for-sisu") }
                    : {}
                }
              />
              <NumberField
                name="ects_credits"
                control={control}
                label={t("ects-credits")}
                minValue={0}
                step={0.5}
                // The step only sizes the stepper buttons: snapping to it rewrites a module
                // already stored on, say, 1.3 credits the moment the editor opens.
                commitBehavior={VALIDATE_ON_COMMIT}
                isRequired={registersToStudyRegistry}
                rules={{
                  validate: (value) => {
                    if (value !== null && value !== undefined && value < 0) {
                      return t("ects-credits-must-be-non-negative")
                    }
                    // Zero credits is as unregisterable as none.
                    const missing = value === null || value === undefined || value === 0
                    return missing && registersToStudyRegistry
                      ? t("error-credits-required-for-sisu")
                      : true
                  },
                }}
              />
            </div>
            {/* The check is about these two fields, so its outcome sits with them. */}
            {configCallout}
            {courseCodeFoundInSisu && (
              <p className={noteCss}>
                {t("credit-registration-config-course-code-found", {
                  courseCode: module.uh_course_code,
                })}
              </p>
            )}
          </fieldset>

          <fieldset className={groupCss}>
            <legend className={subheadingCss}>{t("heading-credit-registration")}</legend>
            <RadioGroup
              name="registration_path"
              control={control}
              label={t("label-module-registration-path")}
              isReadOnly={!canConfigureStudyRegistry && savedPath === STUDY_REGISTRY}
              description={
                canConfigureStudyRegistry
                  ? undefined
                  : t("description-registration-path-support-only")
              }
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

            {registrationPath === STUDY_REGISTRY &&
              (canConfigureStudyRegistry ? (
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
                    options={GRADE_SCALE_IDS.map((value) => ({
                      value,
                      label: gradeScaleLabel(t, value),
                    }))}
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
              ) : (
                <StudyRegistryReadOnly fields={module.credit_registration} />
              ))}

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

          <div className={actionsCss}>
            <Button
              variant="secondary"
              size="medium"
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                reset()
                setEditing(false)
                onCancel?.()
              }}
            >
              {t("button-text-cancel")}
            </Button>
            <Button
              variant="primary"
              size="medium"
              disabled={!isValid || isSubmitting}
              type="submit"
            >
              {isCreate ? t("create-module") : t("button-text-done")}
            </Button>
          </div>
        </>
      )}
    </form>
  )
}

export default CourseModuleForm
