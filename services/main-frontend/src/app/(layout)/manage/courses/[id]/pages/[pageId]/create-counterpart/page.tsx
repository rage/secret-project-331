"use client"

import { css, cx } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams, useSearchParams } from "next/navigation"
import React, { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  chipBeforeTextCss,
  findPageRow,
  mutedCss,
  pageLabel,
  pageOfCourse,
} from "@/components/language-versions/shared"
import {
  getLanguageVersionStructureOptions,
  postLanguageVersionCounterpartMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type {
  CreateCounterpartResult,
  LanguageVersionPage,
  LanguageVersionStructure,
} from "@/generated/api/types.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useLanguageName from "@/shared-module/common/hooks/useLanguageName"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { editPageRoute, manageCoursePagesRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import {
  Button,
  ErrorNotice,
  Infobox,
  LanguageChip,
  Link,
  QueryResult,
  Radio,
  RadioGroup,
  Select,
  TextField,
  TONE,
} from "@/shared-module/components"

const NO_CHAPTER = "no-chapter"
const FIRST_POSITION = "first"

interface CounterpartFields {
  language_code: string
  chapter: string
  insert_after: string
  title: string
}

const layoutCss = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 2.5rem;
  align-items: start;
  margin-top: 1.5rem;

  @media (max-width: 800px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 1.5rem;
  }
`

const headingCss = css`
  margin: var(--space-3) 0 var(--space-4);
  font-size: clamp(2rem, 3.6vh, 36px);
  font-weight: 700;
  color: var(--color-gray-700);
`

const labelCss = css`
  font-weight: 600;
  color: var(--color-gray-700);
`

const sourceCardCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2) var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--color-gray-100);
  border-radius: 8px;
  font-weight: 600;
  color: var(--color-gray-700);
`

const groupCss = css`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.75rem;
`

const proseCss = cx(
  mutedCss,
  css`
    margin: 0;
    max-width: 76ch;
  `,
)

const sideCss = css`
  position: sticky;
  top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  border: 1px solid var(--color-clear-300);
  border-radius: 8px;
  background: var(--color-clear-100);

  h2 {
    margin: 0;
    font-size: var(--font-size-3);
    font-weight: 600;
  }

  ul {
    margin: 0;
    padding-left: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  @media (max-width: 800px) {
    position: static;
  }
`

const slotsCss = css`
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-clear-300);
  border-radius: 8px;
  overflow: hidden;
`

const slotRowCss = css`
  display: grid;
  grid-template-columns: 1.5rem minmax(0, 1fr);
  align-items: baseline;
  padding: 0.75rem 1rem;
  font: inherit;
  font-size: var(--font-size-1);
  text-align: start;
  border: 0;
  border-bottom: 1px solid var(--color-clear-300);
  background: var(--color-clear-100);
  color: var(--color-gray-500);

  &:last-child {
    border-bottom: 0;
  }
`

const slotButtonCss = css`
  cursor: pointer;
  width: 100%;

  &:hover {
    background: var(--color-green-75);
    color: var(--color-green-700);
  }

  &:focus-visible {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: -2px;
  }
`

const slotSelectedCss = css`
  background: var(--color-green-75);
  color: var(--color-gray-800);
  font-size: var(--font-size-2);
  font-weight: 600;
  cursor: default;
`

const slotSameCss = css`
  display: block;
  font-weight: 400;
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
`

const pageRowCss = css`
  background: #fff;
  color: var(--color-gray-700);
  font-size: var(--font-size-2);
`

const doneActionsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
`

const buttonRowCss = css`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

/** Chapter id of a page, or `NO_CHAPTER` for pages outside chapters. */
const chapterKey = (page: LanguageVersionPage) => page.chapter_id ?? NO_CHAPTER

function findSourcePage(structure: LanguageVersionStructure, courseId: string, pageId: string) {
  const row = findPageRow(structure, pageId)?.row
  const source = row && pageOfCourse(row, courseId)
  return row && source?.id === pageId ? { source, row } : null
}

