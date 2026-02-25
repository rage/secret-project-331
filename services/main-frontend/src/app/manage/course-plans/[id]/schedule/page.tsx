"use client"

import { css, cx } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Berries,
  Cabin,
  Campfire,
  CandleLight,
  Leaf,
  MapleLeaf,
  MistyCloud,
  PineTree,
  Sleigh,
  Sunrise,
  WaterLiquid,
  WinterSnowflake,
} from "@vectopus/atlas-icons-react"
import { addMonths, endOfMonth, format, parseISO, startOfMonth } from "date-fns"
import { useAtomValue, useSetAtom } from "jotai"
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useProgressBar } from "react-aria"
import { useTranslation } from "react-i18next"

import {
  addMonthToStageAtomFamily,
  draftStagesAtomFamily,
  removeMonthFromStageAtomFamily,
  scheduleWizardStepAtomFamily,
} from "./scheduleAtoms"

import {
  CourseDesignerCourseSize,
  CourseDesignerScheduleStageInput,
  CourseDesignerStage,
  finalizeCourseDesignerSchedule,
  generateCourseDesignerScheduleSuggestion,
  getCourseDesignerPlan,
  saveCourseDesignerSchedule,
} from "@/services/backend/courseDesigner"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const STAGE_ORDER: CourseDesignerStage[] = [
  "Analysis",
  "Design",
  "Development",
  "Implementation",
  "Evaluation",
]

const MONTH_ICONS = [
  WinterSnowflake,
  Sleigh,
  Sunrise,
  WaterLiquid,
  Leaf,
  Campfire,
  Cabin,
  Berries,
  MapleLeaf,
  MistyCloud,
  CandleLight,
  PineTree,
] as const

type StageMonth = {
  id: string
  date: Date
  label: string
}

function getStageMonths(stage: CourseDesignerScheduleStageInput): StageMonth[] {
  const start = startOfMonth(parseISO(stage.planned_starts_on))
  const end = endOfMonth(parseISO(stage.planned_ends_on))
  const months: StageMonth[] = []
  let d = start
  while (d <= end) {
    months.push({
      id: format(d, "yyyy-MM"),
      date: d,
      label: format(d, "MMM yyyy"),
    })
    d = addMonths(d, 1)
  }
  return months
}

const containerStyles = css`
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem;
`

const wizardStepsStripStyles = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
  position: relative;
  gap: 0.5rem;
`

const wizardStepPillStyles = (isActive: boolean, isCompleted: boolean) => css`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  position: relative;
  z-index: 1;

  .wizard-step-circle {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.95rem;
    transition:
      background-color 0.2s,
      color 0.2s,
      border-color 0.2s,
      box-shadow 0.2s;
    border: 2px solid ${baseTheme.colors.gray[300]};
    background: white;
    color: ${baseTheme.colors.gray[500]};
  }

  ${isCompleted &&
  css`
    .wizard-step-circle {
      background: ${baseTheme.colors.green[500]};
      border-color: ${baseTheme.colors.green[600]};
      color: white;
    }
  `}

  ${isActive &&
  css`
    .wizard-step-circle {
      background: ${baseTheme.colors.green[600]};
      border-color: ${baseTheme.colors.green[700]};
      color: white;
      box-shadow: 0 0 0 4px ${baseTheme.colors.green[100]};
    }
  `}

  .wizard-step-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: ${isActive ? baseTheme.colors.green[700] : baseTheme.colors.gray[500]};
    text-align: center;
    line-height: 1.2;
  }
`

const wizardStepsConnectorStyles = css`
  position: absolute;
  top: 19px;
  left: 0;
  right: 0;
  height: 2px;
  background: ${baseTheme.colors.gray[200]};
  z-index: 0;
  pointer-events: none;
`

const wizardProgressFillBaseStyles = css`
  position: absolute;
  top: 19px;
  left: 0;
  width: 100%;
  height: 2px;
  background: ${baseTheme.colors.green[500]};
  z-index: 0;
  pointer-events: none;
  transform-origin: left;
