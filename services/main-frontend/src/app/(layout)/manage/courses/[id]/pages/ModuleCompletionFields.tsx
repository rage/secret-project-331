"use client"

import { css } from "@emotion/css"
import React, { useEffect, useRef, useState } from "react"
import { useDateFormatter, VisuallyHidden } from "react-aria"
import type { Path } from "react-hook-form"
import { useFormContext } from "react-hook-form"
import { Trans, useTranslation } from "react-i18next"

import { DAY_AND_MONTH_FORMAT, formatDateWindow } from "@/components/credit-registration/constants"
import type { LinkedExam } from "@/generated/api/types.generated"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { manageExamRoute } from "@/shared-module/common/utils/routes"
import {
  Badge,
  Button,
  Checkbox,
  FormSection,
  formSectionTitleCss,
  Infobox,
  Link,
  NumberField,
  PercentageCalculatorDialog,
  questionLegendCss,
  Radio,
  RadioGroup,
  radioListRevealCss,
  Reveal,
  TextField,
  TONE,
  TransLink,
} from "@/shared-module/components"
import { isOutsidePlatform } from "@/utils/examRequirement"
import { httpsUrlOrNull } from "@/utils/httpsUrl"

import type { CourseModuleFormState } from "./moduleCompletionForm"
import { examRequirementOf } from "./moduleCompletionForm"

/** The number of exercises and the maximum points in the chapters the module spans. */
export interface ModuleTotals {
  exercises: number
  points: number
}

/** Pages the module editor sends the teacher to. */
export interface ModuleCompletionLinks {
  /** Where the teacher uploads completions. */
  studentsTab: string
  /** Where exams are made and linked to courses; `null` while unknown. */
  examsPage: string | null
  certificatesPage: string
}

interface Props {
  linkedExams: LinkedExam[]
  /** See `lacksRequirement`. */
  hasNoRequirement: boolean
  /** `null` while loading. */
  moduleTotals: ModuleTotals | null
  links: ModuleCompletionLinks
  /**
   * Whether the module has had certificates switched on: enabling them takes a certificate
   * configuration, which only the Certificates page sets up.
   */
  canToggleCertificates: boolean
}

type SwitchReason = "outside-exam" | "no-pass-mark" | "by-exam"

type Requirement = "points" | "exercises"

const DEFAULT_PERCENTAGE = 70
/** `VisuallyHidden` defaults to a `<div>`, which may not sit inside a `<p>` or `<label>`. */
const HIDDEN_TEXT_ELEMENT = "span"

const AUTOMATIC = "automatic" as const
const TEACHER_ADDS = "teacher_adds" as const
const POINTS: Requirement = "points"
const EXERCISES: Requirement = "exercises"
const SWITCHED_FOR_OUTSIDE_EXAM: SwitchReason = "outside-exam"
const SWITCHED_FOR_NO_PASS_MARK: SwitchReason = "no-pass-mark"
const SWITCHED_FOR_BY_EXAM: SwitchReason = "by-exam"
const NESTED_INDENT = "indent" as const
/** The step only sizes the stepper buttons: snapping would rewrite a stored 1.3 credits on open. */
const KEEP_AS_TYPED = "validate" as const
const URL_PLACEHOLDER = "https://"
const URL_INPUT_MODE = "url" as const

/** Fields whose rules read other fields, so they re-check when those change. */
const CROSS_CHECKED_FIELDS: Path<CourseModuleFormState>[] = [
  "exam_location",
  "exam_location_description",
  "number_of_points_treshold",
  "number_of_exercises_attempted_treshold",
  "completion_registration_link_override",
]

const nestedCss = css`
  display: grid;
  gap: var(--space-4);
`

const noteCss = css`
  max-width: 72ch;
  margin: 0;
  color: var(--color-gray-500);
  font-size: var(--font-size-1);

  strong {
    color: var(--color-gray-700);
    font-weight: 600;
  }
`

const sectionBodyCss = css`
  display: grid;
  gap: var(--space-4-5);
`

const examListCss = css`
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    padding: var(--space-3) 0;
    border-top: 1px solid var(--color-gray-100);
  }

  li:last-child {
    border-bottom: 1px solid var(--color-gray-100);
  }
`

