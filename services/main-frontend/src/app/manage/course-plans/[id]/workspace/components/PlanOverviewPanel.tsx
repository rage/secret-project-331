"use client"

import { css } from "@emotion/css"
import { CheckCircle } from "@vectopus/atlas-icons-react"
import { useTranslation } from "react-i18next"

import { SCHEDULE_STAGE_ORDER } from "../../schedule/scheduleConstants"

import { type CourseDesignerStage } from "@/services/backend/courseDesigner"
import Button from "@/shared-module/common/components/Button"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import { baseTheme } from "@/shared-module/common/styles"

const NODE_COLUMN_WIDTH = 28
const SPINE_OFFSET = 13
const CONTENT_OFFSET = NODE_COLUMN_WIDTH + 12

const overviewContentWrapperStyles = css`
  max-width: 67rem;
  margin: 0 auto;
  width: 100%;
`

const overviewContentStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`

const heroBlockStyles = css`
  padding: 0.5rem 0 0.4rem 0;
  border-bottom: 1px solid ${baseTheme.colors.gray[100]};
`

const heroSublabelStyles = css`
  font-size: 0.75rem;
  font-weight: 500;
  color: ${baseTheme.colors.gray[500]};
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin: 0 0 0.2rem 0;
`

const heroPhaseNameStyles = css`
  font-size: 1.1rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[900]};
  margin: 0 0 0.25rem 0;
`

const heroStatusLineStyles = css`
  font-size: 0.9rem;
  color: ${baseTheme.colors.gray[600]};
  margin: 0;
`

const noActiveHeroStyles = css`
  font-size: 0.9rem;
  color: ${baseTheme.colors.gray[500]};
  margin: 0;
`

const overviewStageListStyles = css`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-bottom: 0.75rem;
  padding: 20px 0;
  &::before {
    content: "";
    position: absolute;
    left: ${SPINE_OFFSET}px;
    top: 20px;
    bottom: 20px;
    width: 2px;
    background: #e5e7eb;
  }
`

const overviewStageRowStyles = css`
  position: relative;
  display: flex;
  align-items: flex-start;
  font-size: 0.9rem;
  color: ${baseTheme.colors.gray[600]};
  padding: 0.4rem 0 0.4rem ${CONTENT_OFFSET}px;
  min-height: 2.5rem;
`

const overviewStageRowCurrentStyles = css`
  background: ${baseTheme.colors.green[50]};
  color: ${baseTheme.colors.gray[800]};
  margin-left: -${CONTENT_OFFSET}px;
  padding-left: ${CONTENT_OFFSET}px;
  padding-top: 0.6rem;
  padding-bottom: 0.6rem;
  border-radius: 6px;
  min-height: 2.75rem;
`

const overviewNodeColumnStyles = css`
  position: absolute;
  left: 0;
  width: ${NODE_COLUMN_WIDTH}px;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`

const overviewNodeCurrentStyles = css`
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: ${baseTheme.colors.green[600]};
  box-shadow: 0 0 0 2px ${baseTheme.colors.green[100]};
  flex-shrink: 0;
`

const overviewNodePlannedStyles = css`
  width: 9px;
  height: 9px;
  border-radius: 999px;
  border: 2px solid ${baseTheme.colors.gray[300]};
  background: transparent;
  flex-shrink: 0;
`

const overviewNodeCompletedStyles = css`
  color: ${baseTheme.colors.gray[500]};
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`

const overviewStageContentStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  flex: 1;
  min-width: 0;
`

const overviewStageNameStyles = css`
  font-weight: 500;
`

const overviewStageNameCurrentStyles = css`
  font-weight: 600;
  color: ${baseTheme.colors.gray[900]};
`

const overviewStageMetaStackStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
`

const overviewStageDateStyles = css`
  font-size: 0.78rem;
  color: ${baseTheme.colors.gray[500]};
`

const overviewStageTaskProgressStyles = css`
  font-size: 0.75rem;
  color: ${baseTheme.colors.gray[500]};
  margin-top: 0.15rem;
`

const overviewStatusPillStyles = css`
  align-self: flex-start;
  border-radius: 999px;
  padding: 0.15rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: uppercase;
`

const overviewStatusInProgressStyles = css`
  background: ${baseTheme.colors.green[25]};
  color: ${baseTheme.colors.green[700]};
`

const overviewStatusCompletedStyles = css`
  background: ${baseTheme.colors.gray[100]};
  color: ${baseTheme.colors.gray[700]};
`

const overviewStatusPlannedStyles = css`
  background: ${baseTheme.colors.clear[100]};
  color: ${baseTheme.colors.gray[600]};
`

const overviewActionsStyles = css`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.6rem;
  margin-top: 0;
  padding-top: 0.5rem;
`

const overviewActionsPrimaryStyles = css`
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
`

const overviewActionsSecondaryStyles = css`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`

const textLinkStyles = css`
  font-size: 0.8rem;
  padding: 0.2rem 0.4rem;
  min-height: 0;
  text-transform: none;
  letter-spacing: 0;
  color: ${baseTheme.colors.gray[500]};
  background: transparent;
  border: none;
  font-weight: 400;

  :hover:not(:disabled) {
    color: ${baseTheme.colors.green[700]};
    background: transparent;
    text-decoration: underline;
  }
