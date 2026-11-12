"use client"

import { css, cx } from "@emotion/css"
import { Trash } from "@vectopus/atlas-icons-react"
import React, { useEffect, useMemo, useState } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { CREDIT_REGISTRATION_NS, TONE } from "@/components/credit-registration/constants"
import CreditRegistrationConfigCallout, {
  hasCreditRegistrationConfigProblem,
} from "@/components/credit-registration/CreditRegistrationConfigCallout"
import InlineParts from "@/components/credit-registration/InlineParts"
import { registersCredits } from "@/components/credit-registration/registersCredits"
import {
  cardCss,
  headingCss,
  noteCss,
  subheadingCss,
} from "@/components/credit-registration/styles"
import type { CourseModuleCreditRegistrationConfig } from "@/generated/api/types.generated"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { Badge, Button, Select, TextField } from "@/shared-module/components"

import type { ModuleView } from "./CourseModules"
import type { ModuleCompletionLinks, ModuleTotals } from "./ModuleCompletionFields"
import ModuleCompletionFields from "./ModuleCompletionFields"
import type { CourseModuleFormFields, CourseModuleFormState } from "./moduleCompletionForm"
import { formFieldsOf, formStateOf } from "./moduleCompletionForm"
import type { LinkedExam } from "./moduleCompletionSettings"

/** A card that is filling in a module that does not exist yet, or editing one that does. */
export type CourseModuleFormMode = "create" | "edit"

/** One exercise as it counts towards a module's totals. */
export interface ExerciseInChapter {
  chapterNumber: number
  scoreMaximum: number
}

interface Props {
  mode: CourseModuleFormMode
  /** In create mode a blank module carrying the id the new module will be saved under. */
  module: ModuleView
  chapters: number[]
  creditRegistrationConfig: CourseModuleCreditRegistrationConfig | undefined
  linkedExams: LinkedExam[]
  /** The course's exercises, for the module totals; `null` while loading. */
  exercises: ExerciseInChapter[] | null
  links: ModuleCompletionLinks
  /** See `ModuleCompletionFields`. */
  canToggleCertificates: boolean
  /** Whether the module carries edits that the page-level save has not sent yet. */
  hasUnsavedChanges?: boolean
  onSubmitForm: (id: string, fields: CourseModuleFormFields) => void
  onDeleteModule?: (id: string) => void
  /** Closes a create card, and leaves edit mode without saving. */
  onCancel?: () => void
  /** Shown inside the collapsed card, under the summary: the module's chapters and its registrations. */
  children?: React.ReactNode
}

/** Flags what is missing as the teacher edits, rather than only on save. */
const VALIDATE_ON_CHANGE = "onChange" as const

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

const deleteButtonCss = css`
  color: var(--color-red-600);
`

const actionsCss = css`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-3);
  /* Stays right-aligned on its own line when the title above wraps and pushes it off headerCss's row. */
  margin-left: auto;
`

const makeDefaultValues = (module: ModuleView, chapters: number[]): CourseModuleFormState =>
  formStateOf(
    module,
    module.firstChapter ?? chapters[0] ?? 1,
    module.lastChapter ?? chapters.at(-1) ?? 1,
  )

const totalsOf = (
  exercises: ExerciseInChapter[],
  firstChapter: number,
  lastChapter: number,
): ModuleTotals =>
  exercises
    .filter((e) => firstChapter <= e.chapterNumber && e.chapterNumber <= lastChapter)
    .reduce(
      (totals, e) => ({
        exercises: totals.exercises + 1,
        points: totals.points + e.scoreMaximum,
      }),
      { exercises: 0, points: 0 },
    )

/** What the collapsed card says about a module, so "is this set up right?" needs no editor. */
const CollapsedSummary: React.FC<{ module: ModuleView }> = ({ module }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const parts: string[] = []
  switch (module.completion_method) {
    case "not_decided":
      parts.push(t("pass-method-not-decided"))
      break
    case "by_requirements":
      parts.push(t("pass-method-by-requirements"))
      break
    case "by_exam":
      parts.push(t("pass-method-by-exam"))
      break
    case "teacher_adds":
      parts.push(t("pass-method-teacher-adds"))
      break
  }
  if (module.uh_course_code) {
    parts.push(module.uh_course_code)
  }
  if (module.ects_credits !== null) {
    parts.push(t("module-summary-credits", { count: module.ects_credits }))
  }
  if (module.credit_registration_route === "certificate_only") {
    parts.push(t("route-certificate-only"))
  } else if (module.credit_registration_route === "external") {
    parts.push(t("module-summary-registered-outside"))
  } else if (!module.completion_registration_link_override?.trim()) {
    parts.push(t("module-summary-no-registration-link"))
  }
  return (
    <p className={noteCss}>
      <InlineParts parts={parts} />
    </p>
  )
}