const emptyExamListCss = css`
  margin: 0;
  color: var(--color-gray-500);
`

const examLinksCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  align-items: baseline;
  margin: 0;
  font-size: var(--font-size-1);
`

const examLinksHintCss = css`
  color: var(--color-gray-500);
`

const requirementRowCss = css`
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3-5) 0;
  border-top: 1px solid var(--color-gray-100);
`

const requirementValueCss = css`
  margin-inline-start: var(--space-5);
`

const linkButtonCss = css`
  font-size: var(--font-size-1);
`

const certificateRowCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  align-items: center;
`

/** Two fields side by side from `md` up. */
export const fieldRowCss = css`
  display: grid;
  gap: var(--space-4);
  ${respondToOrLarger.md} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
`

const fieldGroupCss = css`
  display: grid;
  gap: var(--space-4);
`

const LinkButton: React.FC<{ onPress: () => void; children: React.ReactNode }> = ({
  onPress,
  children,
}) => (
  <Button variant="link" className={linkButtonCss} onPress={onPress}>
    {children}
  </Button>
)

/** Each requirement's form fields, its strings, and the module total it is a share of. */
const REQUIREMENT_FIELDS = {
  points: {
    enabled: "requires_points",
    value: "number_of_points_treshold",
    label: "requirement-points-at-least",
    unit: "unit-points",
    count: "count-points",
    unitPlural: "unit-plural-points",
    calculatorTitle: "calculator-title-points",
    totalOf: (totals: ModuleTotals) => totals.points,
  },
  exercises: {
    enabled: "requires_exercises",
    value: "number_of_exercises_attempted_treshold",
    label: "requirement-exercises-attempted-at-least",
    unit: "unit-exercises",
    count: "count-exercises",
    unitPlural: "unit-plural-exercises",
    calculatorTitle: "calculator-title-exercises",
    totalOf: (totals: ModuleTotals) => totals.exercises,
  },
} as const satisfies Record<
  Requirement,
  {
    enabled: Path<CourseModuleFormState>
    value: Path<CourseModuleFormState>
    label: string
    unit: string
    count: string
    unitPlural: string
    calculatorTitle: string
    totalOf: (totals: ModuleTotals) => number
  }
>

const SWITCH_EXPLANATION_KEYS = {
  "outside-exam": "pass-method-switched-outside-exam",
  "no-pass-mark": "pass-method-switched-no-pass-mark",
  "by-exam": "pass-method-switched-by-exam",
} as const satisfies Record<SwitchReason, string>

/**
 * The exam, pass method and credit questions of the module editor. Options that don't fit the
 * exam are hidden, and the pass method follows the exam by itself, saying so when it changes.
 */