function CreateCounterpartPage() {
  const { t } = useTranslation()
  usePageTitle(t("language-versions-create-counterpart-title"))
  const params = useParams<{ id: string; pageId: string }>()
  const languageParam = useSearchParams().get("language")
  const structureQuery = useQuery(
    getLanguageVersionStructureOptions({ path: { course_id: params.id } }),
  )

  return (
    <div>
      <Link href={manageCoursePagesRoute(params.id)}>{t("language-versions-back-to-pages")}</Link>
      <h1 className={headingCss}>{t("language-versions-create-counterpart-title")}</h1>
      <QueryResult query={structureQuery}>
        {(structure) => (
          <CounterpartForm
            structure={structure}
            courseId={params.id}
            pageId={params.pageId}
            initialLanguage={languageParam}
          />
        )}
      </QueryResult>
    </div>
  )
}

interface CounterpartFormProps {
  structure: LanguageVersionStructure
  courseId: string
  pageId: string
  initialLanguage: string | null
}

const CounterpartForm: React.FC<CounterpartFormProps> = ({
  structure,
  courseId,
  pageId,
  initialLanguage,
}) => {
  const { t } = useTranslation()
  const found = findSourcePage(structure, courseId, pageId)
  const languageName = useLanguageName()

  const sourceCourse = structure.courses.find((course) => course.id === courseId)
  const otherCourses = structure.courses.filter((course) => course.id !== courseId)
  const hasCounterpart = (otherCourseId: string) =>
    found?.row.pages.some((entry) => entry.page.course_id === otherCourseId) ?? false
  const firstFreeCourse = otherCourses.find((course) => !hasCounterpart(course.id))
  const initialCourse =
    otherCourses.find(
      (course) => course.language_code === initialLanguage && !hasCounterpart(course.id),
    ) ?? firstFreeCourse

  const { control, watch, setValue, handleSubmit } = useForm<CounterpartFields>({
    defaultValues: {
      language_code: initialCourse?.language_code ?? "",
      chapter: NO_CHAPTER,
      insert_after: FIRST_POSITION,
      title: found?.source.title ?? "",
    },
  })
  const [languageCode, chapter, insertAfter, title] = watch([
    "language_code",
    "chapter",
    "insert_after",
    "title",
  ])

  const targetCourse = otherCourses.find((course) => course.language_code === languageCode)
  const source = found?.source

  const targetChapters = useMemo(
    () =>
      structure.chapters
        .flatMap((chapterRow) => chapterRow.chapters)
        .filter((one) => one.course_id === targetCourse?.id)
        .toSorted((a, b) => a.chapter_number - b.chapter_number),
    [structure, targetCourse?.id],
  )

  const targetPages = useMemo(() => {
    const pages = structure.chapters
      .flatMap((chapterRow) => chapterRow.rows)
      .flatMap((row) => row.pages.map((entry) => entry.page))
      .filter((page) => page.course_id === targetCourse?.id && chapterKey(page) === chapter)
    return pages.toSorted((a, b) => a.position - b.position)
  }, [structure, targetCourse?.id, chapter])

  // The chapter with the source's number, so the copy lands where the teacher expects.
  useEffect(() => {
    const sameNumber = targetChapters.find((one) => one.chapter_number === source?.chapter_number)
    const fallback = source?.chapter_id ? targetChapters[0]?.id : undefined
    setValue("chapter", sameNumber?.id ?? fallback ?? NO_CHAPTER)
  }, [targetChapters, source?.chapter_number, source?.chapter_id, setValue])

  // The server never puts a page above the chapter front page.
  const leadingFrontPage = targetPages[0]?.is_chapter_front_page ? targetPages[0] : undefined
  const firstSlot = leadingFrontPage?.id ?? FIRST_POSITION

  const suggestedAfter = useMemo(() => {
    const index = Math.min((source?.position ?? 1) - 1, targetPages.length)
    return index <= 0 ? firstSlot : (targetPages[index - 1]?.id ?? firstSlot)
  }, [source?.position, targetPages, firstSlot])

  useEffect(() => {
    setValue("insert_after", suggestedAfter)
  }, [suggestedAfter, setValue])

  const mutation = useToastMutationOptions(postLanguageVersionCounterpartMutation(), {
    notify: false,
  })

  if (!found || !source || !sourceCourse) {
    return <ErrorNotice error={new Error(t("language-versions-page-not-found"))} />
  }
  if (!firstFreeCourse) {
    return <Infobox tone={TONE.INFO}>{t("language-versions-all-counterparts-exist")}</Infobox>
  }
  if (!structure.courses.every((course) => course.can_edit)) {
    return <Infobox tone={TONE.INFO}>{t("language-versions-read-only-reason")}</Infobox>
  }

  const created: CreateCounterpartResult | undefined = mutation.data
  if (created && targetCourse) {
    return (
      <div className={groupCss}>
        <Infobox
          tone={TONE.SUCCESS}
          heading={t("language-versions-counterpart-created", {
            language: languageName(targetCourse.language_code),
          })}
          announce
        >
          {t("language-versions-counterpart-created-body", {
            title: created.page.title,
            language: languageName(targetCourse.language_code),
            source: languageName(sourceCourse.language_code),
          })}
        </Infobox>
        <div className={doneActionsCss}>
          <Link
            styledAsButton
            variant="primary"
            href={editPageRoute(created.page.id)}
            isCrossService
          >
            {t("language-versions-open-new-page")}
          </Link>
          <Link styledAsButton variant="secondary" href={manageCoursePagesRoute(courseId)}>
            {t("language-versions-back-to-source-page", {
              language: languageName(sourceCourse.language_code),
            })}
          </Link>
        </div>
      </div>
    )
  }

  const selectedChapter = targetChapters.find((one) => one.id === chapter)
  const insertAfterPage = targetPages.find((page) => page.id === insertAfter)

  const onSubmit = (values: CounterpartFields) => {
    if (!targetCourse) {
      return
    }
    mutation.mutate({
      path: { course_id: courseId },
      body: {
        source_page_id: source.id,
        target_course_id: targetCourse.id,
        target_chapter_id: values.chapter === NO_CHAPTER ? null : values.chapter,
        insert_after_page_id: values.insert_after === FIRST_POSITION ? null : values.insert_after,
        title: values.title,
      },
    })
  }

  const chapterOptions = [
    ...(source.chapter_id ? [] : [{ value: NO_CHAPTER, label: t("language-versions-no-chapter") }]),
    ...targetChapters.map((one) => ({
      value: one.id,
      label:
        one.chapter_number === source.chapter_number
          ? t("language-versions-chapter-same-number", {
              name: one.name,
              sourceName: source.chapter_name ?? "",
            })
          : t("language-versions-chapter-number", { number: one.chapter_number }),
    })),
  ]

  const isSuggestedSlot = (afterId: string) => afterId === suggestedAfter

  const renderSlot = (afterId: string) =>
    afterId === insertAfter ? (
      <div className={cx(slotRowCss, slotSelectedCss)}>
        <span />
        <span>
          {t("language-versions-new-page-slot", { title })}
          {isSuggestedSlot(afterId) && (
            <span className={slotSameCss}>
              {t("language-versions-same-place", {
                language: languageName(source.language_code),
              })}
            </span>
          )}
        </span>
      </div>
    ) : (
      <button
        type="button"
        className={cx(slotRowCss, slotButtonCss)}
        onClick={() => setValue("insert_after", afterId)}
      >
        <span aria-hidden="true">+</span>
        <span>{t("language-versions-put-page-here")}</span>
      </button>
    )

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <p className={proseCss}>{t("language-versions-create-counterpart-lead")}</p>
      <div className={layoutCss}>
        <div>
          <div className={groupCss}>
            <span className={labelCss}>{t("language-versions-page-to-copy")}</span>
            <div className={sourceCardCss}>
              <span>
                <LanguageChip code={source.language_code} className={chipBeforeTextCss} />
                {pageLabel(t, source)}
              </span>
              <span className={proseCss}>
                {t("language-versions-exercise-count", { count: source.exercise_count })}
              </span>
            </div>
          </div>
          <div className={groupCss}>
            <RadioGroup
              name="language_code"
              control={control}
              label={t("language-versions-language")}
            >
              {otherCourses.map((course) => (
                <Radio
                  key={course.id}
                  value={course.language_code}
                  label={languageName(course.language_code)}
                  description={
                    hasCounterpart(course.id)
                      ? t("language-versions-has-counterpart", {
                          title:
                            found.row.pages.find((entry) => entry.page.course_id === course.id)
                              ?.page.title ?? "",
                        })
                      : t("language-versions-no-counterpart-yet")
                  }
                  isDisabled={hasCounterpart(course.id)}
                />
              ))}
            </RadioGroup>
          </div>
          <div className={groupCss}>
            <Select
              name="chapter"
              control={control}
              label={t("language-versions-chapter")}
              options={chapterOptions}
            />
          </div>
          <div className={groupCss}>
            <span className={labelCss}>{t("language-versions-position")}</span>
            <div className={slotsCss}>
              {!leadingFrontPage && renderSlot(FIRST_POSITION)}
              {targetPages.map((page, index) => (
                <React.Fragment key={page.id}>
                  <div className={cx(slotRowCss, pageRowCss)}>
                    <span>{index + 1}</span>
                    <span>{page.title}</span>
                  </div>
                  {renderSlot(page.id)}
                </React.Fragment>
              ))}
            </div>
            <p className={proseCss}>
              {t("language-versions-position-hint", {
                language: languageName(source.language_code),
              })}
            </p>
          </div>
          <div className={groupCss}>
            <TextField
              name="title"
              control={control}
              label={t("language-versions-page-title")}
              rules={{ required: t("language-versions-title-required") }}
            />
            <p className={proseCss}>
              {t("language-versions-title-hint", {
                language: languageName(source.language_code),
              })}
            </p>
          </div>
          <div className={groupCss}>
            <span className={labelCss}>{t("language-versions-what-is-copied")}</span>
            <p className={proseCss}>
              {source.exercise_count > 0
                ? t("language-versions-what-is-copied-body", {
                    count: source.exercise_count,
                    language: languageName(source.language_code),
                  })
                : t("language-versions-what-is-copied-no-exercises")}
            </p>
          </div>
        </div>
        <div className={sideCss}>
          <h2>{t("language-versions-what-happens")}</h2>
          {targetCourse && (
            <ul>
              <li>
                {insertAfterPage
                  ? t("language-versions-summary-added-after", {
                      page: insertAfterPage.title,
                      chapter: selectedChapter?.name ?? "",
                      course: targetCourse.name,
                    })
                  : t("language-versions-summary-added-first", {
                      chapter: selectedChapter?.name ?? "",
                      course: targetCourse.name,
                    })}
              </li>
              <li>
                {t("language-versions-summary-copy", {
                  language: languageName(source.language_code),
                })}
              </li>
              <li>{t("language-versions-summary-linked")}</li>
              {source.exercise_count > 0 && (
                <li>
                  {t("language-versions-summary-exercises", {
                    language: languageName(source.language_code),
                  })}
                </li>
              )}
            </ul>
          )}
          <p className={proseCss}>
            {t("language-versions-source-unchanged", {
              language: languageName(source.language_code),
            })}
          </p>
          {mutation.isError && (
            <ErrorNotice
              error={mutation.error}
              context={t("language-versions-create-counterpart-failed")}
            />
          )}
          <div className={buttonRowCss}>
            <Button
              type="submit"
              variant="primary"
              isLoading={mutation.isPending}
              disabled={!targetCourse || !title.trim()}
            >
              {t("language-versions-create-and-link")}
            </Button>
            <Link styledAsButton variant="secondary" href={manageCoursePagesRoute(courseId)}>
              {t("button-text-cancel")}
            </Link>
          </div>
        </div>
      </div>
    </form>
  )
}

export default withErrorBoundary(withSignedIn(CreateCounterpartPage))
