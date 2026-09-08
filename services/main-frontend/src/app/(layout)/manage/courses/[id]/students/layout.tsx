"use client"

import { css, cx } from "@emotion/css"
import { MagnifyingGlass } from "@vectopus/atlas-icons-react"
import { useParams, useSearchParams } from "next/navigation"
import React, { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import { CREDIT_REGISTRATION_NS } from "@/components/credit-registration/constants"
import type { CreditRegistrationTFunction } from "@/components/credit-registration/constants"
import type { RegistrationStatusView } from "@/components/credit-registration/registrationStatusViews"
import {
  REGISTRATION_STATUS_VIEWS,
  registrationStatusViewLabel,
} from "@/components/credit-registration/registrationStatusViews"
import { noteCss, pageTitleCss } from "@/components/credit-registration/styles"
import { useCanViewCreditRegistrations } from "@/components/credit-registration/teacherCreditRegistrations"
import type { RouteTabDefinition } from "@/components/Navigation/RouteTabList/RouteTab"
import { RouteTabList } from "@/components/Navigation/RouteTabList/RouteTabList"
import { RouteTabPageTitle } from "@/components/Navigation/RouteTabList/RouteTabPageTitle"
import useCourseBreadcrumbInfoQuery from "@/hooks/useCourseBreadcrumbInfoQuery"
import useCourseInstancesQuery from "@/hooks/useCourseInstancesQuery"
import { useCourseStructure } from "@/hooks/useCourseStructure"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import Pagination from "@/shared-module/common/components/Pagination"
import Spinner from "@/shared-module/common/components/Spinner"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { manageCourseStudentsRoute } from "@/shared-module/common/utils/routes"
import { Select } from "@/shared-module/components"

import {
  StudentsContextProvider,
  useStudentsContext,
  useStudentsListParams,
} from "./StudentsContext"
import * as styles from "./StudentsPageStyles"
import type { GradeFilterValue } from "./studentsQueries"
import { useCourseStudentsIdentity, useCourseStudentsPrefetchNextPage } from "./studentsQueries"

// Fixed set: the platform only supports the sis-0-5 numeric scale and the sis-hyv-hyl pass/fail
// scale (see StudyRegistryGrade), so every module's completions fit one of these. A numerically
// graded module never has a null-grade "passed"/"failed" completion (or vice versa), so offering
// both kinds together is harmless -- the ones that don't apply to a given module simply match nothing.
const GRADE_FILTER_OPTIONS: GradeFilterValue[] = [
  "not_completed",
  "passed",
  "failed",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
]

const gradeFilterLabel = (value: GradeFilterValue, t: CreditRegistrationTFunction): string => {
  switch (value) {
    case "not_completed":
      return t("not-completed")
    case "passed":
      return t("passed")
    case "failed":
      return t("failed")
    default:
      return value
  }
}

const KEY_USERS = "users"
const KEY_COMPLETIONS = "completions"
const KEY_PROGRESS = "progress"
const KEY_CERTIFICATES = "certificates"

// Capped at 1000: detail subtabs POST the whole page's user_ids in one request; larger pages would
// send oversized payloads.
const ITEMS_PER_PAGE_OPTIONS = [100, 500, 1000]

const tableSection = css`
  /* The roster keeps the page's gutter even while it scrolls sideways: a table running to x=0
     under filters that are indented reads as a rendering fault. */
  padding-left: 16px;
  padding-right: 16px;
  width: 100%;

  ${respondToOrLarger.lg} {
    padding-left: 2vw;
    padding-right: 2vw;
  }

  ${respondToOrLarger.xl} {
    padding-left: 4vw;
    padding-right: 4vw;
  }
`

// Below md the row is a column, where a flex-basis becomes the item's height: 14rem there would
// leave the 56px control floating in a 224px-tall box.
const filterFieldCss = css`
  flex: none;

  ${respondToOrLarger.md} {
    flex: 0 1 14rem;
    min-width: 10rem;
  }
`

/** The value a select uses for "do not narrow by this at all"; the fields themselves take strings. */
const ANY = ""

const rosterCaptionCss = css`
  margin-bottom: 8px;
`

interface FilterFields {
  instance: string
  module: string
  grade: string
  registration: string
}

function StudentsLayoutContent({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>()
  const courseId = params.id
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const {
    courseId: ctxCourseId,
    searchInput,
    setSearchInput,
    runImmediateSearch,
    isSearchPending,
    page,
    limit,
    setPage,
    setLimit,
    courseInstanceId,
    setCourseInstanceId,
    moduleId,
    setModuleId,
    grade,
    setGrade,
    registrationView,
    setRegistrationView,
  } = useStudentsContext()
  const canFilterByRegistration = useCanViewCreditRegistrations(courseId)
  const courseBreadcrumbInfo = useCourseBreadcrumbInfoQuery(courseId)

  const listParams = useStudentsListParams()
  const identityQuery = useCourseStudentsIdentity(ctxCourseId, listParams)
  const totalPages = identityQuery.data?.total_pages ?? 0
  // The identity endpoint has no course-wide total, so this is the current page's row count --
  // exact when there is only one page, which is the common case.
  const studentCount = identityQuery.data?.data.length ?? 0
  // Owned here (single instance) so the next-page prefetch is scheduled once, not once per subtab.
  useCourseStudentsPrefetchNextPage(ctxCourseId, listParams, totalPages)

  const searchParams = useSearchParams()
  // Subtab links carry the current query string so the shared (URL-synced) search and page survive
  // a tab switch; `pathPrefix` below keeps active-tab matching on the clean path.
  const tabQuerySuffix = searchParams.toString() ? `?${searchParams.toString()}` : ""

  const courseInstancesQuery = useCourseInstancesQuery(courseId)
  const courseStructureQuery = useCourseStructure(courseId)
  const modulesInOrder = useMemo(
    () =>
      (courseStructureQuery.data?.modules ?? []).toSorted(
        (a, b) => a.order_number - b.order_number,
      ),
    [courseStructureQuery.data],
  )

  // The query string owns the filters, so the form follows it rather than the other way round;
  // a count in the summary panel sets a view and the select has to move with it.
  const filterValues = useMemo(
    (): FilterFields => ({
      instance: courseInstanceId ?? ANY,
      module: moduleId ?? ANY,
      grade: grade ?? ANY,
      registration: registrationView,
    }),
    [courseInstanceId, moduleId, grade, registrationView],
  )
  const { control, watch } = useForm<FilterFields>({ values: filterValues })
  const [watchedInstance, watchedModule, watchedGrade, watchedRegistration] = watch([
    "instance",
    "module",
    "grade",
    "registration",
  ])

  useEffect(() => {
    if (watchedInstance !== filterValues.instance) {
      setCourseInstanceId(watchedInstance === ANY ? null : watchedInstance)
    }
    if (watchedModule !== filterValues.module) {
      setModuleId(watchedModule === ANY ? null : watchedModule)
    }
    if (watchedGrade !== filterValues.grade) {
      setGrade(watchedGrade === ANY ? null : (watchedGrade as GradeFilterValue))
    }
    if (watchedRegistration !== filterValues.registration) {
      setRegistrationView(watchedRegistration as RegistrationStatusView)
    }
  }, [
    watchedInstance,
    watchedModule,
    watchedGrade,
    watchedRegistration,
    filterValues,
    setCourseInstanceId,
    setModuleId,
    setGrade,
    setRegistrationView,
  ])

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
    const tab = (key: string, title: string): RouteTabDefinition => ({
      key,
      title,
      href: `${base}/${key}${tabQuerySuffix}`,
      pathPrefix: `${base}/${key}`,
    })
    return [
      tab(KEY_USERS, t("users")),
      tab(KEY_COMPLETIONS, t("completions")),
      tab(KEY_PROGRESS, t("progress")),
      tab(KEY_CERTIFICATES, t("certificates")),
    ]
  }, [courseId, t, tabQuerySuffix])

  return (
    <BreakFromCentered sidebar={false}>
      <div>
        <div className={styles.headerTopSection}>
          <div className={styles.headerTopRow}>
            <div className={styles.headerTitleWrap}>
              <h1 className={pageTitleCss}>{t("label-students")}</h1>
            </div>
          </div>
        </div>

        <div className={styles.headerControlsSection}>
          <div className={styles.navigationRow}>
            <RouteTabPageTitle
              tabs={tabs}
              entityName={courseBreadcrumbInfo.data?.course_name}
              order={20}
            />
            <RouteTabList tabs={tabs} className={styles.tabListCss} />
          </div>
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
              <span className={styles.searchIcon} aria-hidden="true">
                <MagnifyingGlass size={18} />
              </span>
              {isSearchPending && (
                <span className={styles.searchPendingSpinner} aria-hidden="true">
                  <Spinner variant="small" disableMargin />
                </span>
              )}
            </div>

            <Select
              name="instance"
              control={control}
              className={filterFieldCss}
              label={t("course-instance")}
              options={[
                { value: ANY, label: t("all-instances") },
                ...(courseInstancesQuery.data ?? []).map((instance) => ({
                  value: instance.id,
                  label: instance.name ?? t("default-instance"),
                })),
              ]}
            />

            <Select
              name="module"
              control={control}
              className={filterFieldCss}
              label={t("module")}
              options={[
                { value: ANY, label: t("all-modules") },
                ...modulesInOrder.map((module) => ({
                  value: module.id,
                  label: module.name ?? t("default-module"),
                })),
              ]}
            />

            {moduleId && (
              <Select
                name="grade"
                control={control}
                className={filterFieldCss}
                label={t("grade")}
                options={[
                  { value: ANY, label: t("all-grades") },
                  ...GRADE_FILTER_OPTIONS.map((value) => ({
                    value,
                    label: gradeFilterLabel(value, t),
                  })),
                ]}
              />
            )}

            {canFilterByRegistration && (
              <Select
                name="registration"
                control={control}
                className={filterFieldCss}
                label={t("credit-registration-column-registration")}
                options={REGISTRATION_STATUS_VIEWS.map((view) => ({
                  value: view,
                  label: registrationStatusViewLabel(t, view),
                }))}
              />
            )}
          </div>
        </div>

        {studentCount > 0 && (
          <p className={cx(noteCss, rosterCaptionCss)}>
            {t("roster-student-count", { count: studentCount })}
          </p>
        )}
        <div className={tableSection}>{children}</div>

        {totalPages > 1 && (
          <Pagination
            totalPages={totalPages}
            paginationInfo={{ page, setPage, limit, setLimit }}
            itemsPerPageOptions={ITEMS_PER_PAGE_OPTIONS}
          />
        )}
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