/**
 * One module's settings, whether it exists yet or not.
 *
 * The same card creates and edits, so a module can be given its completion settings at birth.
 */
const CourseModuleForm: React.FC<Props> = ({
  mode,
  module,
  chapters,
  creditRegistrationConfig,
  linkedExams,
  exercises,
  links,
  canToggleCertificates,
  hasUnsavedChanges = false,
  onSubmitForm,
  onDeleteModule,
  onCancel,
  children,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const isCreate = mode === "create"
  const [editing, setEditing] = useState(isCreate)
  const form = useForm<CourseModuleFormState>({
    mode: VALIDATE_ON_CHANGE,
    defaultValues: makeDefaultValues(module, chapters),
  })
  const {
    control,
    handleSubmit,
    formState: { isValid, isSubmitting },
    reset,
    watch,
  } = form
  useEffect(() => {
    reset(makeDefaultValues(module, chapters))
  }, [reset, module, chapters])

  const starts = Number(watch("starts"))
  const ends = Number(watch("ends"))
  const moduleTotals = useMemo(
    () => (exercises === null ? null : totalsOf(exercises, starts, ends)),
    [exercises, starts, ends],
  )
  const passMethod = watch("pass_method")
  const examLocation = watch("exam_location")
  const hasNoRequirement =
    passMethod === "automatic" &&
    !(watch("exam_required") === "yes" && examLocation === "platform") &&
    !watch("requires_points") &&
    !watch("requires_exercises")

  const onSubmitFormWrapper = (state: CourseModuleFormState): void => {
    setEditing(isCreate)
    onSubmitForm(module.id, formFieldsOf(state))
    onCancel?.()
  }

  const chapterOptions = chapters.map((chapter) => ({
    value: chapter.toString(),
    label: chapter.toString(),
  }))
  const hasConfigProblem = hasCreditRegistrationConfigProblem(creditRegistrationConfig)
  const courseCodeFoundInSisu =
    registersCredits(module) &&
    creditRegistrationConfig?.credit_registration_course_code_allowed === true
  const nameIsEditable = isCreate || module.name !== null

  const configCallout = (
    <CreditRegistrationConfigCallout
      configs={[
        { moduleName: module.name ?? t("default-module"), config: creditRegistrationConfig },
      ]}
    />
  )

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(onSubmitFormWrapper)} className={cx(cardCss, formCss)}>
        <div className={headerCss}>
          <div className={headerTitleCss}>
            {editing && nameIsEditable ? (
              <TextField
                name="name"
                control={control}
                label={isCreate ? t("name-of-module") : t("edit-module")}
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
                {registersCredits(module) && (
                  <Badge tone={TONE.INFO}>{t("badge-registers-to-study-registry")}</Badge>
                )}
                {hasConfigProblem && (
                  <Badge tone={TONE.WARNING}>{t("badge-credit-registration-config-problem")}</Badge>
                )}
              </>
            )}
          </div>
          {!editing && (
            <div className={actionsCss}>
              <Button
                variant="secondary"
                size="small"
                type="button"
                onClick={() => setEditing(true)}
              >
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

            <div>
              <ModuleCompletionFields
                linkedExams={linkedExams}
                moduleTotals={moduleTotals}
                links={links}
                canToggleCertificates={canToggleCertificates}
              />
              {configCallout}
              {courseCodeFoundInSisu && (
                <p className={noteCss}>
                  {t("credit-registration-config-course-code-found", {
                    courseCode: module.uh_course_code,
                  })}
                </p>
              )}
            </div>

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
                disabled={!isValid || hasNoRequirement || isSubmitting}
                type="submit"
              >
                {isCreate ? t("create-module") : t("button-text-done")}
              </Button>
            </div>
          </>
        )}
      </form>
    </FormProvider>
  )
}

export default CourseModuleForm
