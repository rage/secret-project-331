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
import { headingFont, secondaryFont } from "@/shared-module/common/styles"
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
  /** Shown under the title, so several modules' dialogs stay distinct. */
  moduleName: string
  /** The module's points as the card states them; the header repeats the total. */
  points: ProgressMeasure
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
  moduleName,
  points,
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
      title={<DialogTitle moduleName={moduleName} points={isEmpty ? null : points} />}
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

const DialogTitle: React.FC<{ moduleName: string; points: ProgressMeasure | null }> = ({
  moduleName,
  points,
}) => {
  const { t, i18n } = useTranslation()
  let summary: React.ReactNode = null
  if (points !== null) {
    const givenCount = points.given ?? 0
    const given = <span className={summaryGivenCss}>{formatPoints(givenCount, i18n.language)}</span>
    const text = hasChartMax(points.max)
      ? t("progress-points-summary", {
          given: SLOT,
          max: formatPoints(points.max, i18n.language),
          count: points.max,
        })
      : t("progress-points-given", { given: SLOT, count: givenCount })
    summary = fillSlot(text, given)
  }
  return (
    <>
      <span className={titleTextCss}>{t("heading-all-exercises")}</span>
      <span className={subtitleCss}>
        <bdi>{moduleName}</bdi>
        {summary !== null && (
          <>
            {MIDDLE_DOT_SEPARATOR}
            <span className={summaryCss}>{summary}</span>
          </>
        )}
      </span>
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
            <div className={chapterTitleRowCss}>
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
            <div className={columnLabelsCss} aria-hidden="true">
              <span className={statusLabelCss}>{t("status")}</span>
              <span className={attemptsLabelCss}>{t("attempts")}</span>
              <span className={pointsLabelCss}>{t("label-points")}</span>
            </div>
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
    <ul className={exerciseListCss}>
      {page.exercises.map((exercise) => (
        <ExerciseRow
          key={exercise.exercise_id}
          exercise={exercise}
          href={coursePageSectionRoute(
            location.organizationSlug,
            location.courseSlug,
            page.url_path,
            exercise.exercise_id,
          )}
          onNavigate={onNavigate}
        />
      ))}
    </ul>
  </div>
)

const ExerciseRow: React.FC<{
  exercise: ExercisePointsBreakdown
  href: string
  onNavigate: () => void
}> = ({ exercise, href, onNavigate }) => {
  const { t } = useTranslation()
  const status = STATUS_PRESENTATION[exercise.status]
  return (
    <li className={exerciseRowCss}>
      <Link
        href={href}
        appearance={EXERCISE_LINK_APPEARANCE}
        className={exerciseNameCss}
        onClick={onNavigate}
      >
        <bdi>{exercise.name}</bdi>
      </Link>
      <span className={exerciseMetaCss}>
        <span className={statusToneCss[status.tone]}>{status.label(t)}</span>
        {exercise.attempts > 0 && (
          <>
            <ListSeparator />
            <Attempts used={exercise.attempts} limit={exercise.attempts_limit ?? null} />
          </>
        )}
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

/** A pause for screen readers, and on narrow screens a visible dot between status and attempts. */
const ListSeparator: React.FC = () => (
  <>
    <VisuallyHidden elementType={INLINE_ELEMENT}>, </VisuallyHidden>
    <span className={metaDotCss} aria-hidden="true">
      {MIDDLE_DOT}
    </span>
  </>
)

/** Columns show "used / limit"; the stacked layout and screen readers get the phrase. */
const Attempts: React.FC<{ used: number; limit: number | null }> = ({ used, limit }) => {
  const { t } = useTranslation()
  const phrase =
    limit === null
      ? t("points-breakdown-attempts", { count: used })
      : t("points-breakdown-attempts-of-limit", { used, count: limit })
  return (
    <span className={attemptsCss}>
      <span className={attemptsFractionCss} aria-hidden="true">
        <span className={attemptsUsedCss}>{used}</span>
        {limit !== null && <span className={attemptsLimitCss}>/ {limit}</span>}
      </span>
      <span className={attemptsPhraseCss}>{phrase}</span>
    </span>
  )
}

/**
 * "given / max" as two cells of the list's shared points columns, so every slash lines up, with the
 * full phrase for screen readers. `given` is `null` while the points are not final.
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
      <span
        className={cx(pointsGivenCss, hasPoints ? earnedPointsCss[level] : noPointsCss)}
        aria-hidden="true"
      >
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

/** Where a points figure sits, which sets its size and how much its given value stands out. */
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

// A row per exercise; underlining every name would be the loudest thing in the dialog.
const EXERCISE_LINK_APPEARANCE: LinkAppearance = "quiet"

const EN_DASH = "\u2013"
const MIDDLE_DOT = "\u00B7"
const MIDDLE_DOT_SEPARATOR = ` ${MIDDLE_DOT} `

/** Room for the spinner under the skeleton bars instead of on top of them. */
const LOADING_MIN_HEIGHT_PX = 240

/** From this width the rows are a table of columns; below it status and attempts go under the name. */
const COLUMNS_FROM = "@media (min-width: 46.5rem)"

const dialogCss = css`
  --dialog-width-cap: 52rem;

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
  display: block;
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

/*
  Every level of the list is a subgrid of one grid, so the points columns are as wide as the widest
  value anywhere and each slash lines up down the whole dialog. The given and max tracks swap in
  RTL so the fraction still reads "given / max" left to right.
*/
const SUBGRID = `
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
`

// Only on the innermost rows: Chrome misplaces a whole subtree when nested subgrids all align to
// baselines.
const ROW_BASELINES = `
  align-items: baseline;
`

const rootCss = css`
  --points-tracks: [points-start given] auto [max] auto [points-end];

  display: grid;
  /* Cancels the body's top padding, so a chapter head rests where it sticks and never jumps. */
  margin-block-start: calc(-1 * var(--space-4));
  grid-template-columns: [name-start] minmax(0, 1fr) [name-end attempts-end] 1rem var(
      --points-tracks
    );
  font-family: ${secondaryFont};
  color: ${progressColors.text};

  &:dir(rtl) {
    --points-tracks: [points-start max] auto [given] auto [points-end];
  }

  ${COLUMNS_FROM} {
    grid-template-columns:
      [name-start] minmax(0, 1fr) [name-end] 1.5rem [status-start] 11rem [status-end] 1.5rem
      [attempts-start] 4.5rem [attempts-end] 1.5rem var(--points-tracks);
  }
`

const chapterCss = css`
  ${SUBGRID}

  & + & {
    margin-block-start: 1.5rem;
  }
`

const chapterHeadCss = css`
  ${SUBGRID}
  padding-block: 1.25rem 0.5rem;
  /* Under the column labels, so rows scrolling under a stuck head vanish at a rule. */
  border-block-end: 3px solid ${progressColors.rule};
  background: var(--color-clear-50);

  ${COLUMNS_FROM} {
    position: sticky;
    /* The dialog body's top padding; without it the head would stop that far below the edge. */
    top: calc(-1 * var(--space-4));
    z-index: 1;
  }
`

const chapterTitleRowCss = css`
  ${SUBGRID}
  ${ROW_BASELINES}
`

const headingSpanCss = `
  grid-column: name-start / attempts-end;
  min-width: 0;
  margin: 0;
`

const chapterHeadingCss = css`
  ${headingSpanCss}
  font: 500 1.25rem/1.3 ${headingFont};
  color: ${progressColors.heading};
`

const columnLabelsCss = css`
  display: none;

  ${COLUMNS_FROM} {
    ${SUBGRID}
    ${ROW_BASELINES}
    padding-block-start: 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    line-height: 1.3;
    color: ${progressColors.mutedText};
  }
`

const statusLabelCss = css`
  grid-column: status-start;
`

const attemptsLabelCss = css`
  grid-column: attempts-start;
  text-align: center;
`

const pointsLabelCss = css`
  grid-column: points-start / points-end;
  text-align: center;
`

const pageCss = css`
  ${SUBGRID}
  margin-block-start: 0.75rem;

  & + & {
    margin-block-start: 1.5rem;
  }
`

const pageHeadCss = css`
  ${SUBGRID}
  ${ROW_BASELINES}
  padding-block-end: 0.125rem;
`

const pageHeadingCss = css`
  ${headingSpanCss}
  font: 600 0.9375rem/1.35 ${headingFont};
  color: ${progressColors.text};
`

const exerciseListCss = css`
  ${SUBGRID}
  margin: 0;
  padding: 0;
  list-style: none;
`

const exerciseRowCss = css`
  ${SUBGRID}
  ${ROW_BASELINES}
  padding-block: 0.625rem;

  & + & {
    border-block-start: 1px solid ${progressColors.divider};
  }
`

const exerciseNameCss = css`
  grid-column: name-start / name-end;
  justify-self: start;
  min-width: 0;
  overflow-wrap: anywhere;
  font-weight: 400;
  line-height: 1.4;
`

const exerciseMetaCss = css`
  grid-area: 2 / name-start / auto / points-end;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.125rem 0.5rem;
  margin-block-start: 0.25rem;
  font-size: 0.875rem;
  line-height: 1.3;

  ${COLUMNS_FROM} {
    display: contents;
  }
`

const statusBaseCss = css`
  ${COLUMNS_FROM} {
    grid-column: status-start;
  }
`

const statusToneCss: Record<StatusTone, string> = {
  quiet: cx(
    statusBaseCss,
    css`
      color: ${progressColors.mutedText};
    `,
  ),
  action: cx(
    statusBaseCss,
    css`
      font-weight: 600;
      color: ${progressColors.text};
    `,
  ),
  error: cx(
    statusBaseCss,
    css`
      font-weight: 600;
      color: ${progressColors.error};
    `,
  ),
}

const metaDotCss = css`
  color: ${progressColors.mutedText};

  ${COLUMNS_FROM} {
    display: none;
  }
`

const attemptsCss = css`
  color: ${progressColors.mutedText};

  ${COLUMNS_FROM} {
    grid-column: attempts-start;
  }
`

const attemptsFractionCss = css`
  display: none;

  ${COLUMNS_FROM} {
    display: grid;
    grid-template-columns: 1fr 1fr;
    direction: ltr;
    font-variant-numeric: tabular-nums;
  }
`

const attemptsPhraseCss = css`
  ${COLUMNS_FROM} {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
`

const pointsCss = css`
  display: contents;
`

const fractionGivenCss = `
  text-align: right;
  white-space: nowrap;
`

// Physical left, with the direction pinned: in RTL too the slash leads, next to the given value.
const fractionMaxCss = `
  padding-left: 0.3rem;
  direction: ltr;
  unicode-bidi: isolate;
  text-align: left;
  white-space: nowrap;
  color: ${progressColors.mutedText};
`

// Rows pinned: in RTL the max track comes first, and auto-placement would push it to a new row.
const pointsGivenCss = css`
  grid-area: 1 / given;
  ${fractionGivenCss}
  font-variant-numeric: tabular-nums;
`

const noPointsCss = css`
  color: ${progressColors.mutedText};
`

const pointsMaxCss = css`
  grid-area: 1 / max;
  ${fractionMaxCss}
  font-variant-numeric: tabular-nums;
`

const attemptsUsedCss = css`
  ${fractionGivenCss}
`

const attemptsLimitCss = css`
  ${fractionMaxCss}
`

const pointsLevelCss: Record<PointsLevel, string> = {
  chapter: css`
    font-size: 1.125rem;
  `,
  page: css`
    font-size: 0.9375rem;
  `,
  exercise: css`
    font-size: 1rem;
  `,
}

// The chapter's matches its heading; 600 at that size would outweigh the chapter name.
const earnedPointsCss: Record<PointsLevel, string> = {
  chapter: css`
    font-weight: 500;
  `,
  page: css`
    font-weight: 600;
  `,
  exercise: css`
    font-weight: 400;
  `,
}
