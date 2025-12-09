import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { Gear } from "@vectopus/atlas-icons-react"
import { useRouter } from "next/router"
import React, { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"
import {
  deleteThresholdForModule,
  fetchCourseStructure,
  getAllThresholds,
  postThresholdForModule,
} from "../../../../../../services/backend/courses"

import CourseCheatersTabs from "./CourseCheatersTabs"

import { CourseModule, ThresholdData } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import TabLink from "@/shared-module/common/components/Navigation/TabLinks/TabLink"
import TabLinkNavigation from "@/shared-module/common/components/Navigation/TabLinks/TabLinkNavigation"
import TabLinkPanel from "@/shared-module/common/components/Navigation/TabLinks/TabLinkPanel"
import Spinner from "@/shared-module/common/components/Spinner"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, headingFont } from "@/shared-module/common/styles"

const Header = styled.div`
  width: 100%;
`

const CourseCheaters: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const [archive, setArchive] = useState(false)
  const { t } = useTranslation()
  const router = useRouter()

  useEffect(() => {
    if (router.query.archive) {
      setArchive(router.query.archive === "true")
    }
  }, [router.query.archive])

  const courseStructureQuery = useQuery({
    queryKey: [`course-structure-${courseId}`],
    queryFn: () => fetchCourseStructure(courseId),
  })

  const thresholdsQuery = useQuery({
    queryKey: [`course-thresholds-${courseId}`],
    queryFn: () => getAllThresholds(courseId),
  })

  const savedThresholds = useMemo(() => {
    if (!thresholdsQuery.data) {
      return new Map<string, number | undefined>()
    }
    const thresholdsMap = new Map<string, number | undefined>()
    thresholdsQuery.data.forEach((t: { course_module_id: string; duration_seconds: number }) => {
      thresholdsMap.set(t.course_module_id, t.duration_seconds / 3600)
    })
    return thresholdsMap
  }, [thresholdsQuery.data])

  const [moduleThresholds, setModuleThresholds] = useState<Map<string, number | undefined>>(
    () => new Map(),
  )

  const handleUpdateThreshold = async (moduleId: string, durationHours: number | undefined) => {
    if (durationHours === undefined) {
      // Delete threshold if value is empty
      return deleteThresholdForModuleMutation.mutate(moduleId)
    }

    const convertedDuration = durationHours * 3600
    const threshold = {
      duration_seconds: convertedDuration,
    }

    return postThresholdForModuleMutation.mutate({ moduleId, threshold })
  }

  const postThresholdForModuleMutation = useToastMutation(
    ({ moduleId, threshold }: { moduleId: string; threshold: ThresholdData }) =>
      postThresholdForModule(moduleId, threshold),
    {
      notify: true,
      successMessage: t("threshold-added-successfully"),
      method: "POST",
    },
    {
      onSuccess: () => {
        thresholdsQuery.refetch()
      },
    },
  )

  const deleteThresholdForModuleMutation = useToastMutation(
    (moduleId: string) => deleteThresholdForModule(moduleId),
    {
      notify: true,
      successMessage: t("threshold-removed-successfully"),
      method: "DELETE",
    },
    {
      onSuccess: () => {
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

          .threshold-btn {
            margin-top: 0.5rem;
          }
        `}
      >
        {courseStructureQuery.isError && (
          <ErrorBanner variant="readOnly" error={courseStructureQuery.error} />
        )}
        {thresholdsQuery.isError && (
          <ErrorBanner variant="readOnly" error={thresholdsQuery.error} />
        )}
        {postThresholdForModuleMutation.isError && (
          <ErrorBanner variant="readOnly" error={postThresholdForModuleMutation.error} />
        )}
        {deleteThresholdForModuleMutation.isError && (
          <ErrorBanner variant="readOnly" error={deleteThresholdForModuleMutation.error} />
        )}
        {(courseStructureQuery.isLoading || thresholdsQuery.isLoading) && (
          <Spinner variant="medium" />
        )}
        <Header>
          <h5 className="heading">
            <Gear size={16} weight="bold" aria-hidden="true" />
            {t("configure-threshold")}
          </h5>
          <p className="description">{t("configure-threshold-description")}</p>
        </Header>
        {courseStructureQuery.data && (
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
                {courseStructureQuery.data.modules
                  .sort((a: CourseModule, b: CourseModule) => a.order_number - b.order_number)
                  .map((module: CourseModule) => {
                    const savedDurationHours = savedThresholds.get(module.id)
                    const isEdited = moduleThresholds.has(module.id)
                    const editedDurationHours = moduleThresholds.get(module.id)
                    const durationHours = isEdited ? editedDurationHours : savedDurationHours
                    const isDefault = module.name === null
                    const moduleName = module.name ?? t("default-module")
                    const hasValue = durationHours !== undefined
                    const hasSavedValue = savedDurationHours !== undefined
                    const isRemoving =
                      hasSavedValue && isEdited && editedDurationHours === undefined
                    const isSaved =
                      !isEdited ||
                      (hasValue &&
                        hasSavedValue &&
                        Math.abs((durationHours ?? 0) - (savedDurationHours ?? 0)) < 0.01) ||
                      (!hasValue && !hasSavedValue)
                    // eslint-disable-next-line i18next/no-literal-string
                    const inputId = `duration-input-${module.id}`
                    // eslint-disable-next-line i18next/no-literal-string
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
                              aria-labelledby={`duration-header ${labelId}`}
                              value={durationHours?.toString() ?? ""}
                              onChangeByValue={(value: string) => {
                                const parsed = parseInt(value)
                                if (isNaN(parsed)) {
                                  setModuleThresholds((prev) => {
                                    const next = new Map(prev)
                                    next.set(module.id, undefined)
                                    return next
                                  })
                                  return
                                }
                                setModuleThresholds((prev) => {
                                  const next = new Map(prev)
                                  next.set(module.id, parsed)
                                  return next
                                })
                              }}
                            />
                          </div>
                        </td>
                        <td>
                          <Button
                            variant={isSaved ? "secondary" : isRemoving ? "reject" : "primary"}
                            size="medium"
                            disabled={
                              (!hasValue && !hasSavedValue) ||
                              postThresholdForModuleMutation.isPending ||
                              deleteThresholdForModuleMutation.isPending ||
                              isSaved
                            }
                            onClick={() => handleUpdateThreshold(module.id, durationHours)}
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
        )}
      </div>
      {}
      <TabLinkNavigation>
        <TabLink
          url={{ pathname: router.pathname, query: { ...router.query, archive: false } }}
          isActive={!archive}
          // countHook={createPendingChangeRequestCountHook(courseId)}
        >
          {t("suspected-students")}
        </TabLink>
        <TabLink
          url={{ pathname: router.pathname, query: { ...router.query, archive: true } }}
          isActive={archive}
        >
          {t("archived")}
        </TabLink>
      </TabLinkNavigation>
      {/* TODO: Dropdown for perPage? */}
      <TabLinkPanel>
        <CourseCheatersTabs courseId={courseId} archive={archive} perPage={4} />
      </TabLinkPanel>
    </>
  )
}

export default CourseCheaters
