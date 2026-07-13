"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { Gear } from "@vectopus/atlas-icons-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  createCourseModuleThresholdMutation,
  deleteCourseModuleThresholdMutation,
  getCourseThresholdsOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { CourseModule, CourseModuleThresholdInfo } from "@/generated/api/types.generated"
import { useCourseStructure } from "@/hooks/useCourseStructure"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import { QueryResult, QueryResults } from "@/shared-module/components"

interface CheatersThresholdConfigProps {
  courseId: string
}

const SECONDS_PER_HOUR = 3600
// The backend stores the threshold as a 32-bit signed integer number of seconds, so reject
// anything that would overflow it before sending the request.
const MAX_DURATION_SECONDS = 2_147_483_647

/** Renders threshold configuration UI for the cheaters section. */
export default function CheatersThresholdConfig({ courseId }: CheatersThresholdConfigProps) {
  const { t } = useTranslation()

  const courseStructureQuery = useCourseStructure(courseId)

  const thresholdsQuery = useQuery(
    getCourseThresholdsOptions({
      path: {
        course_id: courseId,
      },
    }),
  )

  // The backend computes, per module, the configured threshold plus the policy-derived minimum and
  // default. Keeping those on the server means the exemption rule and the constants live in one
  // place instead of being mirrored (and able to drift) here.
  const thresholdInfoByModule = useMemo(() => {
    const map = new Map<string, CourseModuleThresholdInfo>()
    for (const info of thresholdsQuery.data ?? []) {
      map.set(info.course_module_id, info)
    }
    return map
  }, [thresholdsQuery.data])

  const sortedModules = useMemo(() => {
    if (!courseStructureQuery.data?.modules) {
      return []
    }
    return [...courseStructureQuery.data.modules].toSorted(
      (a: CourseModule, b: CourseModule) => a.order_number - b.order_number,
    )
  }, [courseStructureQuery.data?.modules])

  const [moduleThresholds, setModuleThresholds] = useState<Map<string, number | undefined>>(
    () => new Map(),
  )

  const handleUpdateThreshold = (moduleId: string, durationSeconds: number | undefined) => {
    if (durationSeconds === undefined) {
      return deleteThresholdForModuleMutation.mutate({
        path: {
          course_module_id: moduleId,
        },
      })
    }
    return postThresholdForModuleMutation.mutate({
      path: {
        course_module_id: moduleId,
      },
      body: { duration_seconds: durationSeconds },
    })
  }

  // Drop the in-progress edit once it is persisted so the row reflects the refetched saved state
  // (otherwise a removed threshold would stay "edited" and never show the implicit default again).
  const clearEditedThreshold = (moduleId: string) => {
    setModuleThresholds((prev) => {
      if (!prev.has(moduleId)) {
        return prev
      }
      const next = new Map(prev)
      next.delete(moduleId)
      return next
    })
  }

  const postThresholdForModuleMutation = useToastMutationOptions(
    createCourseModuleThresholdMutation(),
    { notify: true, successMessage: t("threshold-added-successfully"), method: "POST" },
    {
      onSuccess: (_data, variables) => {
        clearEditedThreshold(variables.path.course_module_id)
        thresholdsQuery.refetch()
      },
    },
  )

  const deleteThresholdForModuleMutation = useToastMutationOptions(
    deleteCourseModuleThresholdMutation(),
    { notify: true, successMessage: t("threshold-removed-successfully"), method: "DELETE" },
    {
      onSuccess: (_data, variables) => {
        clearEditedThreshold(variables.path.course_module_id)
        thresholdsQuery.refetch()
      },
    },
  )

  return (
    <>
      <h1
        className={css`
          font-size: clamp(2rem, 3.6vh, 36px);
          color: ${baseTheme.colors.gray[700]};
          font-family: ${headingFont};
          font-weight: bold;
        `}
      >
        {t("suspected-cheater")}
      </h1>
      <div
        className={css`
          min-height: 9.375rem;
          border: 1px solid #cdcdcd;
          border-radius: 4px;
          margin: 1.25rem 0 2.5rem 0;
          padding: 1.245rem;
          .heading {
            display: flex;
            align-items: center;
            margin-bottom: 0.2rem;
            font-weight: 500;
            svg {
              margin-right: 5px;
            }
          }
          .description {
            color: #707070;
            margin-bottom: 0.625rem;
          }
          .duration-threshold {
            width: 10rem;
            margin-bottom: 0;
          }
        `}
      >
        {postThresholdForModuleMutation.isError && (
          <ErrorBanner variant="readOnly" error={postThresholdForModuleMutation.error} />
        )}
        {deleteThresholdForModuleMutation.isError && (
          <ErrorBanner variant="readOnly" error={deleteThresholdForModuleMutation.error} />
        )}
        <h5 className="heading">
          <Gear size={16} weight="bold" aria-hidden="true" />
          {t("configure-threshold")}
        </h5>
        <p className="description">{t("configure-threshold-description")}</p>
        {thresholdsQuery.isError ? (
          // A thresholds failure should not block the table: it can be rendered from the course
          // structure alone, with saved values simply missing.
          <>
            <ErrorBanner variant="readOnly" error={thresholdsQuery.error} />
            <QueryResult query={courseStructureQuery}>{() => renderThresholdTable()}</QueryResult>
          </>
        ) : (
          <QueryResults
            queries={[courseStructureQuery, thresholdsQuery] as const}
            treatEmptyAsData
            renderData={renderThresholdTable}
          />
        )}
      </div>
    </>
  )

  function renderThresholdTable() {
    return (
      <div
        className={css`
          margin-top: 1rem;
        `}
      >
        <table
          className={css`
            width: 100%;
            border-collapse: collapse;
            margin-top: 1rem;
            th {
              text-align: left;
              padding: 0.75rem;
              border-bottom: 1px solid ${baseTheme.colors.gray[200]};
              font-weight: 600;
              color: ${baseTheme.colors.gray[700]};
            }
            th:first-of-type {
              width: 30%;
            }
            th:nth-of-type(2) {
              width: 30%;
            }
            th:last-of-type {
              width: 40%;
              min-width: 150px;
            }
            td {
              padding: 0.75rem;
              border-bottom: 1px solid ${baseTheme.colors.gray[100]};
              vertical-align: middle;
            }
            td:last-of-type {
              min-width: 150px;
            }
            tr:last-child td {
              border-bottom: none;
            }
          `}
          aria-label={t("configure-threshold")}
        >
          <caption
            className={css`
              text-align: left;
              font-weight: 600;
              margin-bottom: 0.5rem;
              caption-side: top;
            `}
          >
            {t("configure-threshold")}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t("module")}</th>
              <th scope="col" id="duration-header">
                {t("duration-in-hours")}
              </th>
              <th scope="col">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {sortedModules.map((module: CourseModule) => {
              const info = thresholdInfoByModule.get(module.id)
              const configuredSeconds = info?.configured_duration_seconds ?? undefined
              const minimumSeconds = info?.minimum_duration_seconds ?? 0
              const defaultSeconds = info?.default_duration_seconds ?? 0
              const configuredHours =
                configuredSeconds !== undefined ? configuredSeconds / SECONDS_PER_HOUR : undefined
              const isEdited = moduleThresholds.has(module.id)
              const editedHours = moduleThresholds.get(module.id)
              const durationHours = isEdited ? editedHours : configuredHours
              const isDefault = module.name === null
              const moduleName = module.name ?? t("default-module")
              const hasValue = durationHours !== undefined
              const hasConfiguredValue = configuredSeconds !== undefined
              // Validate in seconds, mirroring the backend, so the hours->seconds rounding and
              // the saved-value comparison use the exact value that will be stored. This also
              // means a tiny positive value that rounds to 0 is treated as 0 (check off) rather
              // than silently saved as a different number.
              const durationSeconds = hasValue
                ? Math.round((durationHours as number) * SECONDS_PER_HOUR)
                : undefined
              const isInvalid =
                durationSeconds !== undefined &&
                (durationSeconds < minimumSeconds || durationSeconds > MAX_DURATION_SECONDS)
              const errorMessage = !isInvalid
                ? undefined
                : durationSeconds !== undefined && durationSeconds > MAX_DURATION_SECONDS
                  ? t("threshold-too-large")
                  : minimumSeconds > 0
                    ? t("threshold-must-be-at-least-3-hours")
                    : t("threshold-must-be-non-negative")
              // A small (exempt) module with an effective threshold of 0 has its duration check
              // turned off; surface that explicitly so saving 0 is never a silent no-op.
              const disablesCheck =
                minimumSeconds === 0 && durationSeconds !== undefined && durationSeconds === 0
              const isRemoving = hasConfiguredValue && isEdited && editedHours === undefined
              // With thresholdsQuery resolved, no configured value means the backend default
              // applies; show it as the value instead of an empty field.
              const showsImplicitDefault = !hasConfiguredValue && !isEdited
              const displayedValue = showsImplicitDefault
                ? (defaultSeconds / SECONDS_PER_HOUR).toString()
                : (durationHours?.toString() ?? "")
              const isSaved =
                !isEdited ||
                (durationSeconds !== undefined && durationSeconds === configuredSeconds) ||
                (!hasValue && !hasConfiguredValue)
              const minHours = minimumSeconds / SECONDS_PER_HOUR
              // oxlint-disable-next-line i18next/no-literal-string
              const inputId = `duration-input-${module.id}`
              // oxlint-disable-next-line i18next/no-literal-string
              const labelId = `${inputId}-label`
              return (
                <tr key={module.id}>
                  <td>{isDefault ? <strong>{moduleName}</strong> : moduleName}</td>
                  <td>
                    <span
                      id={labelId}
                      className={css`
                        position: absolute;
                        width: 1px;
                        height: 1px;
                        padding: 0;
                        margin: -1px;
                        overflow: hidden;
                        clip-path: inset(50%);
                        white-space: nowrap;
                        border-width: 0;
                      `}
                    >
                      {moduleName}
                    </span>
                    <div
                      className={css`
                        display: inline-block;
                        vertical-align: middle;
                      `}
                    >
                      <TextField
                        id={inputId}
                        className="duration-threshold"
                        type="number"
                        min={minHours}
                        step={0.01}
                        error={errorMessage}
                        aria-labelledby={`duration-header ${labelId}`}
                        value={displayedValue}
                        onChangeByValue={(value: string) => {
                          // oxlint-disable-next-line unicorn/prefer-number-coercion -- parseInt/parseFloat parsing is intentional; Number() would change behavior
                          const parsed = parseFloat(value)
                          setModuleThresholds((prev) => {
                            const next = new Map(prev)
                            // oxlint-disable-next-line unicorn/no-immediate-mutation -- copy-then-set is the intended immutable state update; folding into the initializer risks tuple type inference
                            next.set(module.id, Number.isFinite(parsed) ? parsed : undefined)
                            return next
                          })
                        }}
                      />
                    </div>
                    {showsImplicitDefault && (
                      <span
                        className={css`
                          margin-left: 0.5rem;
                          color: ${baseTheme.colors.gray[500]};
                          font-size: 0.875rem;
                        `}
                      >
                        {t("threshold-default-in-use")}
                      </span>
                    )}
                    {disablesCheck && (
                      <span
                        className={css`
                          margin-left: 0.5rem;
                          color: ${baseTheme.colors.gray[500]};
                          font-size: 0.875rem;
                        `}
                      >
                        {t("cheater-detection-disabled")}
                      </span>
                    )}
                  </td>
                  <td>
                    <Button
                      variant={isSaved ? "secondary" : isRemoving ? "reject" : "primary"}
                      size="medium"
                      disabled={
                        (!hasValue && !hasConfiguredValue) ||
                        postThresholdForModuleMutation.isPending ||
                        deleteThresholdForModuleMutation.isPending ||
                        (isInvalid && !isRemoving) ||
                        isSaved
                      }
                      onClick={() => handleUpdateThreshold(module.id, durationSeconds)}
                      className={css`
                        min-width: 140px;
                      `}
                    >
                      {isSaved
                        ? t("saved")
                        : isRemoving
                          ? t("remove-threshold")
                          : t("set-threshold")}
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }
}
