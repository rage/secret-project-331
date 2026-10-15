"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import { DENSITY_COMPACT, SORT_ASCENDING } from "@/components/credit-registration/constants"
import { pageTitleCss } from "@/components/credit-registration/styles"
import {
  getCourseInstanceOptions,
  getCourseInstancePointsOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { UserDetail } from "@/generated/api/types.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { roundDown } from "@/shared-module/common/utils/numbers"
import { joinTitleSegments } from "@/shared-module/common/utils/pageTitle"
import { courseUserStatusSummaryRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Link, QueryResult, Table, type TableColumn } from "@/shared-module/components"

import ChapterPointsDashboard from "../ChapterPointsDashboard"

interface ProcessedUser {
  user: UserDetail
  totalPoints: number
  chapterPoints: Record<string, number>
}

const NAME = "name"
const NUMBER = "number"
const SCORE = "score"
const EMAIL = "email"

const SHORT_ID_LENGTH = 8

const shortId = (id: string) => id.slice(0, SHORT_ID_LENGTH)

const chapterSortKey = (chapterNumber: number) => `ch${chapterNumber}`

const CourseInstancePointsList: React.FC = () => {
  const { id: courseInstanceId } = useParams<{ id: string }>()
  const { t } = useTranslation()

  const [sorting, setSorting] = useState(NAME)

  const courseInstanceQuery = useQuery({
    ...getCourseInstanceOptions({
      path: {
        course_instance_id: courseInstanceId,
      },
    }),
  })

  const instanceLabel = courseInstanceQuery.data?.name || t("default-instance")

  usePageTitle(
    courseInstanceQuery.isLoading ? null : joinTitleSegments([t("point-summary"), instanceLabel]),
    { order: 10 },
  )

  const crumbs = useMemo(() => [{ isLoading: false as const, label: t("point-summary") }], [t])

  useRegisterBreadcrumbs({
    key: `course-instance:${courseInstanceId}:points`,
    order: 60,
    crumbs,
  })

  function sortUsers(first: ProcessedUser, second: ProcessedUser): number {
    if (sorting === NAME) {
      return `${first.user.last_name} ${first.user.first_name}`.localeCompare(
        `${second.user.last_name} ${second.user.first_name}`,
      )
    } else if (sorting === NUMBER) {
      return first.user.user_id.localeCompare(second.user.user_id)
    } else if (sorting === SCORE) {
      return second.totalPoints - first.totalPoints
    } else if (sorting === EMAIL) {
      return first.user.email.localeCompare(second.user.email)
    }
    return (second.chapterPoints[sorting] ?? 0) - (first.chapterPoints[sorting] ?? 0)
  }

  const sortColumn = (
    key: string,
  ): Pick<TableColumn<ProcessedUser>, "onSort" | "sortDirection"> => ({
    onSort: () => setSorting(key),
    sortDirection: sorting === key ? SORT_ASCENDING : null,
  })

  const getPointsList = useQuery({
    ...getCourseInstancePointsOptions({
      path: {
        course_instance_id: courseInstanceId,
      },
    }),
  })

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        gap: var(--space-4);

        margin-top: 40px;
        ${respondToOrLarger.sm} {
          margin-top: 80px;
        }
      `}
    >
      <h1 className={pageTitleCss}>
        {t("point-summary")}: {instanceLabel}
      </h1>
      <QueryResult query={getPointsList}>
        {(data) => {
          const instanceTotalPoints = data.chapter_points.reduce(
            (prev, curr) => prev + curr.score_total,
            0,
          )

          const courseId =
            courseInstanceQuery.data?.course_id ??
            (data.chapter_points.length > 0 ? data.chapter_points[0]?.course_id : undefined)

          const rows: ProcessedUser[] = data.users
            .map((user) => {
              const userChapterPoints = data.user_chapter_points[user.user_id] || {}
              const totalPoints = Object.values(userChapterPoints).reduce(
                (prev, curr) => prev + curr,
                0,
              )
              const chapterPoints = Object.fromEntries(
                data.chapter_points.map((c) => [
                  chapterSortKey(c.chapter_number),
                  userChapterPoints[c.id] || 0,
                ]),
              )
              return { user, totalPoints, chapterPoints }
            })
            .toSorted(sortUsers)

          return (
            <>
              <ChapterPointsDashboard
                chapterScores={data.chapter_points.map((p) => ({
                  id: p.id,
                  name: p.name,
                  value: `${roundDown(p.score_given, 2)}/${p.score_total * data.users.length}`,
                }))}
                userCount={data.users.length}
              />
              <Table
                caption={t("point-summary")}
                density={DENSITY_COMPACT}
                rows={rows}
                rowKey={({ user }) => user.user_id}
                columns={[
                  {
                    header: t("label-user-id"),
                    nowrap: true,
                    ...sortColumn(NUMBER),
                    cell: ({ user }) =>
                      courseId ? (
                        <Link href={courseUserStatusSummaryRoute(courseId, user.user_id)}>
                          {shortId(user.user_id)}
                        </Link>
                      ) : (
                        shortId(user.user_id)
                      ),
                  },
                  {
                    header: t("student-name"),
                    ...sortColumn(NAME),
                    cell: ({ user }) => `${user.first_name ?? ""} ${user.last_name ?? ""}`,
                  },
                  {
                    header: t("label-email"),
                    ...sortColumn(EMAIL),
                    breakAnywhere: true,
                    cell: ({ user }) => user.email,
                  },
                  {
                    header: t(SCORE),
                    ...sortColumn(SCORE),
                    cell: ({ totalPoints }) =>
                      `${roundDown(totalPoints, 2)}/${instanceTotalPoints} (${
                        instanceTotalPoints > 0
                          ? roundDown((totalPoints / instanceTotalPoints) * 100, 0)
                          : 0
                      }%)`,
                  },
                  ...data.chapter_points.map((c): TableColumn<ProcessedUser> => ({
                    header: t("title-chapter-only-number", {
                      "chapter-number": c.chapter_number,
                    }),
                    ...sortColumn(chapterSortKey(c.chapter_number)),
                    cell: ({ user }) =>
                      `${roundDown(data.user_chapter_points[user.user_id]?.[c.id] || 0, 2)}/${c.score_total}`,
                  })),
                ]}
              />
            </>
          )
        }}
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(CourseInstancePointsList))
