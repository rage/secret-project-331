"use client"

import { useTranslation } from "react-i18next"

import type {
  CourseDesignerPlan,
  CourseDesignerPlanStageWithTasks,
  CourseDesignerStage,
} from "@/generated/api/types.generated"

import { parseAnalysisWorkspaceFromApi } from "./analysis-form/analysisFormDomain"
import AnalysisWorkspaceForm from "./AnalysisWorkspaceForm"
import CreateCourseOffer from "./CreateCourseOffer"
import DesignWorkspaceForm from "./design-form/DesignWorkspaceForm"
import StageGuidance, { type FormlessStage } from "./stage-guidance/StageGuidance"

/**
 * The workspace body of one stage: its form, or guidance for stages without a form. Development
 * offers to create the plan's course until it exists.
 */
export default function StageWorkspaceContent(props: {
  plan: CourseDesignerPlan
  stage: CourseDesignerStage
  stages: readonly CourseDesignerPlanStageWithTasks[]
  onDirtyChange: (dirty: boolean) => void
}) {
  const { plan, stage, stages, onDirtyChange } = props
  const stageData = stages.find((candidate) => candidate.stage === stage)
  const workspaceData = stageData?.workspace_data
  const workspaceRevision = stageData?.workspace_revision ?? 0
  const hasCourse = Boolean(plan.created_course_id)
  const isReadOnly = plan.status === "Archived"
  switch (stage) {
    case "Analysis":
      return (
        <AnalysisWorkspaceForm
          planId={plan.id}
          workspaceData={workspaceData}
          workspaceRevision={workspaceRevision}
          isReadOnly={isReadOnly}
          onDirtyChange={onDirtyChange}
        />
      )
    case "Design":
      return (
        <DesignWorkspaceForm
          planId={plan.id}
          workspaceData={workspaceData}
          workspaceRevision={workspaceRevision}
          isReadOnly={isReadOnly}
          analysis={parseAnalysisWorkspaceFromApi(
            stages.find((candidate) => candidate.stage === "Analysis")?.workspace_data,
          )}
          onDirtyChange={onDirtyChange}
        />
      )
    case "Development":
      return (
        <StageGuidance stage={stage}>
          {hasCourse ? null : (
            <CreateCourseOffer
              planId={plan.id}
              planName={plan.name}
              analysis={parseAnalysisWorkspaceFromApi(
                stages.find((candidate) => candidate.stage === "Analysis")?.workspace_data,
              )}
              isDesignCompleted={
                stages.find((candidate) => candidate.stage === "Design")?.status === "Completed"
              }
              isReadOnly={isReadOnly}
            />
          )}
        </StageGuidance>
      )
    case "Implementation":
    case "Evaluation":
      return <CourseRequiredGuidance stage={stage} hasCourse={hasCourse} />
  }
}

function CourseRequiredGuidance(props: { stage: FormlessStage; hasCourse: boolean }) {
  const { t } = useTranslation()
  return (
    <StageGuidance stage={props.stage}>
      {props.hasCourse ? null : <p>{t("course-plans-stage-needs-course")}</p>}
    </StageGuidance>
  )
}
