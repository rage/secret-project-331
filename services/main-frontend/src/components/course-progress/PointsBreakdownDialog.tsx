"use client"

import { css, cx } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import type { TFunction } from "i18next"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import { getCourseMaterialCourseModulePointsBreakdownOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import type {
  ChapterPointsBreakdown,
  ExercisePointsBreakdown,
  ExercisePointsStatus,
  PagePointsBreakdown,
} from "@/generated/course-material-api/types.generated"
import { baseTheme, headingFont, secondaryFont } from "@/shared-module/common/styles"
import { Dialog, Link, type LinkAppearance, QueryResult } from "@/shared-module/components"
import { formatPoints } from "@/utils/completionThresholds"
import { coursePageSectionRoute } from "@/utils/course-material/routing"

import { hasChartMax, type ProgressMeasure } from "./progressText"
import { INLINE_ELEMENT, progressColors } from "./progressTheme"

/** Which course instance a module's points breakdown is for, and where its exercise links lead. */
export interface CourseInstanceLocation {
  courseInstanceId: string
  organizationSlug: string
  courseSlug: string
}

/** One course module's points breakdown: whose data to fetch and where to link. */
export interface PointsBreakdownScope extends CourseInstanceLocation {
  courseModuleId: string
}

export interface PointsBreakdownDialogProps {
  scope: PointsBreakdownScope
  /** The module's points as the card states them; the header repeats the total. */
  points: ProgressMeasure
  /** The module's exercises attempted as the card states them; the header repeats the total. */
  exercises: ProgressMeasure
  open: boolean
  onClose: () => void
}

/**
 * The user's points in one module, exercise by exercise under their chapters and pages.
 * Fetches only while open; following an exercise link closes it.
 */
const PointsBreakdownDialog: React.FC<PointsBreakdownDialogProps> = ({ open, ...props }) =>
  open ? <OpenPointsBreakdownDialog {...props} /> : null

export default PointsBreakdownDialog

const OpenPointsBreakdownDialog: React.FC<Omit<PointsBreakdownDialogProps, "open">> = ({
  scope,
  points,
  exercises,
  onClose,
}) => {
  const { t } = useTranslation()
  const query = useQuery(
    getCourseMaterialCourseModulePointsBreakdownOptions({
      path: {
        course_instance_id: scope.courseInstanceId,
        course_module_id: scope.courseModuleId,
      },
    }),
  )
  const isEmpty = query.data?.length === 0
  return (
    <Dialog
      open
      onClose={onClose}
      isDismissable
      className={cx(query.isPending && loadingDialogCss, dialogCss)}
      title={<DialogTitle totals={isEmpty ? null : { points, exercises }} />}
    >
      <QueryResult
        query={query}
        minHeight={LOADING_MIN_HEIGHT_PX}
        emptyFallback={<p className={emptyCss}>{t("points-breakdown-empty")}</p>}
      >
        {(chapters) => (
          <PointsBreakdownList chapters={chapters} location={scope} onNavigate={onClose} />
        )}
      </QueryResult>
    </Dialog>
  )
}

// Stands in for a value in a translated string, so that value can be rendered as its own element.
const SLOT = "\u2063"

/** `text` with the `SLOT` it was interpolated with replaced by `node`. */
function fillSlot(text: string, node: React.ReactNode): React.ReactNode {
  const [before, ...after] = text.split(SLOT)
  return (
    <>
      {before}
      {node}
      {after.join("")}
    </>
  )
}

const DialogTitle: React.FC<{
  totals: { points: ProgressMeasure; exercises: ProgressMeasure } | null
}> = ({ totals }) => {
  const { t, i18n } = useTranslation()
  let pointsSummary: React.ReactNode = null
  let exercisesSummary: React.ReactNode = null
  if (totals !== null) {
    const { points, exercises } = totals
    const givenPoints = points.given ?? 0
    pointsSummary = fillSlot(
      hasChartMax(points.max)
        ? t("progress-points-summary", {
            given: SLOT,
            max: formatPoints(points.max, i18n.language),
            count: points.max,
          })
        : t("progress-points-given", { given: SLOT, count: givenPoints }),
      <span className={summaryGivenCss}>{formatPoints(givenPoints, i18n.language)}</span>,
    )
    if (hasChartMax(exercises.max)) {
      exercisesSummary = fillSlot(
        t("points-breakdown-exercises-attempted", {
          given: SLOT,
          max: exercises.max,
          count: exercises.max,
        }),
        <span className={summaryGivenCss}>{exercises.given ?? 0}</span>,
      )
    }
  }
  return (
    <>
      <span className={titleTextCss}>{t("heading-all-exercises")}</span>
      {pointsSummary !== null && (
        <span className={subtitleCss}>
          <span className={summaryCss}>{pointsSummary}</span>
          {exercisesSummary !== null && (
            <>
              {/* The two figures sit at opposite ends; screen readers get a pause instead. */}
              <VisuallyHidden elementType={INLINE_ELEMENT}>, </VisuallyHidden>
              <span className={summaryCss}>{exercisesSummary}</span>
            </>
          )}
        </span>
      )}
    </>
  )
}

interface PointsBreakdownListProps {
  chapters: ChapterPointsBreakdown[]
  location: CourseInstanceLocation
  onNavigate: () => void
}

const PointsBreakdownList: React.FC<PointsBreakdownListProps> = ({
  chapters,
  location,
  onNavigate,
}) => {
  const { t } = useTranslation()
  return (
    <div className={rootCss}>
      {chapters.map((chapter) => (
        <section key={chapter.chapter_id} className={chapterCss}>
          <div className={chapterHeadCss}>
            <h3 className={chapterHeadingCss}>
              {fillSlot(
                t("chapter-chapter-number-chapter-name", {
                  chapterNumber: chapter.chapter_number,
                  chapterName: SLOT,
                }),
                <bdi>{chapter.name}</bdi>,
              )}
            </h3>
            <Points
              given={chapter.score_given}
              max={chapter.score_maximum}
              level={POINTS_LEVEL.CHAPTER}
            />
          </div>
          {chapter.pages.map((page) => (
            <PageSection
              key={page.page_id}
              page={page}
              location={location}
              onNavigate={onNavigate}
            />
          ))}
        </section>
      ))}
    </div>
  )
}

const PageSection: React.FC<{
  page: PagePointsBreakdown
  location: CourseInstanceLocation
  onNavigate: () => void
}> = ({ page, location, onNavigate }) => (
  <div className={pageCss}>
    <div className={pageHeadCss}>
      <h4 className={pageHeadingCss}>
        <bdi>{page.title}</bdi>
      </h4>
      <Points given={page.score_given} max={page.score_maximum} level={POINTS_LEVEL.PAGE} />
    </div>
    <ol className={exerciseListCss}>
      {page.exercises.map((exercise, index) => (
        <ExerciseRow
          key={exercise.exercise_id}
          exercise={exercise}
          position={index + 1}
          href={coursePageSectionRoute(
            location.organizationSlug,
            location.courseSlug,
            page.url_path,
            exercise.exercise_id,
          )}
          onNavigate={onNavigate}
        />
      ))}
    </ol>
  </div>
)

const ExerciseRow: React.FC<{
  exercise: ExercisePointsBreakdown
  /** 1-based place on its page, as the page's own exercise list numbers it. */
  position: number
  href: string
  onNavigate: () => void
}> = ({ exercise, position, href, onNavigate }) => {
  const { t } = useTranslation()
  const status = STATUS_PRESENTATION[exercise.status]
  const isFullPoints = exercise.score_maximum > 0 && exercise.score_given >= exercise.score_maximum
  return (
    <li className={exerciseRowCss}>
      <span className={cx(positionCss, isFullPoints && fullPointsPositionCss)} aria-hidden="true">
        {position}
      </span>
      <span className={exerciseTextCss}>
        <Link
          href={href}
          appearance={EXERCISE_LINK_APPEARANCE}
          className={exerciseLinkCss}
          onClick={onNavigate}
        >
          <bdi>{exercise.name}</bdi>
        </Link>
        <VisuallyHidden elementType={INLINE_ELEMENT}>, </VisuallyHidden>
        <span className={exerciseMetaCss}>
          <span className={statusToneCss[status.tone]}>{status.label(t)}</span>
          {exercise.attempts > 0 && (
            <>
              <VisuallyHidden elementType={INLINE_ELEMENT}>, </VisuallyHidden>
              <span className={attemptsCss}>
                <span aria-hidden="true">{MIDDLE_DOT} </span>
                {(exercise.attempts_limit ?? null) === null
                  ? t("points-breakdown-attempts", { count: exercise.attempts })
                  : t("points-breakdown-attempts-of-limit", {
                      used: exercise.attempts,
                      count: exercise.attempts_limit,
                    })}
              </span>
            </>
          )}
        </span>
      </span>
      <VisuallyHidden elementType={INLINE_ELEMENT}>, </VisuallyHidden>
      <Points
        given={status.isFinal || exercise.score_given > 0 ? exercise.score_given : null}
        max={exercise.score_maximum}
        level={POINTS_LEVEL.EXERCISE}
      />
    </li>
  )
}

/**
 * "given / max" with the slash at the same place on every row, and the full phrase for screen
 * readers. `given` is `null` while the points are not final.
 */
const Points: React.FC<{ given: number | null; max: number; level: PointsLevel }> = ({
  given,
  max,
  level,
}) => {
  const { t, i18n } = useTranslation()
  const maxText = formatPoints(max, i18n.language)
  const hasPoints = given !== null && given > 0
  return (
    <span className={cx(pointsCss, pointsLevelCss[level])}>
      <span className={cx(pointsGivenCss, !hasPoints && noPointsCss)} aria-hidden="true">
        {given === null ? EN_DASH : formatPoints(given, i18n.language)}
      </span>
      <span className={pointsMaxCss} aria-hidden="true">
        {t("progress-out-of-max", { max: maxText })}
      </span>
      <VisuallyHidden elementType={INLINE_ELEMENT}>
        {given === null
          ? t("points-breakdown-points-pending", { max: maxText, count: max })
          : t("progress-points-valuetext", {
              given: formatPoints(given, i18n.language),
              max: maxText,
              count: max,
            })}
      </VisuallyHidden>
    </span>
  )
}

/** Where a points figure sits, which sets its size and weight. */
type PointsLevel = "chapter" | "page" | "exercise"

const POINTS_LEVEL = {
  CHAPTER: "chapter",
  PAGE: "page",
  EXERCISE: "exercise",
} as const satisfies Record<string, PointsLevel>

type StatusTone = "quiet" | "action" | "error"

interface StatusPresentation {
  tone: StatusTone
  label: (t: TFunction) => string
  /** The points will not change, so they are shown; otherwise a dash stands in for them. */
  isFinal: boolean
}

// Only what the student must act on is emphasised; everything else, finished or waiting, is quiet.
const STATUS_PRESENTATION: Record<ExercisePointsStatus, StatusPresentation> = {
  NotStarted: {
    tone: "quiet",
    label: (t) => t("points-breakdown-status-not-started"),
    isFinal: false,
  },
  GradingInProgress: {
    tone: "quiet",
    label: (t) => t("points-breakdown-status-grading-in-progress"),
    isFinal: false,
  },
  GradingFailed: {
    tone: "error",
    label: (t) => t("points-breakdown-status-grading-failed"),
    isFinal: false,
  },
  PeerReviewToGive: {
    tone: "action",
    label: (t) => t("points-breakdown-status-peer-review-to-give"),
    isFinal: false,
  },
  SelfReviewToGive: {
    tone: "action",
    label: (t) => t("points-breakdown-status-self-review-to-give"),
    isFinal: false,
  },
  WaitingForPeerReviews: {
    tone: "quiet",
    label: (t) => t("points-breakdown-status-waiting-for-peer-reviews"),
    isFinal: false,
  },
  WaitingForTeacherGrading: {
    tone: "quiet",
    label: (t) => t("points-breakdown-status-waiting-for-teacher-grading"),
    isFinal: false,
  },
  NotAnswered: { tone: "quiet", label: (t) => t("points-breakdown-status-closed"), isFinal: true },
  Done: { tone: "quiet", label: (t) => t("points-breakdown-status-done"), isFinal: true },
}

// The row draws the link's hover and focus, so the name carries no link colour of its own.
const EXERCISE_LINK_APPEARANCE: LinkAppearance = "inherit"

const EN_DASH = "–"
const MIDDLE_DOT = "·"

/** Room for the spinner under the skeleton bars instead of on top of them. */
const LOADING_MIN_HEIGHT_PX = 240

const dialogCss = css`
  --dialog-width-cap: 46rem;

  @media (max-width: 30rem) {
    width: 100vw;
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
  }
`

// Most modules list more exercises than fit, so loading at full height spares them a jump. Comes
// before `dialogCss` in `cx`, so the full-screen phone height still wins.
const loadingDialogCss = css`
  height: 90vh;
`

const titleTextCss = css`
  display: block;
  font: 500 1.5rem/1.25 ${headingFont};
  color: ${progressColors.heading};
`

const subtitleCss = css`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0 1.5rem;
  margin-block-start: 0.25rem;
  font: 400 0.9375rem/1.4 ${secondaryFont};
  color: ${progressColors.mutedText};
`

const summaryCss = css`
  white-space: nowrap;
`

const summaryGivenCss = css`
  font-weight: 600;
  color: ${progressColors.text};
`

const emptyCss = css`
  margin: 0;
  padding: 2.5rem 0 1.5rem;
  text-align: center;
  font-family: ${secondaryFont};
  color: ${progressColors.mutedText};
`

const rootCss = css`
  --row-padding-inline: 1rem;
  --row-inset: 2px;

  padding-block: 0.5rem 0.75rem;
  font-family: ${secondaryFont};
  color: ${progressColors.text};
`

const chapterCss = css`
  & + & {
    margin-block-start: 2.25rem;
  }
`

// Head, page head and row all end in the same points column, so the slashes line up down the list.
const TRAILING_POINTS_ROW = `
  display: flex;
  align-items: baseline;
  gap: 1rem;
`

const chapterHeadCss = css`
  ${TRAILING_POINTS_ROW}
  margin-block-end: 0.75rem;
  padding-inline-end: var(--row-padding-inline);
`

const chapterHeadingCss = css`
  flex: 1;
  min-width: 0;
  margin: 0;
  font: 500 1.25rem/1.3 ${headingFont};
  color: ${progressColors.heading};
`

const pageCss = css`
  border-radius: 0.5rem;
  background: ${progressColors.panel};
  overflow: hidden;

  & + & {
    margin-block-start: 0.75rem;
  }
`

const pageHeadCss = css`
  ${TRAILING_POINTS_ROW}
  padding: 0.75rem var(--row-padding-inline) 0.5rem;
`

const pageHeadingCss = css`
  flex: 1;
  min-width: 0;
  margin: 0;
  font: 600 0.9375rem/1.35 ${headingFont};
  color: ${baseTheme.colors.gray[600]};
`

const exerciseListCss = css`
  display: grid;
  gap: var(--row-inset);
  margin: 0;
  padding: 0 var(--row-inset) var(--row-inset);
  list-style: none;
`

const exerciseRowCss = css`
  ${TRAILING_POINTS_ROW}
  position: relative;
  /* Less the inset, so the points column lines up with the page head's. */
  padding: 0.75rem calc(var(--row-padding-inline) - var(--row-inset));
  border-radius: 0.375rem;
  background: var(--color-clear-50);

  &:hover {
    background: ${baseTheme.colors.blue[75]};
  }

  &:has(a:focus-visible) {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: -2px;
  }

  @media (forced-colors: active) {
    border: 1px solid CanvasText;
  }
`

const positionCss = css`
  flex: none;
  align-self: flex-start;
  display: grid;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: ${baseTheme.colors.blue[100]};
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: ${baseTheme.colors.gray[600]};
`

const fullPointsPositionCss = css`
  background: ${progressColors.fill};
  color: var(--color-clear-50);
`

const exerciseTextCss = css`
  flex: 1;
  min-width: 0;
`

// The name is the row's only link; its hit area stretches over the whole row.
const exerciseLinkCss = css`
  display: block;
  overflow-wrap: anywhere;
  font-size: 1rem;
  line-height: 1.4;
  color: ${progressColors.text};
  text-decoration: none;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
  }

  &:focus-visible {
    outline: none;
  }
`

const exerciseMetaCss = css`
  display: flex;
  flex-wrap: wrap;
  column-gap: 0.25rem;
  margin-block-start: 0.125rem;
  font-size: 0.8125rem;
  line-height: 1.4;
  color: ${progressColors.mutedText};
`

// The dot travels with the attempts, so a wrapped line never ends in one.
const attemptsCss = css`
  white-space: nowrap;
`

const statusToneCss: Record<StatusTone, string | undefined> = {
  quiet: undefined,
  action: css`
    font-weight: 600;
    color: ${progressColors.heading};
  `,
  error: css`
    font-weight: 600;
    color: ${progressColors.error};
  `,
}

// Physical order pinned: in RTL too the fraction reads "given / max" left to right.
const pointsCss = css`
  flex: none;
  display: inline-grid;
  grid-template-columns: 2.75rem 2.25rem;
  direction: ltr;
  unicode-bidi: isolate;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

const pointsGivenCss = css`
  text-align: right;
  font-weight: 600;
  color: ${progressColors.text};
`

const noPointsCss = css`
  font-weight: 400;
  color: ${progressColors.mutedText};
`

const pointsMaxCss = css`
  padding-left: 0.3rem;
  text-align: left;
  color: ${progressColors.mutedText};
`

const pointsLevelCss: Record<PointsLevel, string> = {
  chapter: css`
    font-size: 1.0625rem;
  `,
  page: css`
    font-size: 0.875rem;
  `,
  exercise: css`
    font-size: 0.9375rem;
  `,
}
