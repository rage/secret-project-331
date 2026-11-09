"use client"

import { css, cx } from "@emotion/css"
import { CheckCircle } from "@vectopus/atlas-icons-react"
import { useParams } from "next/navigation"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import type {
  CourseDesignerPlanStageStatus,
  CourseDesignerStage,
} from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { Button, Dialog, Meter, METER_KIND, TONE } from "@/shared-module/components"

import AdjustScheduleDialog from "../../schedule/components/AdjustScheduleDialog"
import { SCHEDULE_STAGE_ORDER } from "../../schedule/scheduleConstants"
import { useConfirmStageCompletion } from "../hooks/useConfirmStageCompletion"
import PlanArchiveButton from "./PlanArchiveButton"

const NODE_COLUMN_WIDTH = 28
const SPINE_OFFSET = 13

const overviewContentWrapperStyles = css`
  width: 100%;
  padding: 0.2rem 0.3rem 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;

  @media (max-width: 640px) {
    padding: 0.1rem 0 0.25rem;
  }
`

const summaryCardStyles = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1.25rem 2rem;
  align-items: center;
  padding: 1.1rem 1.25rem;
  background: ${baseTheme.colors.green[25]};
  border: 1px solid ${baseTheme.colors.green[100]};
  border-radius: 10px;
  box-shadow: 0 1px 0 ${baseTheme.colors.green[100]};

  @media (max-width: 540px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
  }
`

const summaryCardNeutralStyles = css`
  background: ${baseTheme.colors.gray[50]};
  border: 1px solid ${baseTheme.colors.gray[100]};
  box-shadow: none;
`

const summaryEyebrowStyles = css`
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${baseTheme.colors.gray[500]};
  margin: 0 0 0.35rem 0;
`

const summaryPhaseNameStyles = css`
  font-size: 1.4rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[700]};
  margin: 0;
  line-height: 1.2;
`

const summaryStatusLineStyles = css`
  font-size: 0.9rem;
  color: ${baseTheme.colors.gray[500]};
  margin: 0.45rem 0 0 0;
`

const summaryNoActiveTextStyles = css`
  font-size: 0.95rem;
  color: ${baseTheme.colors.gray[600]};
  margin: 0;
  line-height: 1.45;
`

const summaryProgressBlockStyles = css`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.4rem;
  min-width: 12rem;

  @media (max-width: 540px) {
    align-items: stretch;
    min-width: 0;
  }
`

const timelineSectionStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`

const timelineListStyles = css`
  position: relative;
  list-style: none;
  margin: 0;
  padding: 0.25rem 0;

  &::before {
    content: "";
    position: absolute;
    left: ${SPINE_OFFSET}px;
    top: 1.4rem;
    bottom: 1.4rem;
    width: 2px;
    background: ${baseTheme.colors.gray[100]};
  }
`

const timelineRowStyles = css`
  position: relative;
  display: grid;
  grid-template-columns: ${NODE_COLUMN_WIDTH}px minmax(0, 1fr);
  column-gap: 0.85rem;
  align-items: start;
  padding: 0.6rem 0.85rem 0.6rem 0;
  border-radius: 8px;
`

const timelineRowCurrentStyles = css`
  background: ${baseTheme.colors.green[25]};
  border: 1px solid ${baseTheme.colors.green[100]};
  padding-left: 0.35rem;
  padding-right: 0.8rem;
`

const timelineNodeColumnStyles = css`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 1.5rem;
`

const timelineNodeCurrentStyles = css`
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: ${baseTheme.colors.green[600]};
  box-shadow:
    0 0 0 3px ${baseTheme.colors.green[100]},
    0 0 0 5px ${baseTheme.colors.green[25]};
`

const timelineNodePlannedStyles = css`
  width: 10px;
  height: 10px;
  border-radius: 999px;
  border: 2px solid ${baseTheme.colors.gray[200]};
  background: ${baseTheme.colors.primary[100]};
`

const timelineNodeCompletedStyles = css`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${baseTheme.colors.green[600]};
  background: ${baseTheme.colors.primary[100]};
  border-radius: 999px;
`

const timelineRowContentStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
`

const timelineRowHeaderStyles = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
`

const timelineStageNameStyles = css`
  font-weight: 500;
  color: ${baseTheme.colors.gray[600]};
  font-size: 0.95rem;
`

const timelineStageNameCurrentStyles = css`
  font-weight: 600;
  color: ${baseTheme.colors.gray[700]};
  font-size: 1rem;
`

const timelineStageDateStyles = css`
  font-size: 0.8rem;
  color: ${baseTheme.colors.gray[400]};
`