`

const sectionStyles = css`
  background: white;
  border: 1px solid #d9dde4;
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1rem;
`

const wizardStepCardStyles = css`
  background: white;
  border-radius: 16px;
  padding: 2rem 2.25rem;
  margin-bottom: 1rem;
  border: 1px solid ${baseTheme.colors.gray[200]};
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.06),
    0 0 1px rgba(0, 0, 0, 0.04);
  border-left: 4px solid ${baseTheme.colors.green[500]};

  h2 {
    font-size: 1.35rem;
    font-weight: 700;
    color: ${baseTheme.colors.gray[800]};
    margin: 0 0 1.5rem 0;
    letter-spacing: -0.02em;
  }

  input[type="text"],
  input[type="month"],
  select {
    padding: 0.65rem 0.85rem;
    border-radius: 10px;
    border: 1px solid ${baseTheme.colors.gray[300]};
    font-size: 1rem;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;

    :focus {
      outline: none;
      border-color: ${baseTheme.colors.green[500]};
      box-shadow: 0 0 0 3px ${baseTheme.colors.green[100]};
    }
  }

  label {
    font-weight: 600;
    color: ${baseTheme.colors.gray[700]};
    font-size: 0.9rem;
    margin-bottom: 0.15rem;
  }
`

const toolbarStyles = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: end;
`

const fieldStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  input,
  select {
    padding: 0.5rem;
    border-radius: 8px;
    border: 1px solid #c8cfda;
    font: inherit;
  }
`

const stageCardStyles = css`
  position: relative;
  transform-origin: center;
  display: flex;
  gap: 1rem;
  border: 1px solid ${baseTheme.colors.gray[300]};
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 0.75rem;
  background: ${baseTheme.colors.gray[50]};
`

const stageMonthBlocksStyles = css`
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: stretch;
  flex-shrink: 0;
  width: 72px;
`

const stageMonthBlockStyles = css`
  width: 72px;
  height: 72px;
  background: ${baseTheme.colors.green[400]};
  border: 1px solid ${baseTheme.colors.green[600]};
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 0.25rem;
  color: white;
`

const stageMonthBlockMonthStyles = css`
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
`

const stageMonthBlockYearStyles = css`
  font-size: 0.7rem;
  font-weight: 500;
  opacity: 0.85;
  line-height: 1.2;
`

const stageMonthBlockIconStyles = css`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2px;

  svg {
    width: 18px;
    height: 18px;
  }
`

const stageCardRightStyles = css`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

const stageDescriptionPlaceholderStyles = css`
  font-size: 0.85rem;
  color: ${baseTheme.colors.gray[500]};
  font-style: italic;
`

const stageCardActionsStyles = css`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`

