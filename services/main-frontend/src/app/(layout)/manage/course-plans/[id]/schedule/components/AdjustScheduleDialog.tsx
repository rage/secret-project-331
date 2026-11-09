"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import { addMonths, format, parseISO } from "date-fns"
import type { TFunction } from "i18next"
import { useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  adjustCourseDesignerScheduleMutation,
  getCourseDesignerPlanQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import type {
  CourseDesignerScheduleStageInput,
  CourseDesignerStage,
} from "@/generated/api/types.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { baseTheme } from "@/shared-module/common/styles"
import { Badge, Button, DateField, Dialog, Select, TONE } from "@/shared-module/components"

import { formatPlanDate } from "../../../coursePlanDates"
import { useAdjustScheduleDialogState } from "../../workspace/hooks/useAdjustScheduleDialogState"
import {
  type AdjustableStage,
  canEditStageEnd,
  canEditStageStart,
  findScheduleAdjustmentIssue,
  isIsoDate,
  moveStageEnd,
  type ScheduleAdjustmentIssue,
} from "../scheduleAdjustment"

const contentStyles = css`
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
`

const sectionStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.9rem;

  & + & {
    padding-top: 1.5rem;
    border-top: 1px solid ${baseTheme.colors.gray[100]};
  }
`

const sectionHeadingStyles = css`
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[700]};
`

const descriptionStyles = css`
  margin: 0;
  font-size: 0.95rem;
  color: ${baseTheme.colors.gray[600]};
  line-height: 1.5;
`

const previewStyles = css`
  margin: 0;
  padding: 0.75rem 1rem;
  background: ${baseTheme.colors.gray[50]};
  border: 1px solid ${baseTheme.colors.gray[100]};
  border-radius: 8px;
  font-size: 0.9rem;
  color: ${baseTheme.colors.gray[600]};
  line-height: 1.5;
`

const stageListStyles = css`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`

const stageRowStyles = css`
  display: grid;
  grid-template-columns: minmax(8rem, 1fr) minmax(0, 1.4fr) minmax(0, 1.4fr);
  gap: 0.75rem;
  align-items: start;

  @media (max-width: 40rem) {
    grid-template-columns: minmax(0, 1fr);
  }
`

const stageNameStyles = css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3rem;
  padding-top: 0.4rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[700]};
`

const lockedDateStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.9rem;
  color: ${baseTheme.colors.gray[600]};
`

const lockedDateLabelStyles = css`
  font-size: 0.8rem;
  color: ${baseTheme.colors.gray[500]};