const timelineStageDateCurrentStyles = css`
  color: ${baseTheme.colors.gray[500]};
`

const statusPillBaseStyles = css`
  flex-shrink: 0;
  border-radius: 999px;
  padding: 0.15rem 0.55rem;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
`

const statusPillInProgressStyles = css`
  background: ${baseTheme.colors.green[100]};
  color: ${baseTheme.colors.green[700]};
`

const statusPillCompletedStyles = css`
  background: ${baseTheme.colors.gray[75]};
  color: ${baseTheme.colors.gray[500]};
`

const statusPillPlannedStyles = css`
  background: ${baseTheme.colors.clear[100]};
  color: ${baseTheme.colors.gray[500]};
`

const actionBarStyles = css`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid ${baseTheme.colors.gray[100]};
  flex-wrap: wrap;
`

const actionBarHelperTextStyles = css`
  font-size: 0.85rem;
  color: ${baseTheme.colors.gray[500]};
  margin: 0;
  flex: 1;
  min-width: 0;
`

const actionBarPrimaryGroupStyles = css`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-left: auto;
`

export interface OverviewStage {
  id: string
  planned_starts_on: string
  planned_ends_on: string
  status: CourseDesignerPlanStageStatus
  stage: CourseDesignerStage
}

export interface PlanOverviewPanelProps {
  isOpen: boolean
  onClose: () => void
  planName: string
  stages: OverviewStage[]
  activeStage: CourseDesignerStage | null
  stageLabel: (stage: CourseDesignerStage) => string
  canActOnCurrentStage: boolean
  onExtendCurrentStage: (months: number) => void
  onAdvanceStage: () => void
  isExtendPending: boolean
  isAdvancePending: boolean
  timeRemainingText: string | null
  timeRemainingShort?: string | null
  currentPhaseEndDateFormatted?: string | null
  activeStageTaskCompleted?: number
  activeStageTaskTotal?: number
  nextStageLabel?: string | null
}

