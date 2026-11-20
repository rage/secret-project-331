"use client"

import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { CourseDesignerStageWorkspace } from "@/generated/api/types.generated"

import {
  ANALYSIS_WORKSPACE_SCHEMA_V1,
  type AnalysisWorkspaceFormValues,
  buildCreditsFieldRules,
  parseAnalysisWorkspaceFromApi,
  STAGE_ANALYSIS,
  stripOpenPeriodAll,
  withDerivedOpenPeriodAll,
} from "../components/analysis-form/analysisFormDomain"
import useStageWorkspaceForm from "./useStageWorkspaceForm"

function toAnalysisFormValues(workspaceData: unknown): AnalysisWorkspaceFormValues {
  return stripOpenPeriodAll(parseAnalysisWorkspaceFromApi(workspaceData))
}

function toAnalysisWorkspace(values: AnalysisWorkspaceFormValues): CourseDesignerStageWorkspace {
  return { schema: ANALYSIS_WORKSPACE_SCHEMA_V1, payload: withDerivedOpenPeriodAll(values) }
}

/** Form state and autosave for the Analysis form. */
export default function useAnalysisWorkspaceFormController(props: {
  onDirtyChange?: (dirty: boolean) => void
  planId: string
  workspaceData: unknown
  workspaceRevision: number
  isReadOnly: boolean
}) {
  const { onDirtyChange, planId, workspaceData, workspaceRevision, isReadOnly } = props
  const { t } = useTranslation()
  const { form, saveStatus, saveNow, loadLatest } = useStageWorkspaceForm({
    planId,
    stage: STAGE_ANALYSIS,
    workspaceData,
    workspaceRevision,
    isReadOnly,
    toFormValues: toAnalysisFormValues,
    toWorkspace: toAnalysisWorkspace,
    ...(onDirtyChange ? { onDirtyChange } : {}),
  })
  const creditsFieldRules = useMemo(() => buildCreditsFieldRules(t), [t])

  const uhLines = t("course-plans-analysis-resources-uh-body")
    .split("\n")
    .filter((line) => line.trim() !== "")

  const showUhResources = process.env.NEXT_PUBLIC_SHOW_UH_ANALYSIS_RESOURCES !== "false"

  return {
    control: form.control,
    setValue: form.setValue,
    saveStatus,
    saveNow,
    loadLatest,
    creditsFieldRules,
    uhLines,
    showUhResources,
  }
}
