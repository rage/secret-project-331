"use client"

import { css, cx } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { headingCss, noteCss, sectionCss } from "@/components/credit-registration/styles"
import { getMyOldVersionProgressOptions } from "@/generated/api/@tanstack/react-query.generated"
import type {
  MoocFiCourseProgress,
  MoocFiMaterialLink,
  TmcMoocFiCourseProgress,
} from "@/generated/api/types.generated"
import { Badge, Link, Meter, METER_KIND, Spinner, TONE } from "@/shared-module/components"
import { formatPoints } from "@/utils/completionThresholds"

import {
  studiesCardBodyCss,
  studiesCardCompletedHeaderCss,
  studiesCardCss,
  studiesCardHeaderCss,
} from "./cardSurface"
import { ModuleFigure } from "./StudiesCourseCard"

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

/** Same width as a measured dimension on this platform's cards. */
const figureCss = css`
  max-width: 17rem;
`

/**
 * The link to the reader's language version of the material, else the first one. mooc.fi names
 * languages like `fi_FI`, so only the primary subtag is compared.
 */
const materialLinkFor = (
  links: MoocFiMaterialLink[],
  readerLanguage: string | undefined,
): string | null => {
  const readerPrimary = readerLanguage?.split("-")[0]
  const matching = links.find((link) => link.language.split(/[_-]/)[0] === readerPrimary)
  return (matching ?? links[0])?.url ?? null
}

/**
 * The student's courses on the old version of the platform, loaded on their own so the slow
 * upstreams never hold up the rest of the page. Renders nothing when the student has none there.
 */
const OldVersionCoursesSection: React.FC = () => {
  const { t } = useTranslation()
  const query = useQuery({
    ...getMyOldVersionProgressOptions(),
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
    retry: false,
  })
  const heading = <h2 className={headingCss}>{t("heading-courses-on-old-version")}</h2>

  if (query.isPending) {
    return <Spinner label={t("loading-courses-on-old-version")} />
  }

  const progress = query.data
  const statuses = progress ? [progress.mooc_fi_status, progress.tmc_mooc_fi_status] : []
  const unavailableCount = statuses.filter((status) => status === "unavailable").length
  const hasCourses = progress && (progress.mooc_fi.length > 0 || progress.tmc_mooc_fi.length > 0)

  if (!progress || (!hasCourses && unavailableCount > 0)) {
    return (
      <section className={sectionCss} aria-label={t("heading-courses-on-old-version")}>
        {heading}
        <p className={noteCss}>{t("courses-on-old-version-unavailable")}</p>
      </section>
    )
  }
  if (!hasCourses) {
    return null
  }

  return (
    <section className={sectionCss} aria-label={t("heading-courses-on-old-version")}>
      {heading}
      {unavailableCount > 0 ? (
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
    </section>
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
  let figure: React.ReactNode = null
  if (points !== null && maxPoints > 0) {
    figure = (
      <Meter
        className={figureCss}
        kind={METER_KIND.PROGRESS}
        label={t("label-points")}
        value={points}
        maxValue={maxPoints}
        valueLabel={t("value-of-maximum", {
          value: formatPoints(points, i18n.language),
          maximum: formatPoints(maxPoints, i18n.language),
        })}
        tone={TONE.SUCCESS}
      />
    )
  } else if (points !== null) {
    figure = <ModuleFigure label={t("label-points")} value={formatPoints(points, i18n.language)} />
  }
  return (
    <CourseCard
      name={course.name}
      url={materialLinkFor(course.material_links, i18n.language)}
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