const PlanOverviewPanel: React.FC<PlanOverviewPanelProps> = ({
  isOpen,
  onClose,
  planName,
  stages,
  activeStage,
  stageLabel,
  canActOnCurrentStage,
  onExtendCurrentStage,
  onAdvanceStage,
  isExtendPending,
  isAdvancePending,
  timeRemainingText,
  timeRemainingShort = null,
  currentPhaseEndDateFormatted = null,
  activeStageTaskCompleted = 0,
  activeStageTaskTotal = 0,
  nextStageLabel = null,
}) => {
  const { t, i18n } = useTranslation()
  const { id: planId } = useParams<{ id: string }>()
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false)
  const confirmStageCompletion = useConfirmStageCompletion()

  const formatMonthYear = (isoDate: string): string =>
    new Date(isoDate).toLocaleDateString(i18n.language, {
      // oxlint-disable-next-line i18next/no-literal-string -- Intl date format keys
      month: "long",
      // oxlint-disable-next-line i18next/no-literal-string -- Intl date format keys
      year: "numeric",
    })

  const activeStageData =
    activeStage !== null ? (stages.find((stage) => stage.stage === activeStage) ?? null) : null

  const canAdjustSchedule = activeStage !== null && activeStageData !== null

  const showTaskProgressInSummary = activeStage !== null && activeStageTaskTotal > 0

  if (!isOpen) {
    return null
  }

  const statusLine =
    activeStage && (timeRemainingShort ?? timeRemainingText)
      ? currentPhaseEndDateFormatted
        ? t("course-plans-overview-ends-date-remaining", {
            date: currentPhaseEndDateFormatted,
            time: timeRemainingShort ?? timeRemainingText,
          })
        : t("course-plans-overview-current-phase-status", {
            time: timeRemainingShort ?? timeRemainingText,
          })
      : null

  const handleAdvanceStage = async () => {
    if (!activeStageData) {
      return
    }
    if (await confirmStageCompletion(activeStageData, stageLabel, nextStageLabel)) {
      onAdvanceStage()
    }
  }

  const renderStatusPill = (status: string) => {
    const pillVariantClass =
      status === "InProgress"
        ? statusPillInProgressStyles
        : status === "Completed"
          ? statusPillCompletedStyles
          : statusPillPlannedStyles

    return (
      <span className={cx(statusPillBaseStyles, pillVariantClass)}>
        {t(
          status === "InProgress"
            ? "course-plans-status-in-progress"
            : status === "Completed"
              ? "course-plans-status-completed"
              : "course-plans-status-planned",
        )}
      </span>
    )
  }

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={t("course-plans-overview-title", { plan: planName })}
      size="wide"
      isDismissable
    >
      <div className={overviewContentWrapperStyles}>
        <section
          className={cx(summaryCardStyles, !activeStage && summaryCardNeutralStyles)}
          aria-labelledby="course-plan-overview-summary-eyebrow"
        >
          <div>
            <p id="course-plan-overview-summary-eyebrow" className={summaryEyebrowStyles}>
              {t("course-plans-overview-current-phase-label")}
            </p>
            {activeStage ? (
              <>
                <p className={summaryPhaseNameStyles}>{stageLabel(activeStage)}</p>
                {statusLine && <p className={summaryStatusLineStyles}>{statusLine}</p>}
              </>
            ) : (
              <p className={summaryNoActiveTextStyles}>
                {t("course-plans-overview-subtitle-no-active")}
              </p>
            )}
          </div>

          {showTaskProgressInSummary && (
            <div className={summaryProgressBlockStyles}>
              <Meter
                kind={METER_KIND.PROGRESS}
                tone={TONE.SUCCESS}
                label={t("course-plans-overview-course-progress")}
                value={activeStageTaskCompleted}
                maxValue={activeStageTaskTotal}
                valueLabel={t("course-plans-overview-phase-tasks-progress", {
                  completed: activeStageTaskCompleted,
                  total: activeStageTaskTotal,
                })}
              />
            </div>
          )}
        </section>

        <section className={timelineSectionStyles} aria-label={planName}>
          <ol className={timelineListStyles}>
            {SCHEDULE_STAGE_ORDER.map((stageEnum) => {
              const stageData = stages.find((s) => s.stage === stageEnum)
              if (!stageData) {
                return null
              }
              const isCurrent = activeStage === stageEnum
              const isCompleted = stageData.status === "Completed"

              return (
                <li
                  key={stageData.id}
                  className={cx(timelineRowStyles, isCurrent && timelineRowCurrentStyles)}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  <span className={timelineNodeColumnStyles} aria-hidden="true">
                    {isCompleted ? (
                      <span className={timelineNodeCompletedStyles}>
                        <CheckCircle size={16} />
                      </span>
                    ) : isCurrent ? (
                      <span className={timelineNodeCurrentStyles} />
                    ) : (
                      <span className={timelineNodePlannedStyles} />
                    )}
                  </span>
                  <div className={timelineRowContentStyles}>
                    <div className={timelineRowHeaderStyles}>
                      <span
                        className={
                          isCurrent ? timelineStageNameCurrentStyles : timelineStageNameStyles
                        }
                      >
                        {stageLabel(stageEnum)}
                      </span>
                      {renderStatusPill(stageData.status)}
                    </div>
                    <span
                      className={cx(
                        timelineStageDateStyles,
                        isCurrent && timelineStageDateCurrentStyles,
                      )}
                    >
                      {t("course-plans-overview-stage-dates", {
                        startsOn: formatMonthYear(stageData.planned_starts_on),
                        endsOn: formatMonthYear(stageData.planned_ends_on),
                      })}
                    </span>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        <div className={actionBarStyles}>
          {planId && <PlanArchiveButton planId={planId} />}
          <div className={actionBarPrimaryGroupStyles}>
            {canActOnCurrentStage ? (
              <>
                {canAdjustSchedule && (
                  <Button
                    variant="secondary"
                    size="medium"
                    onClick={() => setIsAdjustDialogOpen(true)}
                    disabled={isExtendPending || isAdvancePending}
                  >
                    {t("course-plans-overview-adjust-schedule")}
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="medium"
                  onClick={() => void handleAdvanceStage()}
                  disabled={isAdvancePending}
                >
                  {nextStageLabel
                    ? t("course-plans-overview-complete-phase-move-to", {
                        stage: nextStageLabel,
                      })
                    : t("course-plans-overview-complete-final-phase")}
                </Button>
              </>
            ) : (
              <p className={actionBarHelperTextStyles}>{t("course-plans-overview-no-actions")}</p>
            )}
          </div>
        </div>
      </div>

      {canAdjustSchedule && planId && (
        <AdjustScheduleDialog
          open={isAdjustDialogOpen}
          onClose={() => setIsAdjustDialogOpen(false)}
          planId={planId}
          stages={stages}
          activeStage={activeStage}
          stageLabel={stageLabel}
          onExtendActiveStage={onExtendCurrentStage}
          isExtendPending={isExtendPending}
        />
      )}
    </Dialog>
  )
}

export default PlanOverviewPanel
