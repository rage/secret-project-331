"use client"

import { css } from "@emotion/css"
import { useParams } from "next/navigation"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import {
  StudentsContextProvider,
  useStudentsContext,
  useStudentsListParams,
} from "./StudentsContext"
import * as styles from "./StudentsPageStyles"
import { useCourseStudentsIdentity } from "./studentsQueries"

import type { RouteTabDefinition } from "@/components/Navigation/RouteTabList/RouteTab"
import { RouteTabList } from "@/components/Navigation/RouteTabList/RouteTabList"
import { RouteTabPageTitle } from "@/components/Navigation/RouteTabList/RouteTabPageTitle"
import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import useCourseBreadcrumbInfoQuery from "@/hooks/useCourseBreadcrumbInfoQuery"
import useCourseInstancesQuery from "@/hooks/useCourseInstancesQuery"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import Pagination from "@/shared-module/common/components/Pagination"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { manageCourseStudentsRoute } from "@/shared-module/common/utils/routes"

const KEY_USERS = "users"
const KEY_COMPLETIONS = "completions"
const KEY_PROGRESS = "progress"
const KEY_CERTIFICATES = "certificates"

const ITEMS_PER_PAGE_OPTIONS = [100, 500, 1000, 5000, 10000]

const tableSection = css`
  padding-left: 0;
  padding-right: 0;
  overflow-x: auto;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
  width: 100%;

  ${respondToOrLarger.md} {
    padding-left: 16px;
    padding-right: 16px;
  }

  ${respondToOrLarger.lg} {
    padding-left: 2vw;
    padding-right: 2vw;
  }

  ${respondToOrLarger.xl} {
    padding-left: 4vw;
    padding-right: 4vw;
  }
`

const instanceSelect = css`
  height: 36px;
  border: 1px solid #dbdbdb;
  border-radius: 4px;
  padding: 0 12px;
  font-size: 14px;
  background: #fff;
  min-width: 180px;
`

function StudentsLayoutContent({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>()
  const courseId = params.id
  const { t } = useTranslation()
  const {
    courseId: ctxCourseId,
    searchInput,
    setSearchInput,
    runImmediateSearch,
    page,
    limit,
    setPage,
    setLimit,
    courseInstanceId,
    setCourseInstanceId,
  } = useStudentsContext()
  const courseBreadcrumbInfo = useCourseBreadcrumbInfoQuery(courseId)

  const listParams = useStudentsListParams()
  const identityQuery = useCourseStudentsIdentity(ctxCourseId, listParams)
  const totalPages = identityQuery.data?.total_pages ?? 0

  const courseInstancesQuery = useCourseInstancesQuery(courseId)

  const crumbs = useMemo(
    () => [
      {
        isLoading: false as const,
        label: t("label-students"),
        href: `${manageCourseStudentsRoute(courseId)}/users`,
      },
    ],
    [courseId, t],
  )

  useRegisterBreadcrumbs({ key: `course:${courseId}:students`, order: 30, crumbs })

  const tabs = useMemo((): RouteTabDefinition[] => {
    const base = manageCourseStudentsRoute(courseId)
    return [
      { key: KEY_USERS, title: t("users"), href: `${base}/${KEY_USERS}` },
      { key: KEY_COMPLETIONS, title: t("completions"), href: `${base}/${KEY_COMPLETIONS}` },
      { key: KEY_PROGRESS, title: t("progress"), href: `${base}/${KEY_PROGRESS}` },
      { key: KEY_CERTIFICATES, title: t("certificates"), href: `${base}/${KEY_CERTIFICATES}` },
    ]
  }, [courseId, t])

  return (
    <BreakFromCentered sidebar={false}>
      <div>
        <div className={styles.headerTopSection}>
          <div className={styles.headerTopRow}>
            <div className={styles.headerTitleWrap}>
              <div className={styles.title}>{t("label-students")}</div>
              <div className={styles.chatbotInfo}>{t("chatbot-student-page-info")}</div>
            </div>
          </div>
          <hr className={styles.divider} />
        </div>

        <div className={styles.headerControlsSection}>
          <div className={styles.controlsRow}>
            <div className={styles.searchBoxWrap}>
              <input
                className={styles.searchInput}
                placeholder={t("search-students")}
                aria-label={t("search-students")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    runImmediateSearch()
                  }
                }}
              />
              <span className={styles.searchIcon} aria-hidden="true" />
            </div>

            <select
              className={instanceSelect}
              aria-label={t("course-instance")}
              value={courseInstanceId ?? ""}
              onChange={(e) => setCourseInstanceId(e.target.value === "" ? null : e.target.value)}
            >
              <option value="">{t("all-instances")}</option>
              {courseInstancesQuery.data?.map((instance) => (
                <option key={instance.id} value={instance.id}>
                  {instance.name ?? t("default-instance")}
                </option>
              ))}
            </select>

            <RouteTabPageTitle
              tabs={tabs}
              entityName={courseBreadcrumbInfo.data?.course_name}
              order={20}
            />
            <RouteTabList tabs={tabs} />
          </div>
        </div>

        <div className={tableSection}>{children}</div>

        <Pagination
          totalPages={totalPages}
          paginationInfo={{ page, setPage, limit, setLimit }}
          itemsPerPageOptions={ITEMS_PER_PAGE_OPTIONS}
        />
      </div>
    </BreakFromCentered>
  )
}

export default function StudentsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>()
  const courseId = params.id

  return (
    <StudentsContextProvider courseId={courseId}>
      <StudentsLayoutContent>{children}</StudentsLayoutContent>
    </StudentsContextProvider>
  )
}
