"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { cloneDeep, get, isEqual, set } from "lodash"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  type DefaultValues,
  type FieldErrors,
  type FieldValues,
  type Path,
  useForm,
  type UseFormReturn,
} from "react-hook-form"
import { useDebouncedCallback } from "use-debounce"

import {
  getCourseDesignerPlanQueryKey,
  updateCourseDesignerStageWorkspaceMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type {
  CourseDesignerPlanDetails,
  CourseDesignerStage,
  CourseDesignerStageWorkspace,
} from "@/generated/api/types.generated"
import { isAppApiError } from "@/shared-module/common/errors/AppApiError"
import { getErrorMessage } from "@/shared-module/components"

import { useInvalidatePlan } from "../../../hooks/useInvalidatePlan"
import { useRegisterPendingSave } from "../../components/PendingSavesContext"
import { AUTOSAVE_DEBOUNCE_MS } from "../components/analysis-form/analysisFormDomain"

export type WorkspaceSaveState = "idle" | "unsaved" | "saving" | "saved" | "error" | "conflict"

export interface WorkspaceSaveStatus {
  state: WorkspaceSaveState
  /** Server error from the last failed save. */
  errorMessage: string | null
  /** The last save kept the previously saved value for fields that failed validation. */
  hasSkippedInvalidFields: boolean
}

interface UseStageWorkspaceFormOptions<TValues extends FieldValues> {
  planId: string
  stage: CourseDesignerStage
  /** The stage's stored `workspace_data`. */
  workspaceData: unknown
  /** The stage's `workspace_revision`, read together with `workspaceData`. */
  workspaceRevision: number
  /** Archived plans: nothing is saved. */
  isReadOnly: boolean
  /** Must be referentially stable (a module-level function). */
  toFormValues: (workspaceData: unknown) => TValues
  /** Must be referentially stable (a module-level function). */
  toWorkspace: (values: TValues) => CourseDesignerStageWorkspace
  onDirtyChange?: (dirty: boolean) => void
}

/** Paths (`a.0.b`) of every field error in a react-hook-form error tree. */
function collectErrorPaths(errors: FieldErrors, prefix = ""): string[] {
  return Object.entries(errors).flatMap(([key, value]) => {
    if (value === null || typeof value !== "object") {
      return []
    }
    const path = prefix ? `${prefix}.${key}` : key
    if ("type" in value && "message" in value) {
      return [path]
    }
    return collectErrorPaths(value as FieldErrors, path)
  })
}

function isStaleVersionError(error: unknown): boolean {
  return isAppApiError(error) && error.messageKey === "stale_version"
}

/**
 * Form state with debounced autosave for one stage's workspace form.
 *
 * Invalid fields never block saving the rest: they are saved with their last saved value and
 * keep their error until fixed. Server data replaces the form only while it has no unsaved edits.
 * When another member saved the form first, saving stops in the `conflict` state and the user's
 * edits stay in the form until they call `loadLatest`.
 */
export default function useStageWorkspaceForm<TValues extends FieldValues>({
  planId,
  stage,
  workspaceData,
  workspaceRevision,
  isReadOnly,
  toFormValues,
  toWorkspace,
  onDirtyChange,
}: UseStageWorkspaceFormOptions<TValues>): {
  form: UseFormReturn<TValues>
  saveStatus: WorkspaceSaveStatus
  isDirty: boolean
  /** Saves pending edits now; resolves to whether everything was saved. */
  saveNow: () => Promise<boolean>
  /** Replaces the form, unsaved edits included, with the latest saved version. */
  loadLatest: () => void
} {
  const queryClient = useQueryClient()
  const invalidatePlan = useInvalidatePlan(planId)
  const form = useForm<TValues>({
    defaultValues: toFormValues(workspaceData) as DefaultValues<TValues>,
  })
  const { getFieldState, getValues, reset, trigger, watch } = form

  const lastSavedRef = useRef<TValues>(getValues())
  const baseRevisionRef = useRef(workspaceRevision)
  const serverStateRef = useRef({ workspaceData, workspaceRevision })
  const isDirtyRef = useRef(false)
  const hasConflictRef = useRef(false)
  const saveChainRef = useRef<Promise<boolean>>(Promise.resolve(true))
  const [isDirty, setIsDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState<WorkspaceSaveStatus>({
    state: "idle",
    errorMessage: null,
    hasSkippedInvalidFields: false,
  })

  const updateDirty = useCallback((dirty: boolean) => {
    isDirtyRef.current = dirty
    setIsDirty(dirty)
    setSaveStatus((previous) =>
      dirty &&
      previous.state !== "saving" &&
      previous.state !== "error" &&
      previous.state !== "conflict"
        ? { ...previous, state: "unsaved" }
        : previous,
    )
  }, [])

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    serverStateRef.current = { workspaceData, workspaceRevision }
    if (isDirtyRef.current) {
      return
    }
    const serverValues = toFormValues(workspaceData)
    lastSavedRef.current = serverValues
    baseRevisionRef.current = workspaceRevision
    reset(serverValues)
  }, [workspaceData, workspaceRevision, toFormValues, reset])

  const { mutateAsync } = useMutation(updateCourseDesignerStageWorkspaceMutation())

  const saveOnce = useCallback(async (): Promise<boolean> => {
    if (hasConflictRef.current) {
      return false
    }
    if (!isDirtyRef.current || isReadOnly) {
      return true
    }
    const isValid = await trigger()
    const submitted = cloneDeep(getValues())
    if (!isValid) {
      // getFieldState reads the errors trigger() just set; formState is the last render's snapshot.
      const errors: FieldErrors = {}
      for (const key of Object.keys(submitted)) {
        const { error } = getFieldState(key as Path<TValues>)
        if (error) {
          errors[key] = error
        }
      }
      for (const path of collectErrorPaths(errors)) {
        set(submitted, path, cloneDeep(get(lastSavedRef.current, path)))
      }
    }
    setSaveStatus((previous) => ({ ...previous, state: "saving" }))
    let details: CourseDesignerPlanDetails
    try {
      details = await mutateAsync({
        body: { workspace: toWorkspace(submitted), base_revision: baseRevisionRef.current },
        path: { plan_id: planId, stage: stage.toLowerCase() },
      })
      const savedRevision = details.stages.find(
        (candidate) => candidate.stage === stage,
      )?.workspace_revision
      if (savedRevision !== undefined) {
        baseRevisionRef.current = savedRevision
      }
    } catch (error) {
      if (isStaleVersionError(error)) {
        hasConflictRef.current = true
        setSaveStatus({ state: "conflict", errorMessage: null, hasSkippedInvalidFields: false })
        await invalidatePlan()
        return false
      }
      setSaveStatus({
        state: "error",
        errorMessage: getErrorMessage(error),
        hasSkippedInvalidFields: !isValid,
      })
      return false
    }
    lastSavedRef.current = submitted
    const stillDirty = !isEqual(getValues(), submitted)
    isDirtyRef.current = stillDirty
    setIsDirty(stillDirty)
    setSaveStatus({
      state: stillDirty ? "unsaved" : "saved",
      errorMessage: null,
      hasSkippedInvalidFields: !isValid,
    })
    queryClient.setQueryData(getCourseDesignerPlanQueryKey({ path: { plan_id: planId } }), details)
    return isValid
  }, [
    getFieldState,
    getValues,
    invalidatePlan,
    isReadOnly,
    mutateAsync,
    planId,
    queryClient,
    stage,
    toWorkspace,
    trigger,
  ])

  const loadLatest = useCallback(() => {
    const latest = serverStateRef.current
    const serverValues = toFormValues(latest.workspaceData)
    hasConflictRef.current = false
    lastSavedRef.current = serverValues
    baseRevisionRef.current = latest.workspaceRevision
    isDirtyRef.current = false
    reset(serverValues)
    setIsDirty(false)
    setSaveStatus({ state: "idle", errorMessage: null, hasSkippedInvalidFields: false })
  }, [reset, toFormValues])

  // Saves run one at a time so an older payload can never overwrite a newer one.
  const saveNow = useCallback((): Promise<boolean> => {
    saveChainRef.current = saveChainRef.current.then(saveOnce, saveOnce)
    return saveChainRef.current
  }, [saveOnce])

  useRegisterPendingSave(saveNow)

  const debouncedSave = useDebouncedCallback(() => {
    void saveNow()
  }, AUTOSAVE_DEBOUNCE_MS)

  useEffect(() => {
    const subscription = watch((values) => {
      updateDirty(!isEqual(values, lastSavedRef.current))
      debouncedSave()
    })
    return () => subscription.unsubscribe()
  }, [watch, debouncedSave, updateDirty])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        event.preventDefault()
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [])

  return { form, saveStatus, isDirty, saveNow, loadLatest }
}
