"use client"

import { cx } from "@emotion/css"
import { useParams } from "next/navigation"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import {
  useAccountLinkingEmails,
  useAdminCreditRegistrations,
  useCreditRegistrationCourseSummary,
} from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import CourseEnroleesDialog from "@/components/credit-registration/admin/CourseEnroleesDialog"
import LinkingEmailsTable from "@/components/credit-registration/admin/LinkingEmailsTable"
import {
  RegistrationStatusCell,
  RegistrationStudentNumberCell,
} from "@/components/credit-registration/admin/RegistrationListCells"
import { registrationsListHref } from "@/components/credit-registration/admin/registrationsListUrl"
import StudentCell, {
  STUDENT_COLUMN_MIN_WIDTH,
} from "@/components/credit-registration/admin/StudentCell"
import {
  ADMIN_PAGE_SIZE_OPTIONS,
  BUTTON_SECONDARY,
  CREDIT_REGISTRATION_NS,
  DENSITY_COMPACT,
  QUIET_REFRESH,
  TABLE_STACK,
} from "@/components/credit-registration/constants"
import {
  codeValueCss,
  headingCss,
  noteCss,
  pageTitleCss,
  proseCss,
  rowCss,
  sectionCardCss,
  sectionCardHeaderCss,
  sectionCardsCss,
  sectionCss,
  sectionHeaderCss,
  spacedRowCss,
} from "@/components/credit-registration/styles"
import { useIsAccountLinkingEnabled } from "@/components/credit-registration/useIsAccountLinkingEnabled"
import { ZonedTimestamp } from "@/components/credit-registration/ZonedTimestamp"
import type { AdminCreditUnitCourseCode } from "@/generated/api/types.generated"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import {
  creditRegistrationCoursesRoute,
  creditRegistrationItemRoute,
  manageCourseRoute,
} from "@/shared-module/common/utils/routes"
import { Button, Link, Pagination, QueryResult, Table } from "@/shared-module/components"

const ROWS_PER_PAGE = 25
/** Above the credit registration layout's tab title (20), which would otherwise win. */
const TITLE_ORDER = 30