const wizardNavStyles = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
`

const todayMonthValue = () => format(new Date(), "yyyy-MM")

function monthToStartsOnDate(month: string): string {
  return month ? `${month}-01` : ""
}

const COURSE_DESIGNER_PLAN_QUERY_KEY = "course-designer-plan"

const COURSE_DESIGNER_PLANS_QUERY_KEY = "course-designer-plans"

function CoursePlanSchedulePage() {
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const planId = params.id

  const planQuery = useQuery({
    queryKey: [COURSE_DESIGNER_PLAN_QUERY_KEY, planId],
    queryFn: () => getCourseDesignerPlan(planId),
  })

  const [planName, setPlanName] = useState("")
  // eslint-disable-next-line i18next/no-literal-string
  const [courseSize, setCourseSize] = useState<CourseDesignerCourseSize>("medium")
  const [startsOnMonth, setStartsOnMonth] = useState(todayMonthValue())
  const [initializedFromQuery, setInitializedFromQuery] = useState<string | null>(null)

  const wizardStep = useAtomValue(scheduleWizardStepAtomFamily(planId))
  const setWizardStep = useSetAtom(scheduleWizardStepAtomFamily(planId))
  const [wizardDirection, setWizardDirection] = useState<1 | -1>(1)
  const goToStep = useCallback(
    (step: 0 | 1 | 2, direction: 1 | -1) => {
      setWizardDirection(direction)
      setWizardStep(step)
    },
    [setWizardStep],
  )
  const draftStages = useAtomValue(draftStagesAtomFamily(planId))
  const setDraftStages = useSetAtom(draftStagesAtomFamily(planId))
  const addStageMonth = useSetAtom(addMonthToStageAtomFamily(planId))
  const removeStageMonth = useSetAtom(removeMonthFromStageAtomFamily(planId))

  const stageLabel = useCallback(
    (stage: CourseDesignerStage) => {
      switch (stage) {
        case "Analysis":
          return t("course-plans-stage-analysis")
        case "Design":
          return t("course-plans-stage-design")
        case "Development":
          return t("course-plans-stage-development")
        case "Implementation":
          return t("course-plans-stage-implementation")
        case "Evaluation":
          return t("course-plans-stage-evaluation")
      }
    },
    [t],
  )

  const validateStages = useCallback(
    (stages: Array<CourseDesignerScheduleStageInput>): string | null => {
      if (stages.length !== 5) {
        return t("course-plans-validation-stage-count")
      }
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i]
        if (stage.planned_starts_on > stage.planned_ends_on) {
          return t("course-plans-validation-stage-range", { stage: stageLabel(stage.stage) })
        }
        if (i > 0) {
          // eslint-disable-next-line i18next/no-literal-string
          const previous = new Date(`${stages[i - 1].planned_ends_on}T00:00:00Z`)
          previous.setUTCDate(previous.getUTCDate() + 1)
          const expected = previous.toISOString().slice(0, 10)
          if (stage.planned_starts_on !== expected) {
            return t("course-plans-validation-contiguous")
          }
        }
      }
      return null
    },
    [t, stageLabel],
  )

  useEffect(() => {
    if (!planQuery.data || initializedFromQuery === planId) {
      return
    }
    setPlanName(planQuery.data.plan.name ?? "")
    if (planQuery.data.stages.length > 0) {
      const stages = planQuery.data.stages.map((stage) => ({
        stage: stage.stage,
        planned_starts_on: stage.planned_starts_on,
        planned_ends_on: stage.planned_ends_on,
      }))
      setDraftStages(stages)
      setStartsOnMonth(planQuery.data.stages[0].planned_starts_on.slice(0, 7))
      setWizardStep(2)
    } else {
      setWizardStep(0)
    }
    setInitializedFromQuery(planId)
  }, [initializedFromQuery, planId, planQuery.data, setDraftStages, setWizardStep])

  const suggestionMutation = useToastMutation(
    () =>
      generateCourseDesignerScheduleSuggestion(planId, {
        course_size: courseSize,
        starts_on: monthToStartsOnDate(startsOnMonth),
      }),
    { notify: true, method: "POST" },
    {
      onSuccess: (result) => {
        setDraftStages(result.stages)
      },
    },
  )

  const saveMutation = useToastMutation(
    () =>
      saveCourseDesignerSchedule(planId, {
        name: planName.trim() === "" ? null : planName.trim(),
        stages: draftStages,
      }),
    { notify: true, method: "PUT" },
    {
      onSuccess: async (details) => {
        const stages = details.stages.map((stage) => ({
          stage: stage.stage,
          planned_starts_on: stage.planned_starts_on,
          planned_ends_on: stage.planned_ends_on,
        }))
        setDraftStages(stages)
        await queryClient.invalidateQueries({ queryKey: [COURSE_DESIGNER_PLAN_QUERY_KEY, planId] })
        await queryClient.invalidateQueries({ queryKey: [COURSE_DESIGNER_PLANS_QUERY_KEY] })
      },
    },
  )

  const finalizeMutation = useToastMutation(
    () => finalizeCourseDesignerSchedule(planId),
    { notify: true, method: "POST" },
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: [COURSE_DESIGNER_PLAN_QUERY_KEY, planId] })
        await queryClient.invalidateQueries({ queryKey: [COURSE_DESIGNER_PLANS_QUERY_KEY] })
      },
    },
  )

  const validationError = useMemo(() => validateStages(draftStages), [draftStages, validateStages])
  const handleFinalizeSchedule = () => {
    void saveMutation
      .mutateAsync()
      .then(() => finalizeMutation.mutateAsync())
      .catch(() => {
        // Mutation hooks already surface errors to the user; stop the chain on failure.
      })
  }

  const stageMonthsByStage = useMemo(() => {
    if (draftStages.length !== 5) {
      return {} as Record<CourseDesignerStage, StageMonth[]>
    }
    const byStage = {} as Record<CourseDesignerStage, StageMonth[]>
    for (const stage of STAGE_ORDER) {
      const stageInput = draftStages.find((s) => s.stage === stage)
      byStage[stage] = stageInput ? getStageMonths(stageInput) : []
    }
    return byStage
  }, [draftStages])

  const reduceMotion = useReducedMotion()
  const [pulseStage, setPulseStage] = useState<number | null>(null)

  const progressPercentage = ((wizardStep + 1 - 1) / (3 - 1)) * 100
  const progressBar = useProgressBar({
    label: t("course-plans-wizard-progress-label"),
    value: wizardStep + 1,
    minValue: 1,
    maxValue: 3,
    // eslint-disable-next-line i18next/no-literal-string -- step counter, not user-facing copy
    valueLabel: `Step ${wizardStep + 1} of 3`,
  })

  const stepTransition = reduceMotion
    ? { duration: 0 }
    : {
        type: "tween" as const,
        duration: 0.25,
        // eslint-disable-next-line i18next/no-literal-string -- Motion ease value
        ease: "easeOut" as const,
      }
  const stepVariants = {
    initial: (dir: number) =>
      reduceMotion ? { opacity: 0 } : { x: dir === 1 ? 40 : -40, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: (dir: number) =>
      reduceMotion ? { opacity: 0 } : { x: dir === 1 ? -40 : 40, opacity: 0 },
  }

  const staggerContainerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.05,
        delayChildren: reduceMotion ? 0 : 0.02,
      },
    },
  }
  const staggerChildVariants = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 },
    visible: reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 },
  }
  const staggerTransition = reduceMotion
    ? { duration: 0 }
    : {
        type: "tween" as const,
        duration: 0.2,
        // eslint-disable-next-line i18next/no-literal-string -- Motion ease
        ease: "easeOut" as const,
      }

  if (planQuery.isError) {
    return <ErrorBanner variant="readOnly" error={planQuery.error} />
  }

  if (planQuery.isLoading || !planQuery.data) {
    return <Spinner variant="medium" />
  }

  return (
    <div className={containerStyles}>
      <h1
        className={css`
          font-size: 1.75rem;
          font-weight: 700;
          color: ${baseTheme.colors.gray[800]};
          margin: 0 0 0.5rem 0;
          letter-spacing: -0.02em;
        `}
      >
        {t("course-plans-schedule-title")}
      </h1>
      <p
        className={css`
          font-size: 0.95rem;
          color: ${baseTheme.colors.gray[500]};
          margin: 0 0 2rem 0;
        `}
      >
        {t("course-plans-wizard-progress-label")}: {progressBar.progressBarProps["aria-valuetext"]}
      </p>

      <div className={wizardStepsStripStyles}>
        <div className={wizardStepsConnectorStyles} aria-hidden />
        <motion.div
          className={wizardProgressFillBaseStyles}
          aria-hidden
          initial={false}
          animate={{ scaleX: progressPercentage / 100 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : {
                  type: "tween",
                  duration: 0.35,
                  // eslint-disable-next-line i18next/no-literal-string -- Motion ease
                  ease: "easeOut",
                }
          }
        />
        <div className={wizardStepPillStyles(wizardStep === 0, wizardStep > 0)}>
          <motion.div
            className="wizard-step-circle"
            aria-hidden
            animate={
              reduceMotion
                ? {}
                : wizardStep === 0
                  ? { scale: [1, 1.05, 1] }
                  : wizardStep > 0
                    ? { scale: [1, 1.12, 1] }
                    : {}
            }
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    type: "tween",
                    duration: 0.25,
                    // eslint-disable-next-line i18next/no-literal-string -- Motion ease
                    ease: "easeOut",
                  }
            }
          >
            {/* eslint-disable-next-line i18next/no-literal-string -- step indicator */}
            {wizardStep > 0 ? "✓" : "1"}
          </motion.div>
          <span className="wizard-step-label">{t("course-plans-wizard-step-name")}</span>
        </div>
        <div className={wizardStepPillStyles(wizardStep === 1, wizardStep > 1)}>
          <motion.div
            className="wizard-step-circle"
            aria-hidden
            animate={
              reduceMotion
                ? {}
                : wizardStep === 1
                  ? { scale: [1, 1.05, 1] }
                  : wizardStep > 1
                    ? { scale: [1, 1.12, 1] }
                    : {}
            }
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    type: "tween",
                    duration: 0.25,
                    // eslint-disable-next-line i18next/no-literal-string -- Motion ease
                    ease: "easeOut",
                  }
            }
          >
            {/* eslint-disable-next-line i18next/no-literal-string -- step indicator */}
            {wizardStep > 1 ? "✓" : "2"}
          </motion.div>
          <span className="wizard-step-label">{t("course-plans-wizard-step-size-and-date")}</span>
        </div>
        <div className={wizardStepPillStyles(wizardStep === 2, false)}>
          <motion.div
            className="wizard-step-circle"
            aria-hidden
            animate={reduceMotion ? {} : wizardStep === 2 ? { scale: [1, 1.05, 1] } : {}}
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    type: "tween",
                    duration: 0.2,
                    // eslint-disable-next-line i18next/no-literal-string -- Motion ease
                    ease: "easeOut",
                  }
            }
          >
            3
          </motion.div>
          <span className="wizard-step-label">{t("course-plans-wizard-step-schedule")}</span>
        </div>
      </div>

      <div
        {...progressBar.progressBarProps}
        className={css`
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip-path: inset(50%);
          white-space: nowrap;
          border: 0;
        `}
      >
        {t("course-plans-wizard-progress-label")}: {progressBar.progressBarProps["aria-valuetext"]}
      </div>

      {/* eslint-disable i18next/no-literal-string -- Motion API uses literal mode/variant names */}
      <AnimatePresence mode="wait" custom={wizardDirection}>
        <motion.div
          key={wizardStep}
          custom={wizardDirection}
          variants={stepVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={stepTransition}
          className={cx(sectionStyles, wizardStepCardStyles)}
          layout={!reduceMotion}
        >
          {wizardStep === 0 && (
            <motion.div
              variants={staggerContainerVariants}
              initial="hidden"
              animate="visible"
              style={{ display: "contents" }}
            >
              <motion.div variants={staggerChildVariants} transition={staggerTransition}>
                <h2>{t("course-plans-wizard-step-name")}</h2>
              </motion.div>
              <motion.div variants={staggerChildVariants} transition={staggerTransition}>
                <div className={fieldStyles}>
                  <label htmlFor="course-plan-name">{t("course-plans-plan-name-label")}</label>
                  <input
                    id="course-plan-name"
                    type="text"
                    value={planName}
                    onChange={(event) => setPlanName(event.target.value)}
                    placeholder={t("course-plans-untitled-plan")}
                  />
                </div>
              </motion.div>
              <motion.div variants={staggerChildVariants} transition={staggerTransition}>
                <p
                  className={css`
                    margin-top: 0.75rem;
                    color: ${baseTheme.colors.gray[500]};
                    font-size: 0.9rem;
                  `}
                >
                  {t("course-plans-wizard-name-hint")}
                </p>
              </motion.div>
              <motion.div variants={staggerChildVariants} transition={staggerTransition}>
                <div className={wizardNavStyles}>
                  <Button variant="primary" size="medium" onClick={() => goToStep(1, 1)}>
                    {t("continue")}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {wizardStep === 1 && (
            <motion.div
              variants={staggerContainerVariants}
              initial="hidden"
              animate="visible"
              style={{ display: "contents" }}
            >
              <motion.div variants={staggerChildVariants} transition={staggerTransition}>
                <h2>{t("course-plans-wizard-step-size-and-date")}</h2>
              </motion.div>
              <motion.div variants={staggerChildVariants} transition={staggerTransition}>
                <div className={toolbarStyles}>
                  <div className={fieldStyles}>
                    <label htmlFor="course-size">{t("course-plans-course-size-label")}</label>
                    <select
                      id="course-size"
                      value={courseSize}
                      onChange={(event) =>
                        setCourseSize(event.target.value as CourseDesignerCourseSize)
                      }
                    >
                      {}
                      <option value="small">{t("course-plans-course-size-small")}</option>
                      {}
                      <option value="medium">{t("course-plans-course-size-medium")}</option>
                      {}
                      <option value="large">{t("course-plans-course-size-large")}</option>
                    </select>
                  </div>
                  <div className={fieldStyles}>
                    <label htmlFor="starts-on-month">
                      {t("course-plans-wizard-starts-on-month-label")}
                    </label>
                    <input
                      id="starts-on-month"
                      type="month"
                      value={startsOnMonth}
                      onChange={(event) => setStartsOnMonth(event.target.value)}
                    />
                  </div>
                </div>
              </motion.div>
              <motion.div variants={staggerChildVariants} transition={staggerTransition}>
                <div className={wizardNavStyles}>
                  <Button variant="secondary" size="medium" onClick={() => goToStep(0, -1)}>
                    {t("back")}
                  </Button>
                  <Button
                    variant="primary"
                    size="medium"
                    onClick={() =>
                      suggestionMutation.mutate(undefined, {
                        onSuccess: () => goToStep(2, 1),
                      })
                    }
                    disabled={!startsOnMonth.trim() || suggestionMutation.isPending}
                  >
                    {suggestionMutation.isPending ? t("loading") : t("continue")}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {wizardStep === 2 && (
            <motion.div
              variants={staggerContainerVariants}
              initial="hidden"
              animate="visible"
              style={{ display: "contents" }}
            >
              <motion.div variants={staggerChildVariants} transition={staggerTransition}>
                <h2>{t("course-plans-wizard-step-schedule")}</h2>
              </motion.div>
              <motion.div variants={staggerChildVariants} transition={staggerTransition}>
                <div className={toolbarStyles}>
                  <Button
                    variant="secondary"
                    size="medium"
                    onClick={() => suggestionMutation.mutate()}
                    disabled={suggestionMutation.isPending || !startsOnMonth.trim()}
                  >
                    {t("course-plans-reset-suggestion")}
                  </Button>
                </div>
              </motion.div>

              <motion.div variants={staggerChildVariants} transition={staggerTransition}>
                {draftStages.length === 0 && <p>{t("course-plans-schedule-empty-help")}</p>}
              </motion.div>

              {draftStages.length === 5 && (
                <motion.div variants={staggerChildVariants} transition={staggerTransition}>
                  <LayoutGroup>
                    <div
                      className={css`
                        margin-top: 1rem;
                        display: flex;
                        flex-direction: column;
                        gap: 0.75rem;
                      `}
                    >
                      {STAGE_ORDER.map((stage, stageIndex) => {
                        const months = stageMonthsByStage[stage] ?? []
                        const canShrink = months.length > 1
                        return (
                          <motion.div
                            key={stage}
                            layout
                            className={stageCardStyles}
                            data-testid={`course-plan-stage-${stage}`}
                            transition={
                              reduceMotion
                                ? { duration: 0 }
                                : { type: "spring", stiffness: 300, damping: 30 }
                            }
                          >
                            <motion.div
                              className={css`
                                display: flex;
                                gap: 1rem;
                                width: 100%;
                              `}
                              animate={
                                pulseStage === stageIndex ? { scale: [1, 1.02, 1] } : { scale: 1 }
                              }
                              transition={
                                pulseStage === stageIndex
                                  ? reduceMotion
                                    ? { duration: 0 }
                                    : {
                                        type: "tween",
                                        duration: 0.18,

                                        ease: "easeOut",
                                      }
                                  : reduceMotion
                                    ? { duration: 0 }
                                    : { type: "spring", stiffness: 300, damping: 30 }
                              }
                              onAnimationComplete={() => {
                                if (pulseStage === stageIndex) {
                                  setPulseStage(null)
                                }
                              }}
                            >
                              <div className={stageMonthBlocksStyles}>
                                {}
                                <AnimatePresence initial={false} mode="popLayout">
                                  {months.map((m) => {
                                    const MonthIcon = MONTH_ICONS[m.date.getMonth()]
                                    return (
                                      <motion.div
                                        key={m.id}
                                        layout
                                        layoutId={`month-${m.id}`}
                                        initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={
                                          reduceMotion
                                            ? { opacity: 0 }
                                            : { opacity: 0, scale: 0.98 }
                                        }
                                        transition={
                                          reduceMotion
                                            ? { duration: 0 }
                                            : { type: "spring", stiffness: 300, damping: 30 }
                                        }
                                      >
                                        <div className={stageMonthBlockStyles} title={m.label}>
                                          <div className={stageMonthBlockIconStyles}>
                                            <MonthIcon />
                                          </div>
                                          <span className={stageMonthBlockMonthStyles}>
                                            {format(m.date, "MMMM")}
                                          </span>
                                          <span className={stageMonthBlockYearStyles}>
                                            {format(m.date, "yyyy")}
                                          </span>
                                        </div>
                                      </motion.div>
                                    )
                                  })}
                                </AnimatePresence>
                              </div>
                              <div className={stageCardRightStyles}>
                                <h3
                                  className={css`
                                    margin: 0;
                                    font-size: 1.1rem;
                                    font-weight: 600;
                                    color: ${baseTheme.colors.gray[700]};
                                  `}
                                >
                                  {stageLabel(stage)}
                                </h3>
                                <p className={stageDescriptionPlaceholderStyles}>
                                  {t("course-plans-stage-description-placeholder")}
                                </p>
                                <div className={stageCardActionsStyles}>
                                  <Button
                                    variant="secondary"
                                    size="small"
                                    onClick={() => {
                                      setPulseStage(stageIndex)
                                      addStageMonth(stageIndex)
                                    }}
                                  >
                                    {t("course-plans-add-one-month")}
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="small"
                                    onClick={() => {
                                      setPulseStage(stageIndex)
                                      removeStageMonth(stageIndex)
                                    }}
                                    disabled={!canShrink}
                                  >
                                    {t("course-plans-remove-one-month")}
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          </motion.div>
                        )
                      })}
                    </div>
                  </LayoutGroup>
                </motion.div>
              )}

              <AnimatePresence>
                {validationError && (
                  <motion.div
                    key="validation-error"
                    layout={!reduceMotion}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : {
                            duration: 0.2,

                            ease: "easeOut",
                          }
                    }
                    className={css`
                      margin-top: 0.75rem;
                      color: #8d2323;
                      font-weight: 600;
                    `}
                  >
                    {validationError}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div variants={staggerChildVariants} transition={staggerTransition}>
                <div className={wizardNavStyles}>
                  <Button variant="secondary" size="medium" onClick={() => goToStep(1, -1)}>
                    {t("back")}
                  </Button>
                  <Button
                    variant="primary"
                    size="medium"
                    disabled={
                      draftStages.length !== 5 ||
                      validationError !== null ||
                      saveMutation.isPending ||
                      finalizeMutation.isPending
                    }
                    onClick={() => saveMutation.mutate()}
                  >
                    {t("course-plans-save-schedule")}
                  </Button>
                  <Button
                    variant="secondary"
                    size="medium"
                    disabled={
                      draftStages.length !== 5 ||
                      validationError !== null ||
                      finalizeMutation.isPending ||
                      saveMutation.isPending
                    }
                    onClick={handleFinalizeSchedule}
                  >
                    {t("course-plans-finalize-schedule")}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
      {/* eslint-enable i18next/no-literal-string */}
    </div>
  )
}

export default withErrorBoundary(withSignedIn(CoursePlanSchedulePage))
