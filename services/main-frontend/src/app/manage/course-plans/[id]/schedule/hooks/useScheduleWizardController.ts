"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAtomValue, useSetAtom } from "jotai"
import { useCallback, useEffect, useMemo, useState } from "react"

import type { ScheduleWizardStep } from "../scheduleAtoms"
import {
  addMonthToStageAtomFamily,
  draftStagesAtomFamily,
  removeMonthFromStageAtomFamily,
  scheduleWizardStepAtomFamily,
} from "../scheduleAtoms"
import type { ScheduleWizardStepId } from "../scheduleConstants"
import { SCHEDULE_STAGE_ORDER } from "../scheduleConstants"
import {
  buildStageCardViewModels,
  getStartsOnMonthFromStages,
  toDraftStages,
} from "../scheduleMappers"
import { validateScheduleStages } from "../scheduleValidation"

import {
  createCourseDesignerScheduleSuggestionMutation,
  finalizeCourseDesignerScheduleMutation,
  getCourseDesignerPlanOptions,
  getCourseDesignerPlanQueryKey,
  getCourseDesignerPlansQueryKey,
  saveCourseDesignerScheduleMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type { CourseDesignerCourseSize, CourseDesignerStage } from "@/generated/api/types.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"

const todayMonthValue = () => {
  const date = new Date()
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

function monthToStartsOnDate(month: string): string {
  return month ? `${month}-01` : ""
}

function atomStepToId(step: ScheduleWizardStep): ScheduleWizardStepId {
  switch (step) {
    case 0:
      return "name"
    case 1:
      return "setup"
    case 2:
      return "schedule"
  }
}

function stepIdToAtomStep(step: ScheduleWizardStepId): ScheduleWizardStep {
  switch (step) {
    case "name":
      return 0
    case "setup":
      return 1
    case "schedule":
      return 2
  }
}

function stepIndex(step: ScheduleWizardStepId): number {
  switch (step) {
    case "name":
      return 0
    case "setup":
      return 1
    case "schedule":
      return 2
  }
}

export default function useScheduleWizardController(planId: string) {
  const queryClient = useQueryClient()

  const planQuery = useQuery(
    getCourseDesignerPlanOptions({
      path: {
        plan_id: planId,
      },
    }),
  )

  const [planName, setPlanName] = useState("")

  const [courseSize, setCourseSize] = useState<CourseDesignerCourseSize>("medium")
  const [startsOnMonth, setStartsOnMonth] = useState(todayMonthValue())
  const [initializedFromQuery, setInitializedFromQuery] = useState<string | null>(null)

  const wizardStepAtom = useAtomValue(scheduleWizardStepAtomFamily(planId))
  const setWizardStepAtom = useSetAtom(scheduleWizardStepAtomFamily(planId))
  const [wizardDirection, setWizardDirection] = useState<1 | -1>(1)

  const draftStages = useAtomValue(draftStagesAtomFamily(planId))
  const setDraftStages = useSetAtom(draftStagesAtomFamily(planId))
  const addStageMonthByIndex = useSetAtom(addMonthToStageAtomFamily(planId))
  const removeStageMonthByIndex = useSetAtom(removeMonthFromStageAtomFamily(planId))

  const step = atomStepToId(wizardStepAtom)

  const goToStep = useCallback(
    (nextStep: ScheduleWizardStepId, direction?: 1 | -1) => {
      const nextAtomStep = stepIdToAtomStep(nextStep)
      const resolvedDirection =
        direction ??
        (stepIndex(nextStep) >= stepIndex(atomStepToId(wizardStepAtom))
          ? (1 as const)
          : (-1 as const))
      setWizardDirection(resolvedDirection)
      setWizardStepAtom(nextAtomStep)
    },
    [setWizardStepAtom, wizardStepAtom],
  )

  useEffect(() => {
    if (!planQuery.data || initializedFromQuery === planId) {
      return
    }

    setPlanName(planQuery.data.plan.name ?? "")

    if (planQuery.data.stages.length > 0) {
      setDraftStages(toDraftStages(planQuery.data.stages))
      const firstMonth = getStartsOnMonthFromStages(planQuery.data.stages)
      if (firstMonth) {
        setStartsOnMonth(firstMonth)
      }
      setWizardStepAtom(stepIdToAtomStep("schedule"))
      setWizardDirection(1)
    } else {
      setWizardStepAtom(stepIdToAtomStep("name"))
      setWizardDirection(1)
    }

    setInitializedFromQuery(planId)
  }, [initializedFromQuery, planId, planQuery.data, setDraftStages, setWizardStepAtom])

  const suggestionMutation = useToastMutationOptions(
    createCourseDesignerScheduleSuggestionMutation(),
    { notify: true, method: "POST" },
    {
      onSuccess: (result) => {
        setDraftStages(result.stages)
      },
    },
  )

  const saveMutation = useToastMutationOptions(
    saveCourseDesignerScheduleMutation(),
    { notify: true, method: "PUT" },
    {
      onSuccess: async (details) => {
        setDraftStages(toDraftStages(details.stages))
        await queryClient.invalidateQueries({
          queryKey: getCourseDesignerPlanQueryKey({ path: { plan_id: planId } }),
        })
        await queryClient.invalidateQueries({ queryKey: getCourseDesignerPlansQueryKey() })
      },
    },
  )

  const finalizeMutation = useToastMutationOptions(
    finalizeCourseDesignerScheduleMutation(),
    { notify: true, method: "POST" },
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getCourseDesignerPlanQueryKey({ path: { plan_id: planId } }),
        })
        await queryClient.invalidateQueries({ queryKey: getCourseDesignerPlansQueryKey() })
      },
    },
  )

  const validationIssue = useMemo(() => validateScheduleStages(draftStages), [draftStages])
  const stageCards = useMemo(() => buildStageCardViewModels(draftStages), [draftStages])

  const addMonth = useCallback(
    (stage: CourseDesignerStage) => {
      const index = SCHEDULE_STAGE_ORDER.indexOf(stage)
      if (index >= 0) {
        addStageMonthByIndex(index)
      }
    },
    [addStageMonthByIndex],
  )

  const removeMonth = useCallback(
    (stage: CourseDesignerStage) => {
      const index = SCHEDULE_STAGE_ORDER.indexOf(stage)
      if (index >= 0) {
        removeStageMonthByIndex(index)
      }
    },
    [removeStageMonthByIndex],
  )

  const generateSuggestion = useCallback(
    async (options?: { goToScheduleStep?: boolean }) => {
      try {
        await suggestionMutation.mutateAsync({
          body: {
            course_size: courseSize,
            starts_on: monthToStartsOnDate(startsOnMonth),
          },
          path: {
            plan_id: planId,
          },
        })
        if (options?.goToScheduleStep) {
          goToStep("schedule", 1)
        }
        return true
      } catch {
        return false
      }
    },
    [courseSize, goToStep, planId, startsOnMonth, suggestionMutation],
  )

  const saveDraft = useCallback(async () => {
    try {
      await saveMutation.mutateAsync({
        body: {
          name: planName.trim() === "" ? null : planName.trim(),
          stages: draftStages,
        },
        path: {
          plan_id: planId,
        },
      })
      return true
    } catch {
      return false
    }
  }, [draftStages, planId, planName, saveMutation])

  const finalizeDraft = useCallback(async () => {
    try {
      await saveMutation.mutateAsync({
        body: {
          name: planName.trim() === "" ? null : planName.trim(),
          stages: draftStages,
        },
        path: {
          plan_id: planId,
        },
      })
      await finalizeMutation.mutateAsync({
        path: {
          plan_id: planId,
        },
      })
      return true
    } catch {
      return false
    }
  }, [draftStages, finalizeMutation, planId, planName, saveMutation])

  return {
    planQuery,
    ui: {
      step,
      wizardDirection,
      planName,
      courseSize,
      startsOnMonth,
      draftStageCount: draftStages.length,
      stageCards,
      validationIssue,
    },
    status: {
      isGeneratingSuggestion: suggestionMutation.isPending,
      isSaving: saveMutation.isPending,
      isFinalizing: finalizeMutation.isPending,
    },
    actions: {
      setPlanName,
      setCourseSize,
      setStartsOnMonth,
      goToStep,
      generateSuggestion,
      addMonth,
      removeMonth,
      saveDraft,
      finalizeDraft,
    },
  }
}

export type ScheduleWizardController = ReturnType<typeof useScheduleWizardController>
