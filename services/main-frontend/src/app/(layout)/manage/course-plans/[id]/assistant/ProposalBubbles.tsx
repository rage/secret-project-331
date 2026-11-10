"use client"

import { css, cx } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import type { TFunction } from "i18next"
import { useParams } from "next/navigation"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import type { ClientToolBubbleProps } from "@/components/course-material/chatbot/shared/clientToolRegistry"
import { getCourseDesignerPlanOptions } from "@/generated/api/@tanstack/react-query.generated"
import { baseTheme } from "@/shared-module/common/styles"

import { formatPlanShortDate } from "../../coursePlanDates"
import { stageFromName, stageLabel } from "../../coursePlanStages"
import { sectionKeyLabel } from "../workspace/components/section-status/sectionKeys"
import type {
  AddTaskCall,
  ScheduleAdjustmentCall,
  SectionStatusCall,
  StageDates,
  UpdateTaskCall,
  VisionEditCall,
  WorkspaceEditCall,
} from "./coursePlanProposalCalls"
import {
  PROPOSE_ADD_TASK_TOOL,
  PROPOSE_SCHEDULE_ADJUSTMENT_TOOL,
  PROPOSE_SECTION_STATUS_TOOL,
  PROPOSE_UPDATE_TASK_TOOL,
  PROPOSE_VISION_EDIT_TOOL,
  PROPOSE_WORKSPACE_EDIT_TOOL,
} from "./coursePlanProposalCalls"
import ProposalBubble from "./ProposalBubble"
import {
  labelKeyOf,
  SECTION_STATUS_LABEL_KEYS,
  TASK_FIELD_LABEL_KEYS,
  workspaceFieldLabel,
} from "./proposalLabels"
import { JsonValue, ProposedChange, TextValue } from "./ProposalValues"

const summaryStyle = css`
  margin: 0 0 0.75rem;
  font-style: italic;
`

const detailsStyle = css`
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 0.25rem 0.75rem;
  margin: 0;
`

const detailTermStyle = css`
  color: ${baseTheme.colors.gray[600]};
`

const detailValueStyle = css`
  margin: 0;
`

const tableStyle = css`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;

  th,
  td {
    padding: 0.25rem 0.5rem 0.25rem 0;
    text-align: start;
    vertical-align: top;
  }

  th {
    color: ${baseTheme.colors.gray[600]};
    font-weight: 500;
  }
`

const changedRowStyle = css`
  font-weight: 600;
  background: ${baseTheme.colors.green[100]};
`

const stageNameLabel = (name: string, t: TFunction) => {
  const stage = stageFromName(name)
  return stage ? stageLabel(stage, t) : name
}

const formatStageDates = (dates: StageDates | undefined, locale: string, t: TFunction) => {
  if (!dates) {
    return ""
  }
  return t("course-plans-overview-stage-dates", {
    startsOn: formatPlanShortDate(dates.starts_on, locale),
    endsOn: formatPlanShortDate(dates.ends_on, locale),
  })
}

/** Label/value rows for a proposal's fixed details. */
const Details: React.FC<{ rows: { label: string; value: React.ReactNode }[] }> = ({ rows }) => (
  <dl className={detailsStyle}>
    {rows.map(({ label, value }) => (
      <React.Fragment key={label}>
        <dt className={detailTermStyle}>{label}</dt>
        <dd className={detailValueStyle}>{value}</dd>
      </React.Fragment>
    ))}
  </dl>
)

const parseJsonValue = (json: string): unknown => {
  try {
    return JSON.parse(json)
  } catch {
    return json
  }
}

const designChaptersSchema = z.object({
  payload: z.object({ chapters: z.array(z.object({ id: z.string() })) }),
})

/** Chapter numbers by chapter id in the plan's saved Design form, for naming chapter fields. */
const useChapterNumberById = (): ReadonlyMap<string, number> => {
  const params = useParams<{ id: string }>()
  const planId = params.id ?? ""
  const planQuery = useQuery({
    ...getCourseDesignerPlanOptions({ path: { plan_id: planId } }),
    enabled: planId !== "",
  })
  return useMemo(() => {
    const design = planQuery.data?.stages.find((stage) => stage.stage === "Design")
    const parsed = designChaptersSchema.safeParse(design?.workspace_data)
    const chapters = parsed.success ? parsed.data.payload.chapters : []
    return new Map(chapters.map((chapter, index) => [chapter.id, index + 1]))
  }, [planQuery.data])
}

export const WorkspaceEditBubble: React.FC<ClientToolBubbleProps<WorkspaceEditCall>> = ({
  call,
  ...rest
}) => {
  const { t } = useTranslation()
  const chapterNumberById = useChapterNumberById()
  const rows = (
    <>
      <p className={summaryStyle}>{call.summary}</p>
      {call.changes.map((change) => (
        <ProposedChange
          key={change.field}
          label={workspaceFieldLabel(change.field, chapterNumberById, t)}
          current={<JsonValue value={parseJsonValue(change.current_value_json)} />}
          proposed={<JsonValue value={parseJsonValue(change.proposed_value_json)} />}
        />
      ))}
    </>
  )
  return (
    <ProposalBubble
      {...rest}
      call={call}
      toolName={PROPOSE_WORKSPACE_EDIT_TOOL}
      title={t("course-plans-assistant-workspace-edit-title", {
        stage: stageNameLabel(call.stage, t),
      })}
      rows={rows}
    />
  )
}

