"use client"

import { useQueryClient } from "@tanstack/react-query"
import type { MouseEvent } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useForm, useFormState } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useDebouncedCallback } from "use-debounce"

import {
  ANALYSIS_WORKSPACE_SCHEMA_V1,
  type AnalysisWorkspaceFormValues,
  AUTOSAVE_DEBOUNCE_MS,
  buildCreditsFieldRules,
  defaultAnalysisWorkspaceV1,
  INTERSECTION_ROOT_MARGIN,
  parseAnalysisWorkspaceFromApi,
  SCROLL_BEHAVIOR,
  SCROLL_BLOCK,
  SECTION_COUNT,
  SECTION_DOM_PREFIX,
  SECTION_NAV_KEYS,
  STAGE_ANALYSIS,
  stripOpenPeriodAll,
  withDerivedOpenPeriodAll,
} from "../components/analysis-form/analysisFormDomain"

import {
  getCourseDesignerPlanQueryKey,
  updateCourseDesignerStageWorkspaceMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type { AnalysisWorkspaceV1 } from "@/generated/api/types.generated"
import { showErrorNotification } from "@/shared-module/common/components/Notifications/notificationHelpers"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"

const scrollToSection = (id: string) => (e: MouseEvent<HTMLAnchorElement>) => {
  e.preventDefault()
  document.querySelector(`#${id}`)?.scrollIntoView({
    behavior: SCROLL_BEHAVIOR,
    block: SCROLL_BLOCK,
  })
}

/**
 * Owns form state, autosave, dirty tracking, section nav, and workspace mutations for the Analysis form.
 */
export default function useAnalysisWorkspaceFormController(props: {
  onDirtyChange?: (dirty: boolean) => void
  planId: string
  workspaceData: unknown | null
}) {
  const { onDirtyChange, planId, workspaceData } = props
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>(() => {
    return Object.fromEntries(
      Array.from({ length: SECTION_COUNT }, (_, i) => [i + 1, true] as const),
    ) as Record<number, boolean>
  })
  const [activeSection, setActiveSection] = useState(1)
  const isDirtyRef = useRef(false)

  const form = useForm<AnalysisWorkspaceFormValues>({
    defaultValues: stripOpenPeriodAll(defaultAnalysisWorkspaceV1()),
  })

  const { control, handleSubmit, reset, setValue, getValues, watch, trigger } = form
  const { isDirty } = useFormState({ control })
  const creditsFieldRules = useMemo(() => buildCreditsFieldRules(t), [t])
  useEffect(() => {
    isDirtyRef.current = isDirty
  }, [isDirty])

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    reset(stripOpenPeriodAll(parseAnalysisWorkspaceFromApi(workspaceData)))
  }, [workspaceData, reset])

  const patchWorkspace = useCallback(
    (payload: AnalysisWorkspaceV1) => ({
      body: {
        schema: ANALYSIS_WORKSPACE_SCHEMA_V1,
        payload,
      },
      path: {
        plan_id: planId,
        stage: STAGE_ANALYSIS.toLowerCase(),
      },
    }),
    [planId],
  )

  const handleSaveSuccess = useCallback(
    async (saved: AnalysisWorkspaceV1) => {
      reset(stripOpenPeriodAll(saved))
      await queryClient.invalidateQueries({
        queryKey: getCourseDesignerPlanQueryKey({ path: { plan_id: planId } }),
      })
      onDirtyChange?.(false)
    },
    [onDirtyChange, planId, queryClient, reset],
  )

  const autosaveMutation = useToastMutationOptions(
    updateCourseDesignerStageWorkspaceMutation(),
    { notify: false },
    {
      onSuccess: async (_data, variables) => {
        await handleSaveSuccess(variables.body.payload)
      },
      onError: () => {
        showErrorNotification({
          message: t("course-plans-analysis-save-status-error"),
        })
      },
    },
  )

  const manualSaveMutation = useToastMutationOptions(
    updateCourseDesignerStageWorkspaceMutation(),
    {
      notify: true,
      method: "PATCH",
      loadingText: t("course-plans-analysis-saving"),
    },
    {
      onSuccess: async (_data, variables) => {
        await handleSaveSuccess(variables.body.payload)
      },
    },
  )

  const debouncedAutosave = useDebouncedCallback(async () => {
    if (!isDirtyRef.current) {
      return
    }
    const ok = await trigger()
    if (!ok) {
      showErrorNotification({
        message: t("course-plans-analysis-save-status-error"),
      })
      return
    }
    autosaveMutation.mutate(patchWorkspace(withDerivedOpenPeriodAll(getValues())))
  }, AUTOSAVE_DEBOUNCE_MS)

  useEffect(() => {
    const subscription = watch(() => {
      debouncedAutosave()
    })
    return () => subscription.unsubscribe()
  }, [watch, debouncedAutosave])

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault()
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [])

  useEffect(() => {
    const ids = [1, 2, 3, 4, 5, 6]
    const elements = ids
      .map((id) => document.querySelector(`#${SECTION_DOM_PREFIX}${id}`))
      .filter((el): el is HTMLElement => el != null)
    if (elements.length === 0) {
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.filter((en) => en.isIntersecting)
        if (intersecting.length === 0) {
          return
        }
        intersecting.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        const id = intersecting[0].target.id
        // oxlint-disable-next-line unicorn/prefer-number-coercion -- parseInt/parseFloat parsing is intentional; Number() would change behavior
        const n = Number.parseInt(id.replace(SECTION_DOM_PREFIX, ""), 10)
        if (!Number.isNaN(n)) {
          setActiveSection(n)
        }
      },
      {
        root: null,
        rootMargin: INTERSECTION_ROOT_MARGIN,
        threshold: 0,
      },
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [expandedSections])

  const onSubmit = (data: AnalysisWorkspaceFormValues) => {
    manualSaveMutation.mutate(patchWorkspace(withDerivedOpenPeriodAll(data)))
  }

  const saving = autosaveMutation.isPending || manualSaveMutation.isPending

  const toggleSection = (n: number) => {
    setExpandedSections((prev) => ({ ...prev, [n]: !prev[n] }))
  }

  const uhBody = t("course-plans-analysis-resources-uh-body")
  const uhLines = uhBody.split("\n").filter((line) => line.trim() !== "")

  const showUhResources =
    process.env.NEXT_PUBLIC_SHOW_UH_ANALYSIS_RESOURCES === undefined ||
    process.env.NEXT_PUBLIC_SHOW_UH_ANALYSIS_RESOURCES !== "false"

  return {
    form: { control, handleSubmit, setValue, onSubmit },
    expandedSections,
    activeSection,
    toggleSection,
    scrollToSection,
    saving,
    creditsFieldRules,
    uhLines,
    showUhResources,
    sectionNavKeys: SECTION_NAV_KEYS,
  }
}
