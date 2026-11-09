"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { cloneDeep, get, isEqual, set } from "lodash"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  type DefaultValues,
  type FieldErrors,
  type FieldValues,
  useForm,
  type UseFormReturn,
} from "react-hook-form"
import { useDebouncedCallback } from "use-debounce"

import {
  getCourseDesignerPlanQueryKey,
  updateCourseDesignerStageWorkspaceMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type {
  CourseDesignerStage,
  CourseDesignerStageWorkspace,
} from "@/generated/api/types.generated"
import { getErrorMessage } from "@/shared-module/components"

import { AUTOSAVE_DEBOUNCE_MS } from "../components/analysis-form/analysisFormDomain"

export type WorkspaceSaveState = "idle" | "unsaved" | "saving" | "saved" | "error"

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

/**
 * Form state with debounced autosave for one stage's workspace form.
 *
 * Invalid fields never block saving the rest: they are saved with their last saved value and
 * keep their error until fixed. Server data replaces the form only while it has no unsaved edits.
 */
export default function useStageWorkspaceForm<TValues extends FieldValues>({
  planId,
  stage,
  workspaceData,
  toFormValues,
  toWorkspace,
  onDirtyChange,
}: UseStageWorkspaceFormOptions<TValues>): {
  form: UseFormReturn<TValues>
  saveStatus: WorkspaceSaveStatus
  isDirty: boolean
  /** Saves pending edits now; resolves to whether everything was saved. */
  saveNow: () => Promise<boolean>
} {
  const queryClient = useQueryClient()
  const form = useForm<TValues>({
    defaultValues: toFormValues(workspaceData) as DefaultValues<TValues>,
  })
  const { getValues, reset, trigger, watch } = form

  const lastSavedRef = useRef<TValues>(getValues())
  const isDirtyRef = useRef(false)
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
      dirty && previous.state !== "saving" && previous.state !== "error"
        ? { ...previous, state: "unsaved" }
        : previous,
    )
  }, [])

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    if (isDirtyRef.current) {
      return
    }
    const serverValues = toFormValues(workspaceData)
    lastSavedRef.current = serverValues
    reset(serverValues)
  }, [workspaceData, toFormValues, reset])

  const { mutateAsync } = useMutation(updateCourseDesignerStageWorkspaceMutation())

  const saveOnce = useCallback(async (): Promise<boolean> => {
    if (!isDirtyRef.current) {
      return true
    }
    const isValid = await trigger()
    const submitted = cloneDeep(getValues())
    if (!isValid) {
      for (const path of collectErrorPaths(form.formState.errors)) {
        set(submitted, path, cloneDeep(get(lastSavedRef.current, path)))
      }
    }
    setSaveStatus((previous) => ({ ...previous, state: "saving" }))
    try {
      await mutateAsync({
        body: toWorkspace(submitted),
        path: { plan_id: planId, stage: stage.toLowerCase() },
      })
    } catch (error) {
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
    await queryClient.invalidateQueries({
      queryKey: getCourseDesignerPlanQueryKey({ path: { plan_id: planId } }),
    })
    return isValid
  }, [form.formState, getValues, mutateAsync, planId, queryClient, stage, toWorkspace, trigger])

  // Saves run one at a time so an older payload can never overwrite a newer one.
  const saveNow = useCallback((): Promise<boolean> => {
    saveChainRef.current = saveChainRef.current.then(saveOnce, saveOnce)
    return saveChainRef.current
  }, [saveOnce])

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

  return { form, saveStatus, isDirty, saveNow }
}
