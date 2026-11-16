"use client"

import { css, cx } from "@emotion/css"
import { type UseQueryResult, useQuery, useQueryClient } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { BUTTON_SECONDARY } from "@/components/credit-registration/constants"
import { headingCss, noteCss, sectionCss } from "@/components/credit-registration/styles"
import {
  getMyOldVersionProgressOptions,
  getMyOldVersionProgressQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import type {
  MoocFiCourseProgress,
  MoocFiMaterialLink,
  OldVersionProgress,
  TmcMoocFiCourseProgress,
} from "@/generated/api/types.generated"
import { Badge, Button, Link, Spinner, TONE } from "@/shared-module/components"
import { formatPoints } from "@/utils/completionThresholds"

import {
  studiesCardBodyCss,
  studiesCardCompletedHeaderCss,
  studiesCardCss,
  studiesCardHeaderCss,
} from "./cardSurface"
import { sameLanguage } from "./language"
import { FIGURE_WIDTH, ModuleDimension, ModuleFigure } from "./ModuleFigures"

/** Each load asks both upstreams, which are slow and rate limited per user. */
const STALE_TIME_MS = 10 * 60 * 1000

const courseListCss = css`
  display: grid;
  gap: var(--space-4-5);
`

const titleRowCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-3);
`

const courseTitleCss = css`
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--color-gray-700);
  font-size: var(--font-size-3);
  font-weight: 600;
  line-height: 1.3;
`

const figureCss = css`
  max-width: ${FIGURE_WIDTH};
`

/** The reader's language version of the material, else the first one. */
const materialLinkFor = (
  links: MoocFiMaterialLink[],
  readerLanguage: string | undefined,
): MoocFiMaterialLink | null =>
  links.find((link) => sameLanguage(link.language, readerLanguage)) ?? links[0] ?? null

/**
 * The student's courses on the old version of the platform. Fetched only when the student asks:
 * the upstreams are slow and rate limited, and most students have nothing there.
 */
const OldVersionCoursesSection: React.FC = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  // Coming back within the stale time shows the cards again without another press.
  const [isRequested, setIsRequested] = useState(
    () => queryClient.getQueryData(getMyOldVersionProgressQueryKey()) !== undefined,
  )
  const query = useQuery({
    ...getMyOldVersionProgressOptions(),
    enabled: isRequested,
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
    retry: false,
  })

  return (
    <section className={sectionCss} aria-label={t("heading-courses-on-old-version")}>
      <h2 className={headingCss}>{t("heading-courses-on-old-version")}</h2>
      {isRequested ? (
        <OldVersionCourses query={query} />
      ) : (
        <div>
          <Button variant={BUTTON_SECONDARY} size="medium" onClick={() => setIsRequested(true)}>
            {t("button-show-courses-on-old-version")}
          </Button>
        </div>
      )}
    </section>
  )
}

const OldVersionCourses: React.FC<{
  query: UseQueryResult<OldVersionProgress>
}> = ({ query }) => {
  const { t } = useTranslation()
  if (query.isPending) {
    return <Spinner label={t("loading-courses-on-old-version")} delayMs={0} />
  }
  // A failed request, the rate limit's 429 included, says as little as both upstreams failing.
  const progress = query.data
  const hasFailedUpstream =
    !progress ||
    progress.mooc_fi_status === "unavailable" ||
    progress.tmc_mooc_fi_status === "unavailable"
  const hasCourses = progress && (progress.mooc_fi.length > 0 || progress.tmc_mooc_fi.length > 0)

  if (!hasCourses) {
    return (
      <p className={noteCss}>
        {hasFailedUpstream
          ? t("courses-on-old-version-unavailable")
          : t("courses-on-old-version-none")}
      </p>
    )
  }
  return (
    <>
      {hasFailedUpstream ? (
        <p className={noteCss}>{t("courses-on-old-version-partly-unavailable")}</p>
      ) : null}
      <div className={courseListCss}>
        {progress.mooc_fi.map((course) => (
          <MoocFiCourseCard key={course.course_id} course={course} />
        ))}
        {progress.tmc_mooc_fi.map((course, index) => (
          // tmc.mooc.fi courses carry no id here, and two can share a title.
          <TmcCourseCard key={`${course.name}-${index}`} course={course} />
        ))}
      </div>
    </>
  )
}

const CourseCard: React.FC<{
  name: string
  url: string | null
  completed: boolean
  children?: React.ReactNode
}> = ({ name, url, completed, children }) => {
  const { t } = useTranslation()
  return (
    <article className={studiesCardCss}>
      <header className={cx(studiesCardHeaderCss, completed && studiesCardCompletedHeaderCss)}>
        <div className={titleRowCss}>
          <h3 className={courseTitleCss}>{url ? <Link href={url}>{name}</Link> : name}</h3>
          {completed ? <Badge tone={TONE.SUCCESS}>{t("label-completed")}</Badge> : null}
        </div>
      </header>
      {children ? <div className={studiesCardBodyCss}>{children}</div> : null}
    </article>
  )
}

const MoocFiCourseCard: React.FC<{ course: MoocFiCourseProgress }> = ({ course }) => {
  const { t, i18n } = useTranslation()
  const maxPoints = course.max_points ?? 0
  const points = course.points ?? null
  const figure =
    points === null ? null : (
      <div className={figureCss}>
        <ModuleDimension
          label={t("label-points")}
          value={points}
          maxValue={maxPoints}
          valueLabel={
            maxPoints > 0
              ? t("value-of-maximum", {
                  value: formatPoints(points, i18n.language),
                  maximum: formatPoints(maxPoints, i18n.language),
                })
              : formatPoints(points, i18n.language)
          }
          threshold={null}
          showBar={maxPoints > 0}
        />
      </div>
    )
  const materialLink = materialLinkFor(course.material_links, i18n.language)
  // The tmc.mooc.fi courses behind it are not listed; one of their pages still beats no link.
  const tmcUrl = course.tmc_mooc_fi_courses.find((tmcCourse) => tmcCourse.url)?.url ?? null
  return (
    <CourseCard
      name={materialLink?.course_name || course.name}
      url={materialLink?.url ?? tmcUrl}
      completed={course.completed}
    >
      {figure}
    </CourseCard>
  )
}

const TmcCourseCard: React.FC<{ course: TmcMoocFiCourseProgress }> = ({ course }) => {
  const { t, i18n } = useTranslation()
  return (
    <CourseCard name={course.name} url={course.url ?? null} completed={false}>
      <ModuleFigure
        label={t("label-points")}
        value={formatPoints(course.awarded_points, i18n.language)}
      />
    </CourseCard>
  )
}

export default OldVersionCoursesSection
