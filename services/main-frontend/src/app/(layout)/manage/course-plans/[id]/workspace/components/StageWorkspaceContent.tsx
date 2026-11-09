"use client"

import type {
  CourseDesignerPlan,
  CourseDesignerPlanStageWithTasks,
  CourseDesignerStage,
} from "@/generated/api/types.generated"

import { parseAnalysisWorkspaceFromApi } from "./analysis-form/analysisFormDomain"
import AnalysisWorkspaceForm from "./AnalysisWorkspaceForm"
import DesignWorkspaceForm from "./design-form/DesignWorkspaceForm"
import StageGuidance from "./stage-guidance/StageGuidance"

/** The workspace body of one stage: its form, or guidance for stages without a form. */
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
          planName={plan.name}
          createdCourseId={plan.created_course_id}
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
    case "Implementation":
    case "Evaluation":
      return <StageGuidance stage={stage} />
  }
}