/** The course's modules, or the mooc.fi target, each with its course code. */
const CreditUnitList: React.FC<{ units: AdminCreditUnitCourseCode[] }> = ({ units }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  if (units.length === 0) {
    return <p className={noteCss}>{t("credit-registration-admin-course-no-credit-units")}</p>
  }
  return (
    <ul className={cx(noteCss, proseCss)}>
      {units.map((unit) => (
        <li key={unit.credit_unit_id} className={rowCss}>
          {unit.course_module_name && <span>{unit.course_module_name}</span>}
          <span>
            {t("credit-registration-admin-course-code-label")}{" "}
            {unit.uh_course_code ? (
              <code className={codeValueCss}>{unit.uh_course_code}</code>
            ) : (
              t("credit-registration-reason-missing-uh-course-code")
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

const RegistrationsSection: React.FC<{ courseOrTargetId: string }> = ({ courseOrTargetId }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(ROWS_PER_PAGE)
  const registrationsQuery = useAdminCreditRegistrations(
    { course_id: courseOrTargetId, include_not_started: true, page, limit },
    { paused: false },
  )
  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-registrations")}</h2>
        <Link
          href={registrationsListHref({ courseId: courseOrTargetId, includeNotStarted: true })}
          prefetch={false}
        >
          {t("credit-registration-admin-open-in-registrations-tab")}
        </Link>
      </div>
      <QueryResult
        query={registrationsQuery}
        refreshIndicator={QUIET_REFRESH}
        contentClassName={sectionCss}
      >
        {(loaded) => (
          <>
            <Table
              caption={t("credit-registration-heading-registrations")}
              density={DENSITY_COMPACT}
              responsive={TABLE_STACK}
              rowKey={(row) => row.id}
              rows={loaded.data}
              emptyState={t("credit-registration-admin-no-matching-rows")}
              columns={[
                {
                  header: t("label-student"),
                  minWidth: STUDENT_COLUMN_MIN_WIDTH,
                  grow: true,
                  cell: (row) => (
                    <StudentCell row={row} href={creditRegistrationItemRoute(row.id)} />
                  ),
                },
                {
                  header: t("label-student-number"),
                  minWidth: "8rem",
                  nowrap: true,
                  cell: (row) => <RegistrationStudentNumberCell row={row} />,
                },
                {
                  header: t("label-status"),
                  minWidth: "10rem",
                  cell: (row) => <RegistrationStatusCell row={row} />,
                },
                {
                  header: t("label-credit-registration-in-phase-since"),
                  minWidth: "9rem",
                  nowrap: true,
                  cell: (row) => <ZonedTimestamp at={row.phase_started_at} />,
                },
              ]}
            />
            <Pagination
              page={page}
              onPageChange={setPage}
              itemsPerPage={limit}
              onItemsPerPageChange={setLimit}
              totalPages={loaded.total_pages}
              totalItems={loaded.total_count}
              itemsPerPageOptions={ADMIN_PAGE_SIZE_OPTIONS}
            />
          </>
        )}
      </QueryResult>
    </section>
  )
}

const LinkingEmailsSection: React.FC<{ courseOrTargetId: string }> = ({ courseOrTargetId }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const canResend = useIsAccountLinkingEnabled()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(ROWS_PER_PAGE)
  const emailsQuery = useAccountLinkingEmails({
    course_or_target_id: courseOrTargetId,
    page,
    limit,
  })
  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-tab-linking-emails")}</h2>
      </div>
      <QueryResult
        query={emailsQuery}
        refreshIndicator={QUIET_REFRESH}
        contentClassName={sectionCss}
      >
        {(loaded) => (
          <>
            <LinkingEmailsTable
              rows={loaded.data}
              showsCourse={false}
              canResend={canResend}
              emptyState={t("credit-registration-admin-course-no-linking-emails")}
            />
            <Pagination
              page={page}
              onPageChange={setPage}
              itemsPerPage={limit}
              onItemsPerPageChange={setLimit}
              totalPages={loaded.total_pages}
              totalItems={loaded.total_count}
              itemsPerPageOptions={ADMIN_PAGE_SIZE_OPTIONS}
            />
          </>
        )}
      </QueryResult>
    </section>
  )
}

const SisuEnrolmentsSection: React.FC<{ courseOrTargetId: string; courseName: string }> = ({
  courseOrTargetId,
  courseName,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const [isOpen, setOpen] = useState(false)
  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-admin-course-enrolees-title")}</h2>
      </div>
      <div className={spacedRowCss}>
        <p className={proseCss}>{t("credit-registration-admin-course-enrolees-description")}</p>
        <Button variant={BUTTON_SECONDARY} size="medium" onClick={() => setOpen(true)}>
          {t("button-text-show-sisu-enrolments")}
        </Button>
      </div>
      <CourseEnroleesDialog
        isOpen={isOpen}
        onClose={() => setOpen(false)}
        courseOrTargetId={courseOrTargetId}
        courseName={courseName}
      />
    </section>
  )
}

/** One course's or mooc.fi target's course codes, registrations, linking emails and Sisu enrolments. */
const CreditRegistrationCoursePage: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const { courseOrTargetId } = useParams<{ courseOrTargetId: string }>()
  const summaryQuery = useCreditRegistrationCourseSummary(courseOrTargetId)
  const summary = summaryQuery.data
  const courseName = summary?.course_name ?? null

  usePageTitle(courseName && `${courseName} · ${t("credit-registration-tab-courses")}`, {
    order: TITLE_ORDER,
  })
  const crumbs = useMemo(
    () => [
      {
        isLoading: false as const,
        label: t("credit-registration-tab-courses"),
        href: creditRegistrationCoursesRoute(),
      },
      summaryQuery.isPending
        ? { isLoading: true as const }
        : {
            isLoading: false as const,
            label: courseName ?? t("credit-registration-admin-breadcrumb-course"),
          },
    ],
    [t, courseName, summaryQuery.isPending],
  )
  useRegisterBreadcrumbs({ key: "credit-registration-course", order: 40, crumbs })

  return (
    <div className={sectionCardsCss}>
      <QueryResult query={summaryQuery}>
        {(loaded) => (
          <div className={sectionHeaderCss}>
            <h1 className={pageTitleCss}>{loaded.course_name}</h1>
            {loaded.course_id && (
              <Link href={manageCourseRoute(loaded.course_id)} prefetch={false}>
                {t("credit-registration-admin-open-course-management")}
              </Link>
            )}
            <CreditUnitList units={loaded.credit_units} />
          </div>
        )}
      </QueryResult>
      <SisuEnrolmentsSection
        courseOrTargetId={courseOrTargetId}
        courseName={courseName ?? courseOrTargetId}
      />
      <RegistrationsSection courseOrTargetId={courseOrTargetId} />
      <LinkingEmailsSection courseOrTargetId={courseOrTargetId} />
    </div>
  )
}

export default CreditRegistrationCoursePage