`

const actionRowStyles = css`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
`

interface ScheduleDatesFormValues {
  stages: Pick<CourseDesignerScheduleStageInput, "planned_starts_on" | "planned_ends_on">[]
}

const END_FIELD_PATTERN = /^stages\.(\d+)\.planned_ends_on$/
const FIRST_START_FIELD = "stages.0.planned_starts_on"

export interface AdjustScheduleDialogProps {
  open: boolean
  onClose: () => void
  planId: string
  /** Every stage of the plan in schedule order. */
  stages: AdjustableStage[]
  activeStage: CourseDesignerStage | null
  stageLabel: (stage: CourseDesignerStage) => string
  /** Extends the active stage by whole months (1–24) through the extend endpoint. */
  onExtendActiveStage: (months: number) => void
  isExtendPending: boolean
}

/**
 * Lets members of an in-progress plan extend the active stage by months, or change the dates of
 * stages that are not completed. Saved dates replace the schedule and refresh the plan query.
 */
export default function AdjustScheduleDialog({
  open,
  onClose,
  planId,
  stages,
  activeStage,
  stageLabel,
  onExtendActiveStage,
  isExtendPending,
}: AdjustScheduleDialogProps) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const {
    control: extendControl,
    extendMonths,
    extendMonthsOptions,
    resetExtendMonths,
  } = useAdjustScheduleDialogState(1)

  const { control, reset, setValue, watch } = useForm<ScheduleDatesFormValues>({
    defaultValues: { stages: stages.map((stage) => toDateFields(stage)) },
  })
  const [draft, setDraft] = useState<CourseDesignerScheduleStageInput[]>(() => toInputs(stages))
  const draftRef = useRef(draft)

  useEffect(() => {
    if (!open) {
      return
    }
    reset({ stages: stages.map((stage) => toDateFields(stage)) })
    const initialDraft = toInputs(stages)
    draftRef.current = initialDraft
    setDraft(initialDraft)
    resetExtendMonths()
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open])

  useEffect(() => {
    const subscription = watch((values, { name }) => {
      if (name === undefined) {
        return
      }
      const current = draftRef.current
      let next = current
      const endMatch = END_FIELD_PATTERN.exec(name)
      if (endMatch) {
        const stageIndex = Number(endMatch[1])
        const value = values.stages?.[stageIndex]?.planned_ends_on ?? ""
        if (value === current[stageIndex]?.planned_ends_on) {
          return
        }
        next = isIsoDate(value)
          ? moveStageEnd(current, stageIndex, value)
          : current.map((stage, index) =>
              index === stageIndex ? { ...stage, planned_ends_on: value } : stage,
            )
      } else if (name === FIRST_START_FIELD) {
        const value = values.stages?.[0]?.planned_starts_on ?? ""
        if (value === current[0]?.planned_starts_on) {
          return
        }
        next = current.map((stage, index) =>
          index === 0 ? { ...stage, planned_starts_on: value } : stage,
        )
      } else {
        return
      }
      draftRef.current = next
      setDraft(next)
      next.forEach((stage, index) => {
        const field = values.stages?.[index]
        if (field?.planned_starts_on !== stage.planned_starts_on) {
          setValue(`stages.${index}.planned_starts_on`, stage.planned_starts_on)
        }
        if (field?.planned_ends_on !== stage.planned_ends_on) {
          setValue(`stages.${index}.planned_ends_on`, stage.planned_ends_on)
        }
      })
    })
    return () => subscription.unsubscribe()
  }, [watch, setValue])

  const adjustMutation = useToastMutationOptions(
    adjustCourseDesignerScheduleMutation(),
    { notify: true, method: "PUT" },
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getCourseDesignerPlanQueryKey({ path: { plan_id: planId } }),
        })
        onClose()
      },
    },
  )

  const issue = findScheduleAdjustmentIssue(stages, draft)
  const hasChanges = draft.some(
    (stage, index) =>
      stage.planned_starts_on !== stages[index]?.planned_starts_on ||
      stage.planned_ends_on !== stages[index]?.planned_ends_on,
  )
  const isPending = adjustMutation.isPending || isExtendPending

  const activeStageData = stages.find((stage) => stage.stage === activeStage) ?? null
  const planEndsOn = stages.at(-1)?.planned_ends_on ?? null
  const draftPlanEndsOn = draft.at(-1)?.planned_ends_on ?? null

  const extendedActiveStageEnd = useMemo(
    () =>
      activeStageData
        ? format(addMonths(parseISO(activeStageData.planned_ends_on), extendMonths), "yyyy-MM-dd")
        : null,
    [activeStageData, extendMonths],
  )

  const issueMessage = (stage: CourseDesignerStage) =>
    issue !== null && issue.stage === stage ? describeIssue(issue, t) : undefined

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("course-plans-adjust-schedule-dialog-title")}
      size="wide"
      isDismissable={!isPending}
    >
      <div className={contentStyles}>
        {activeStage && activeStageData && extendedActiveStageEnd && (
          <section className={sectionStyles} aria-labelledby="adjust-schedule-extend-heading">
            <h3 id="adjust-schedule-extend-heading" className={sectionHeadingStyles}>
              {t("course-plans-adjust-schedule-extend-heading", {
                stage: stageLabel(activeStage),
              })}
            </h3>
            <p className={descriptionStyles}>
              {t("course-plans-adjust-schedule-extend-description")}
            </p>
            <Select
              id="course-plan-adjust-schedule-months"
              name="extendMonths"
              control={extendControl}
              label={t("course-plans-adjust-schedule-months-label")}
              options={extendMonthsOptions}
            />
            <p className={previewStyles}>
              {t("course-plans-adjust-schedule-extend-preview", {
                stage: stageLabel(activeStage),
                currentEnd: formatPlanDate(activeStageData.planned_ends_on, i18n.language),
                newEnd: formatPlanDate(extendedActiveStageEnd, i18n.language),
              })}
            </p>
            <div className={actionRowStyles}>
              <Button
                variant="secondary"
                size="medium"
                onClick={() => {
                  onExtendActiveStage(extendMonths)
                  onClose()
                }}
                disabled={isPending}
              >
                {t("course-plans-adjust-schedule-extend-button", { count: extendMonths })}
              </Button>
            </div>
          </section>
        )}

        <section className={sectionStyles} aria-labelledby="adjust-schedule-dates-heading">
          <h3 id="adjust-schedule-dates-heading" className={sectionHeadingStyles}>
            {t("course-plans-adjust-schedule-dates-heading")}
          </h3>
          <p className={descriptionStyles}>{t("course-plans-adjust-schedule-dates-description")}</p>
          <ol className={stageListStyles}>
            {stages.map((stage, index) => {
              const isCompleted = stage.status === "Completed"
              const draftStage = draft[index] ?? stage
              return (
                <li key={stage.stage} className={stageRowStyles}>
                  <span className={stageNameStyles}>
                    {stageLabel(stage.stage)}
                    {isCompleted && (
                      <Badge tone={TONE.NEUTRAL} size="compact">
                        {t("course-plans-adjust-schedule-locked")}
                      </Badge>
                    )}
                  </span>
                  {canEditStageStart(stages, index) ? (
                    <DateField
                      id={`adjust-schedule-${stage.stage}-start`}
                      name={`stages.${index}.planned_starts_on`}
                      control={control}
                      label={t("course-plans-adjust-schedule-starts-on")}
                      isDisabled={isPending}
                    />
                  ) : (
                    <LockedDate
                      label={t("course-plans-adjust-schedule-starts-on")}
                      value={formatPlanDate(draftStage.planned_starts_on, i18n.language)}
                    />
                  )}
                  {canEditStageEnd(stages, index) ? (
                    <DateField
                      id={`adjust-schedule-${stage.stage}-end`}
                      name={`stages.${index}.planned_ends_on`}
                      control={control}
                      label={t("course-plans-adjust-schedule-ends-on")}
                      errorMessage={issueMessage(stage.stage)}
                      isDisabled={isPending}
                    />
                  ) : (
                    <LockedDate
                      label={t("course-plans-adjust-schedule-ends-on")}
                      value={formatPlanDate(draftStage.planned_ends_on, i18n.language)}
                    />
                  )}
                </li>
              )
            })}
          </ol>
          {hasChanges && issue === null && planEndsOn && draftPlanEndsOn && (
            <p className={previewStyles} aria-live="polite">
              {t("course-plans-adjust-schedule-plan-end-preview", {
                currentEnd: formatPlanDate(planEndsOn, i18n.language),
                newEnd: formatPlanDate(draftPlanEndsOn, i18n.language),
              })}
            </p>
          )}
          <div className={actionRowStyles}>
            <Button variant="secondary" size="medium" onClick={onClose} disabled={isPending}>
              {t("button-text-cancel")}
            </Button>
            <Button
              variant="primary"
              size="medium"
              disabled={!hasChanges || issue !== null || isPending}
              isLoading={adjustMutation.isPending}
              onClick={() =>
                adjustMutation.mutate({
                  path: { plan_id: planId },
                  body: { stages: draft },
                })
              }
            >
              {t("course-plans-adjust-schedule-save-dates")}
            </Button>
          </div>
        </section>
      </div>
    </Dialog>
  )
}

function LockedDate({ label, value }: { label: string; value: string }) {
  return (
    <span className={lockedDateStyles}>
      <span className={lockedDateLabelStyles}>{label}</span>
      {value}
    </span>
  )
}

function toDateFields(stage: AdjustableStage) {
  return { planned_starts_on: stage.planned_starts_on, planned_ends_on: stage.planned_ends_on }
}

function toInputs(stages: AdjustableStage[]): CourseDesignerScheduleStageInput[] {
  return stages.map((stage) => ({
    stage: stage.stage,
    planned_starts_on: stage.planned_starts_on,
    planned_ends_on: stage.planned_ends_on,
  }))
}

function describeIssue(issue: ScheduleAdjustmentIssue, t: TFunction): string {
  switch (issue.code) {
    case "invalid_date":
      return t("course-plans-adjust-schedule-error-invalid-date")
    case "ends_before_start":
      return t("course-plans-adjust-schedule-error-ends-before-start")
    case "completed_stage_changed":
      return t("course-plans-adjust-schedule-error-completed-stage")
  }
}