export const AddTaskBubble: React.FC<ClientToolBubbleProps<AddTaskCall>> = ({ call, ...rest }) => {
  const { t } = useTranslation()
  const rows = (
    <Details
      rows={[
        { label: t("course-plans-task-title-label"), value: <TextValue text={call.title} /> },
        {
          label: t("course-plans-task-description-label"),
          value: <TextValue text={call.description} />,
        },
        {
          label: t("course-plans-task-assignee-label"),
          value: call.assignee_name.trim() || t("course-plans-task-unassigned"),
        },
      ]}
    />
  )
  return (
    <ProposalBubble
      {...rest}
      call={call}
      toolName={PROPOSE_ADD_TASK_TOOL}
      title={t("course-plans-assistant-add-task-title", { stage: stageNameLabel(call.stage, t) })}
      rows={rows}
    />
  )
}

const TaskFieldValue: React.FC<{ field: string; value: string }> = ({ field, value }) => {
  const { t } = useTranslation()
  if (field === "is_completed") {
    return <span>{value.trim() === "true" ? t("yes") : t("no")}</span>
  }
  if (field === "assignee" && value.trim() === "") {
    return <span>{t("course-plans-task-unassigned")}</span>
  }
  return <TextValue text={value} />
}

export const UpdateTaskBubble: React.FC<ClientToolBubbleProps<UpdateTaskCall>> = ({
  call,
  ...rest
}) => {
  const { t } = useTranslation()
  const rows = call.changes.map((change) => {
    const labelKey = labelKeyOf(TASK_FIELD_LABEL_KEYS, change.field)
    return (
      <ProposedChange
        key={change.field}
        label={labelKey ? t(labelKey) : change.field}
        current={<TaskFieldValue field={change.field} value={change.current_value} />}
        proposed={<TaskFieldValue field={change.field} value={change.proposed_value} />}
      />
    )
  })
  return (
    <ProposalBubble
      {...rest}
      call={call}
      toolName={PROPOSE_UPDATE_TASK_TOOL}
      title={t("course-plans-assistant-update-task-title", { task: call.task_title })}
      rows={rows}
    />
  )
}

export const ScheduleAdjustmentBubble: React.FC<ClientToolBubbleProps<ScheduleAdjustmentCall>> = ({
  call,
  ...rest
}) => {
  const { t, i18n } = useTranslation()
  const rows = (
    <>
      <p className={summaryStyle}>{call.reason}</p>
      <table className={tableStyle}>
        <thead>
          <tr>
            <th scope="col">{t("course-plans-stage-column")}</th>
            <th scope="col">{t("course-plans-assistant-current")}</th>
            <th scope="col">{t("course-plans-assistant-proposed")}</th>
          </tr>
        </thead>
        <tbody>
          {call.proposed_schedule.map((proposed) => {
            const current = call.current_schedule.find((dates) => dates.stage === proposed.stage)
            const isChanged =
              current?.starts_on !== proposed.starts_on || current?.ends_on !== proposed.ends_on
            return (
              <tr key={proposed.stage} className={cx(isChanged && changedRowStyle)}>
                <th scope="row">{stageNameLabel(proposed.stage, t)}</th>
                <td>{formatStageDates(current, i18n.language, t)}</td>
                <td>{formatStageDates(proposed, i18n.language, t)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
  return (
    <ProposalBubble
      {...rest}
      call={call}
      toolName={PROPOSE_SCHEDULE_ADJUSTMENT_TOOL}
      title={t("course-plans-assistant-schedule-title")}
      rows={rows}
    />
  )
}

export const SectionStatusBubble: React.FC<ClientToolBubbleProps<SectionStatusCall>> = ({
  call,
  ...rest
}) => {
  const { t } = useTranslation()
  const statusLabel = (status: string) => {
    const labelKey = labelKeyOf(SECTION_STATUS_LABEL_KEYS, status.trim())
    return labelKey ? t(labelKey) : status
  }
  const rows = (
    <>
      <ProposedChange
        label={t("course-plans-assistant-section-status-mark")}
        current={statusLabel(call.current_status)}
        proposed={statusLabel(call.proposed_status)}
      />
      <ProposedChange
        label={t("course-plans-assistant-section-status-comment")}
        current={<TextValue text={call.current_comment} />}
        proposed={<TextValue text={call.proposed_comment} />}
      />
    </>
  )
  return (
    <ProposalBubble
      {...rest}
      call={call}
      toolName={PROPOSE_SECTION_STATUS_TOOL}
      title={t("course-plans-assistant-section-status-title", {
        section: sectionKeyLabel(call.section_key, t),
        stage: stageNameLabel(call.section_key.split(".")[0] ?? "", t),
      })}
      rows={rows}
    />
  )
}

export const VisionEditBubble: React.FC<ClientToolBubbleProps<VisionEditCall>> = ({
  call,
  ...rest
}) => {
  const { t } = useTranslation()
  const rows = (
    <ProposedChange
      label={t("course-plans-mooc-design-vision-label")}
      current={<TextValue text={call.current_vision} />}
      proposed={<TextValue text={call.proposed_vision} />}
    />
  )
  return (
    <ProposalBubble
      {...rest}
      call={call}
      toolName={PROPOSE_VISION_EDIT_TOOL}
      title={t("course-plans-assistant-vision-title")}
      rows={rows}
    />
  )
}