`

export interface OverviewStage {
  id: string
  planned_starts_on: string
  planned_ends_on: string
  status: string
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
  onExtendCurrentStage: () => void
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

  const formatMonthYear = (isoDate: string): string =>
    new Date(isoDate).toLocaleDateString(i18n.language, {
      // eslint-disable-next-line i18next/no-literal-string -- Intl date format keys
      month: "long",
      // eslint-disable-next-line i18next/no-literal-string -- Intl date format keys
      year: "numeric",
    })

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

  return (
    <StandardDialog
      open={isOpen}
      onClose={onClose}
      title={t("course-plans-overview-title", { plan: planName })}
      width="wide"
      leftAlignTitle
      isDismissable
    >
      <div className={overviewContentWrapperStyles}>
        <div className={overviewContentStyles}>
          <div className={heroBlockStyles}>
            {activeStage ? (
              <>
                <p className={heroSublabelStyles}>
                  {t("course-plans-overview-current-phase-label")}
                </p>
                <h2 className={heroPhaseNameStyles}>{stageLabel(activeStage)}</h2>
                {statusLine && <p className={heroStatusLineStyles}>{statusLine}</p>}
              </>
            ) : (
              <p className={noActiveHeroStyles}>{t("course-plans-overview-subtitle-no-active")}</p>
            )}
          </div>

          <div className={overviewStageListStyles}>
            {SCHEDULE_STAGE_ORDER.map((stageEnum) => {
              const stageData = stages.find((s) => s.stage === stageEnum)
              if (!stageData) {
                return null
              }
              const isCurrent = activeStage === stageEnum
              const isCompleted = stageData.status === "Completed"
              const showTaskProgress = isCurrent && activeStageTaskTotal > 0

              return (
                <div
                  key={stageData.id}
                  className={`${overviewStageRowStyles} ${isCurrent ? overviewStageRowCurrentStyles : ""}`}
                >
                  <div className={overviewNodeColumnStyles} aria-hidden>
                    {isCompleted ? (
                      <span className={overviewNodeCompletedStyles}>
                        <CheckCircle size={12} />
                      </span>
                    ) : isCurrent ? (
                      <span className={overviewNodeCurrentStyles} />
                    ) : (
                      <span className={overviewNodePlannedStyles} />
                    )}
                  </div>
                  <div className={overviewStageContentStyles}>
                    <span
                      className={`${overviewStageNameStyles} ${isCurrent ? overviewStageNameCurrentStyles : ""}`}
                    >
                      {stageLabel(stageEnum)}
                    </span>
                    <div className={overviewStageMetaStackStyles}>
                      <span className={overviewStageDateStyles}>
                        {t("course-plans-overview-stage-dates", {
                          startsOn: formatMonthYear(stageData.planned_starts_on),
                          endsOn: formatMonthYear(stageData.planned_ends_on),
                        })}
                      </span>
                      <span
                        className={`${overviewStatusPillStyles} ${
                          stageData.status === "InProgress"
                            ? overviewStatusInProgressStyles
                            : stageData.status === "Completed"
                              ? overviewStatusCompletedStyles
                              : overviewStatusPlannedStyles
                        }`}
                      >
                        {t(
                          stageData.status === "InProgress"
                            ? "course-plans-status-in-progress"
                            : stageData.status === "Completed"
                              ? "course-plans-status-completed"
                              : "course-plans-status-planned",
                        )}
                      </span>
                    </div>
                    {showTaskProgress && (
                      <p className={overviewStageTaskProgressStyles}>
                        {t("course-plans-overview-phase-tasks-progress", {
                          completed: activeStageTaskCompleted,
                          total: activeStageTaskTotal,
                        })}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className={overviewActionsStyles}>
            {canActOnCurrentStage ? (
              <>
                <div className={overviewActionsPrimaryStyles}>
                  <Button
                    variant="primary"
                    size="small"
                    onClick={onAdvanceStage}
                    disabled={isAdvancePending}
                  >
                    {nextStageLabel
                      ? t("course-plans-overview-complete-phase-move-to", {
                          stage: nextStageLabel,
                        })
                      : t("course-plans-mark-phase-done-proceed")}
                  </Button>
                </div>
                <div className={overviewActionsSecondaryStyles}>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={onExtendCurrentStage}
                    disabled={isExtendPending || isAdvancePending}
                  >
                    {t("course-plans-overview-adjust-timeline")}
                  </Button>
                  <Button
                    variant="tertiary"
                    size="small"
                    onClick={onAdvanceStage}
                    disabled={isAdvancePending}
                    className={textLinkStyles}
                  >
                    {t("course-plans-overview-start-next-phase-now")}
                  </Button>
                </div>
              </>
            ) : (
              <span>{t("course-plans-overview-no-actions")}</span>
            )}
          </div>
        </div>
      </div>
    </StandardDialog>
  )
}

export default PlanOverviewPanel