const ModuleCompletionFields: React.FC<Props> = ({
  linkedExams,
  hasNoRequirement,
  moduleTotals,
  links,
  canToggleCertificates,
}) => {
  const { t } = useTranslation()
  const { control, watch, setValue, getValues, trigger } = useFormContext<CourseModuleFormState>()
  const dateFormatter = useDateFormatter(DAY_AND_MONTH_FORMAT)

  const examRequired = watch("exam_required")
  const examLocation = watch("exam_location")
  const passMethod = watch("pass_method")
  const route = watch("credit_registration_route")
  const requiresPoints = watch("requires_points")
  const requiresExercises = watch("requires_exercises")
  const certificationEnabled = watch("certification_enabled")

  const exam = examRequirementOf({ exam_required: examRequired, exam_location: examLocation })
  const isOutside = isOutsidePlatform(exam)
  const isOnPlatform = exam === "platform"
  const isExaminarium = exam === "examinarium"
  const noLinkedExamHasPassMark =
    isOnPlatform && linkedExams.length > 0 && linkedExams.every((e) => e.pass_mark === null)
  const passesByExam = isOnPlatform && !noLinkedExamHasPassMark

  const [switchReason, setSwitchReason] = useState<SwitchReason | null>(null)
  /** The pass method this editor last chose by itself; a different value means the teacher chose. */
  const autoChosenMethod = useRef<CourseModuleFormState["pass_method"] | null>(null)
  /** Set while "Teacher adds completions" is in force only because the exam is outside. */
  const switchedForOutsideExam = useRef(false)

  /** The exam last handled below: only the teacher changing it moves other answers, never loading. */
  const handledExam = useRef(exam)

  useEffect(() => {
    if (exam === handledExam.current) {
      return
    }
    handledExam.current = exam
    // Moves the route off an option the new exam hides.
    const currentRoute = getValues("credit_registration_route")
    if (
      (!isOutside && currentRoute === "external") ||
      (isOutside && currentRoute === "certificate_only")
    ) {
      setValue("credit_registration_route", "platform", { shouldDirty: true })
    }
    const choose = (method: CourseModuleFormState["pass_method"], reason: SwitchReason | null) => {
      autoChosenMethod.current = method
      setValue("pass_method", method, { shouldDirty: true, shouldValidate: true })
      setSwitchReason(reason)
    }
    const method = getValues("pass_method")
    if (isOutside) {
      if (method === "automatic") {
        switchedForOutsideExam.current = true
        choose(TEACHER_ADDS, SWITCHED_FOR_OUTSIDE_EXAM)
      }
      return
    }
    if (switchedForOutsideExam.current && method === "teacher_adds" && !passesByExam) {
      switchedForOutsideExam.current = false
      choose(AUTOMATIC, null)
      return
    }
    if (noLinkedExamHasPassMark && method === "automatic") {
      choose(TEACHER_ADDS, SWITCHED_FOR_NO_PASS_MARK)
    } else if (passesByExam && method === "teacher_adds") {
      choose(AUTOMATIC, SWITCHED_FOR_BY_EXAM)
    }
  }, [exam, isOutside, noLinkedExamHasPassMark, passesByExam, getValues, setValue])

  useEffect(() => {
    if (autoChosenMethod.current !== null && passMethod !== autoChosenMethod.current) {
      autoChosenMethod.current = null
      switchedForOutsideExam.current = false
      setSwitchReason(null)
    }
  }, [passMethod])

  const [isExternalRouteRevealed, setIsExternalRouteRevealed] = useState(route === "external")

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    trigger(CROSS_CHECKED_FIELDS)
  }, [examRequired, route, requiresPoints, requiresExercises, trigger])

  const [calculatorFor, setCalculatorFor] = useState<Requirement | null>(null)

  const studentsTabLink = <TransLink href={links.studentsTab} />

  const linkedExamsContent = (
    <div className={nestedCss}>
      <div>
        <h4 className={formSectionTitleCss}>{t("heading-linked-exams")}</h4>
        {linkedExams.length === 0 ? (
          <p className={emptyExamListCss}>{t("linked-exams-empty")}</p>
        ) : (
          <ul className={examListCss}>
            {linkedExams.map((linkedExam) => (
              <li key={linkedExam.id}>
                <Link href={manageExamRoute(linkedExam.id)}>{linkedExam.name}</Link>
                {[
                  formatDateWindow(dateFormatter, linkedExam.starts_at, linkedExam.ends_at),
                  linkedExam.pass_mark === null || linkedExam.pass_mark === undefined
                    ? t("linked-exam-graded-manually")
                    : t("linked-exam-pass-mark", { points: linkedExam.pass_mark }),
                ]
                  .filter((part): part is string => part !== null)
                  // oxlint-disable-next-line i18next/no-literal-string
                  .map((part) => ` · ${part}`)
                  .join("")}
              </li>
            ))}
          </ul>
        )}
      </div>
      {linkedExams.length > 0 && !noLinkedExamHasPassMark && (
        <p className={noteCss}>{t("linked-exams-rule")}</p>
      )}
      {links.examsPage && (
        <p className={examLinksCss}>
          <Link href={links.examsPage}>
            {linkedExams.length === 0 ? t("link-an-exam") : t("link-another-exam")}
          </Link>
          <span className={examLinksHintCss}>
            <Trans
              t={t}
              i18nKey="exams-are-made-on-exams-page"
              components={{ link: <TransLink href={links.examsPage} /> }}
            />
          </span>
        </p>
      )}
      {noLinkedExamHasPassMark && (
        <Infobox tone={TONE.NEUTRAL}>{t("linked-exams-no-pass-mark")}</Infobox>
      )}
    </div>
  )

  const outsideRouteQuestion = (
    <div>
      <RadioGroup
        name="credit_registration_route"
        control={control}
        label={
          <span className={formSectionTitleCss}>{t("question-credit-registration-route")}</span>
        }
        isRequired
      >
        <Radio
          value="platform"
          label={isExaminarium ? t("route-platform-examinarium") : t("route-platform-outside-exam")}
          badge={<Badge tone={TONE.SUCCESS}>{t("badge-recommended")}</Badge>}
          description={
            isExaminarium
              ? t("route-platform-examinarium-description")
              : t("route-platform-outside-exam-description")
          }
        />
        <Radio
          value="external"
          isHidden={!isExternalRouteRevealed}
          label={isExaminarium ? t("route-external-examinarium") : t("route-external-outside-exam")}
          badge={<Badge tone={TONE.NEUTRAL}>{t("badge-not-recommended")}</Badge>}
          description={t("route-external-description")}
          nestedContentVariant={NESTED_INDENT}
          nestedContent={
            <Infobox tone={TONE.DANGER}>
              <p className={css({ margin: "0 0 var(--space-2)" })}>
                {isExaminarium
                  ? t("route-external-warning-examinarium")
                  : t("route-external-warning-outside-exam")}
              </p>
              <LinkButton
                onPress={() =>
                  setValue("credit_registration_route", "platform", { shouldDirty: true })
                }
              >
                {t("button-add-results-here-instead")}
              </LinkButton>
            </Infobox>
          }
        />
      </RadioGroup>
      {!isExternalRouteRevealed && (
        <p className={css({ margin: "var(--space-3) 0 0" })}>
          <LinkButton
            onPress={() => {
              setIsExternalRouteRevealed(true)
              setValue("credit_registration_route", "external", { shouldDirty: true })
            }}
          >
            {isExaminarium
              ? t("reveal-external-route-examinarium")
              : t("reveal-external-route-outside-exam")}
          </LinkButton>
        </p>
      )}
    </div>
  )

  const requirementRow = (requirement: Requirement) => {
    const fields = REQUIREMENT_FIELDS[requirement]
    const label = t(fields.label)
    const value = watch(fields.value)
    return (
      <div className={requirementRowCss}>
        <Checkbox name={fields.enabled} control={control} label={label} />
        <div className={requirementValueCss}>
          <NumberField
            name={fields.value}
            control={control}
            label={<VisuallyHidden elementType={HIDDEN_TEXT_ELEMENT}>{label}</VisuallyHidden>}
            unit={t(fields.unit, { count: value ?? 0 })}
            minValue={0}
            step={1}
            helperAction={
              moduleTotals ? (
                <LinkButton onPress={() => setCalculatorFor(requirement)}>
                  {t("work-out-from-percentage")}
                </LinkButton>
              ) : undefined
            }
            rules={{
              validate: (current, values) =>
                values.pass_method !== "automatic" ||
                !values[fields.enabled] ||
                (current !== null && current !== undefined) ||
                t("error-enter-a-number"),
            }}
          />
        </div>
      </div>
    )
  }

  const calculatorFields = REQUIREMENT_FIELDS[calculatorFor ?? POINTS]
  const calculatorTotal = moduleTotals ? calculatorFields.totalOf(moduleTotals) : 0
  const formatCalculatorQuantity = (count: number) => t(calculatorFields.count, { count })

  const requirementsContent = (
    <div className={nestedCss}>
      <div>
        <h4 className={formSectionTitleCss}>
          {isOnPlatform ? t("requirements-to-take-exam") : t("requirements-all-must-be-true")}
        </h4>
        {isOnPlatform && (
          <p className={noteCss}>
            {requiresPoints || requiresExercises
              ? t("requirements-gate-note")
              : t("requirements-gate-none")}
          </p>
        )}
      </div>
      {moduleTotals && (
        <p className={noteCss}>
          {t("module-totals", {
            exercises: t("count-exercises", { count: moduleTotals.exercises }),
            points: t("count-points", { count: moduleTotals.points }),
          })}
        </p>
      )}
      <div>
        {requirementRow(POINTS)}
        {requirementRow(EXERCISES)}
      </div>
      {hasNoRequirement && (
        <Infobox tone={TONE.DANGER}>
          <Trans t={t} i18nKey="error-no-requirement-chosen" components={{ strong: <strong /> }} />
        </Infobox>
      )}
    </div>
  )

  const switchExplanation = switchReason ? t(SWITCH_EXPLANATION_KEYS[switchReason]) : null

  return (
    <>
      <FormSection
        title={t("heading-completion-of-this-module")}
        description={t("description-completion-of-this-module")}
      >
        <div className={sectionBodyCss}>
          <RadioGroup
            name="exam_required"
            control={control}
            label={<span className={questionLegendCss}>{t("question-exam-required")}</span>}
          >
            <Radio value="yes" label={t("yes")} />
            <Radio value="no" label={t("no")} description={t("exam-not-required-description")} />
          </RadioGroup>
          <Reveal isOpen={examRequired === "yes"}>
            <RadioGroup
              name="exam_location"
              control={control}
              label={<span className={questionLegendCss}>{t("question-exam-location")}</span>}
              rules={{
                validate: (value, values) =>
                  values.exam_required === "no" ||
                  value !== "" ||
                  t("error-exam-location-required"),
              }}
            >
              <Radio
                value="platform"
                label={t("exam-location-platform")}
                description={t("exam-location-platform-description")}
                nestedContent={linkedExamsContent}
              />
              <Radio
                value="examinarium"
                label={t("exam-location-examinarium")}
                badge={<Badge tone={TONE.NEUTRAL}>{t("badge-more-setup-needed")}</Badge>}
                nestedContent={
                  <div className={nestedCss}>
                    <p className={noteCss}>
                      <Trans
                        t={t}
                        i18nKey="examinarium-arrange-access"
                        components={{ strong: <strong /> }}
                      />
                    </p>
                    <p className={noteCss}>
                      <Trans
                        t={t}
                        i18nKey="examinarium-add-results"
                        components={{ strong: <strong />, link: studentsTabLink }}
                      />
                    </p>
                    {outsideRouteQuestion}
                  </div>
                }
              />
              <Radio
                value="elsewhere"
                label={t("exam-location-elsewhere")}
                nestedContent={
                  <div className={nestedCss}>
                    <TextField
                      name="exam_location_description"
                      control={control}
                      label={t("label-exam-location-description")}
                      placeholder={t("placeholder-exam-location-description")}
                      isRequired
                      rules={{
                        validate: (value, values) =>
                          examRequirementOf(values) !== "elsewhere" ||
                          value.trim() !== "" ||
                          t("error-exam-location-description-required"),
                      }}
                    />
                    <p className={noteCss}>
                      <Trans
                        t={t}
                        i18nKey="outside-exam-add-results"
                        components={{ strong: <strong />, link: studentsTabLink }}
                      />
                    </p>
                    {outsideRouteQuestion}
                  </div>
                }
              />
            </RadioGroup>
          </Reveal>
        </div>
      </FormSection>

      <FormSection>
        <div className={sectionBodyCss}>
          <RadioGroup
            name="pass_method"
            control={control}
            label={<span className={questionLegendCss}>{t("question-how-students-pass")}</span>}
          >
            <Reveal isOpen={switchExplanation !== null} rootClassName={radioListRevealCss}>
              <Infobox tone={TONE.INFO} announce>
                {switchExplanation}
              </Infobox>
            </Reveal>
            <Radio
              value="not_decided"
              label={t("pass-method-not-decided")}
              description={t("pass-method-not-decided-description")}
            />
            <Radio
              value="automatic"
              isHidden={(isOutside || noLinkedExamHasPassMark) && passMethod !== AUTOMATIC}
              label={isOnPlatform ? t("pass-method-by-exam") : t("pass-method-by-requirements")}
              description={
                isOnPlatform
                  ? t("pass-method-by-exam-description")
                  : t("pass-method-by-requirements-description")
              }
              nestedContentVariant={NESTED_INDENT}
              nestedContent={requirementsContent}
            />
            <Radio
              value="teacher_adds"
              isHidden={passesByExam && passMethod !== TEACHER_ADDS}
              label={t("pass-method-teacher-adds")}
              badge={
                isOutside ? (
                  <Badge tone={TONE.SUCCESS}>{t("badge-recommended-for-outside-exams")}</Badge>
                ) : undefined
              }
              description={
                <Trans
                  t={t}
                  i18nKey={
                    isOnPlatform
                      ? "pass-method-teacher-adds-no-pass-mark-description"
                      : "pass-method-teacher-adds-description"
                  }
                  components={{ link: studentsTabLink }}
                />
              }
            />
          </RadioGroup>
        </div>
      </FormSection>

      <FormSection>
        <div className={sectionBodyCss}>
          {!isOutside && (
            <RadioGroup
              name="credit_registration_route"
              control={control}
              label={
                <span className={questionLegendCss}>{t("question-credit-registration-route")}</span>
              }
            >
              <Radio
                value="platform"
                label={t("route-platform")}
                description={t("route-platform-description")}
              />
              <Radio
                value="certificate_only"
                label={t("route-certificate-only")}
                badge={<Badge tone={TONE.NEUTRAL}>{t("badge-exception")}</Badge>}
                description={t("route-certificate-only-description")}
              />
            </RadioGroup>
          )}
          {route !== "external" &&
            (canToggleCertificates ? (
              <div className={certificateRowCss}>
                <Checkbox
                  name="certification_enabled"
                  control={control}
                  label={t("label-students-can-get-certificate")}
                  isDisabled={route === "certificate_only" && certificationEnabled}
                />
                <Link href={links.certificatesPage}>{t("link-certificates-page")}</Link>
              </div>
            ) : (
              <p className={css({ margin: 0 })}>
                <Trans
                  t={t}
                  i18nKey="certificate-not-set-up"
                  components={{ link: <TransLink href={links.certificatesPage} /> }}
                />
              </p>
            ))}
          <div className={fieldGroupCss}>
            <h4 className={formSectionTitleCss}>{t("heading-course-code-and-credits")}</h4>
            <div className={fieldRowCss}>
              <TextField
                name="uh_course_code"
                control={control}
                label={t("label-course-code")}
                isRequired
                rules={{
                  validate: (value) => value.trim() !== "" || t("error-course-code-required"),
                }}
              />
              <NumberField
                name="ects_credits"
                control={control}
                label={t("label-credits-ects")}
                isRequired
                minValue={0}
                step={0.5}
                commitBehavior={KEEP_AS_TYPED}
                rules={{
                  validate: (value) =>
                    value === null || value === undefined
                      ? t("error-credits-required")
                      : value > 0 || t("error-credits-must-be-positive"),
                }}
              />
            </div>
            <Reveal isOpen={route === "platform"}>
              <TextField
                name="completion_registration_link_override"
                control={control}
                label={t("label-registration-link")}
                description={t("description-registration-link")}
                placeholder={URL_PLACEHOLDER}
                inputMode={URL_INPUT_MODE}
                isRequired
                rules={{
                  validate: (value, values) => {
                    if (values.credit_registration_route !== "platform") {
                      return true
                    }
                    if (value.trim() === "") {
                      return t("error-registration-link-required")
                    }
                    return httpsUrlOrNull(value) !== null || t("error-registration-link-https")
                  },
                }}
              />
            </Reveal>
          </div>
        </div>
      </FormSection>

      <PercentageCalculatorDialog
        open={calculatorFor !== null}
        onClose={() => setCalculatorFor(null)}
        title={t(calculatorFields.calculatorTitle)}
        description={t("calculator-module-has", {
          quantity: formatCalculatorQuantity(calculatorTotal),
        })}
        total={calculatorTotal}
        formatQuantity={formatCalculatorQuantity}
        unitPlural={t(calculatorFields.unitPlural)}
        defaultPercentage={DEFAULT_PERCENTAGE}
        onUse={(count) => {
          if (calculatorFor !== null) {
            setValue(calculatorFields.enabled, true, { shouldDirty: true })
            setValue(calculatorFields.value, count, { shouldDirty: true, shouldValidate: true })
          }
          setCalculatorFor(null)
        }}
      />
    </>
  )
}

export default ModuleCompletionFields
