"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import type { Key } from "react-aria"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { LanguageVersionCourse } from "@/generated/api/types.generated"
import {
  useExerciseLinksMutation,
  useLanguageVersionStructure,
  useLanguageVersionSuggestions,
} from "@/hooks/useLanguageVersions"
import useLanguageName from "@/shared-module/common/hooks/useLanguageName"
import {
  Button,
  Dialog,
  QueryResult,
  ToggleButtonGroup,
  ToggleButtonGroupButton,
} from "@/shared-module/components"

import CounterpartMatchTable from "./CounterpartMatchTable"
import {
  exerciseMatchRows,
  hasPendingSuggestion,
  initialMatchFields,
  type MatchFields,
  summarizeMatches,
  useDefaultChapter,
} from "./matchRows"
import {
  cancelAction,
  courseById,
  dialogBodyCss,
  hintCss,
  leadCss,
  mutedCss,
  orderCourses,
  sectionCss,
  toolbarCss,
  headActionsCss,
} from "./shared"

const CHAPTER_FIELD = "chapter"

interface Props {
  courseId: string
  courses: LanguageVersionCourse[]
  /** The course whose unlinked exercises to link; this course links to all other versions. */
  targetCourseId: string
  onBack: () => void
}

interface ChapterFields {
  chapter: Set<Key>
}

/** Reviews suggested exercise counterparts chapter by chapter and saves the accepted ones. */
const LinkFixer: React.FC<Props> = ({ courseId, courses, targetCourseId, onBack }) => {
  const { t } = useTranslation()
  const languageName = useLanguageName()
  const structureQuery = useLanguageVersionStructure(courseId)
  const chapterKeys = useMemo(
    () =>
      (structureQuery.data?.chapters ?? []).flatMap((chapter) =>
        chapter.chapter_number === null || chapter.chapter_number === undefined
          ? []
          : [String(chapter.chapter_number)],
      ),
    [structureQuery.data],
  )
  const chapterForm = useForm<ChapterFields>({ defaultValues: { chapter: new Set() } })
  const { setValue: setChapterValue } = chapterForm
  const pickChapter = useCallback(
    (key: string) => setChapterValue(CHAPTER_FIELD, new Set([key])),
    [setChapterValue],
  )
  const chapterNumber = Number(
    useDefaultChapter(chapterForm.watch("chapter"), chapterKeys, pickChapter) ?? 0,
  )

  const suggestionsQuery = useLanguageVersionSuggestions(
    courseId,
    chapterNumber,
    [],
    chapterKeys.length > 0,
  )
  const thisCourse = courseById(courses, courseId)
  const targetCourse = courseById(courses, targetCourseId)
  const visibleCourses = useMemo(
    () =>
      orderCourses(courses, courseId).filter((course) =>
        targetCourseId === courseId ? course.id !== courseId : course.id === targetCourseId,
      ),
    [courses, courseId, targetCourseId],
  )
  const visibleCourseIds = useMemo(
    () => new Set(visibleCourses.map((course) => course.id)),
    [visibleCourses],
  )
  const rows = useMemo(
    () =>
      exerciseMatchRows(
        t,
        languageName,
        suggestionsQuery.data?.exercises ?? [],
        visibleCourseIds,
      ).filter((row) =>
        row.counterparts.some(
          (counterpart) => visibleCourseIds.has(counterpart.courseId) && !counterpart.isLinked,
        ),
      ),
    [suggestionsQuery.data, t, languageName, visibleCourseIds],
  )

  const { control, reset, setValue } = useForm<MatchFields>({
    defaultValues: { picks: {}, accepted: {} },
  })
  useEffect(() => {
    reset(initialMatchFields(rows, false))
  }, [rows, reset])
  const { changes, acceptedCount, pendingCount } = useWatch({
    control,
    compute: (fields: MatchFields) => summarizeMatches(rows, fields),
  })
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const linkMutation = useExerciseLinksMutation()

  const withSuggestion = rows.filter((row) => hasPendingSuggestion(row))
  const noSuggestionCount = rows.length - withSuggestion.length
  const language = targetCourse ? languageName(targetCourse.language_code) : ""
  const sourceLanguage = thisCourse ? languageName(thisCourse.language_code) : ""
  const chapterLabel = t("language-versions-chapter-number", { number: chapterNumber })

  const acceptAll = () => {
    const accept = pendingCount > 0
    for (const row of withSuggestion) {
      setValue(`accepted.${row.id}`, accept)
    }
  }

  const save = () => {
    linkMutation.mutate(
      { path: { course_id: courseId }, body: { changes } },
      {
        // Stays on the fixer: the teacher usually goes on to the next chapter.
        onSuccess: () => setIsConfirmOpen(false),
      },
    )
  }

  return (
    <section className={sectionCss}>
      <p>
        <Button variant="link" onPress={onBack}>
          {t("language-versions-back-to-problems")}
        </Button>
      </p>
      <h2>{t("language-versions-link-fixer-title", { language })}</h2>
      <p className={leadCss}>
        {targetCourseId === courseId
          ? t("language-versions-link-fixer-lead-all", { sourceLanguage })
          : t("language-versions-link-fixer-lead", { language, sourceLanguage })}
      </p>
      <div className={toolbarCss}>
        <ToggleButtonGroup
          name="chapter"
          control={chapterForm.control}
          label={null}
          aria-label={t("language-versions-chapter-picker")}
        >
          {chapterKeys.map((key) => (
            <ToggleButtonGroupButton key={key} id={key}>
              {t("language-versions-chapter-number", { number: key })}
            </ToggleButtonGroupButton>
          ))}
        </ToggleButtonGroup>
        <div className={headActionsCss}>
          <Button
            variant="secondary"
            size="medium"
            disabled={withSuggestion.length === 0}
            onPress={acceptAll}
          >
            {pendingCount > 0 || withSuggestion.length === 0
              ? t("language-versions-accept-all")
              : t("language-versions-undo-accept-all")}
          </Button>
          <Button
            variant="primary"
            size="medium"
            disabled={changes.length === 0}
            onPress={() => setIsConfirmOpen(true)}
          >
            {changes.length > 0
              ? t("language-versions-save-n-links", { count: changes.length })
              : t("language-versions-save-links")}
          </Button>
        </div>
      </div>
      <p className={hintCss}>
        {t("language-versions-fixer-summary", {
          chapter: chapterLabel,
          accepted: acceptedCount,
          pending: pendingCount,
          none: noSuggestionCount,
        })}
      </p>
      <QueryResult query={structureQuery}>
        {() =>
          chapterKeys.length === 0 ? (
            <span className={mutedCss}>{t("language-versions-chapter-all-linked")}</span>
          ) : (
            <QueryResult query={suggestionsQuery} treatEmptyAsData>
              {() =>
                thisCourse ? (
                  <CounterpartMatchTable
                    caption={t("language-versions-link-fixer-title", { language })}
                    referenceCourse={thisCourse}
                    courses={visibleCourses}
                    rows={rows}
                    control={control}
                    onAccept={(rowId) => setValue(`accepted.${rowId}`, true)}
                    emptyState={
                      <span className={mutedCss}>{t("language-versions-chapter-all-linked")}</span>
                    }
                  />
                ) : null
              }
            </QueryResult>
          )
        }
      </QueryResult>
      <Dialog
        open={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title={t("language-versions-save-links-for", { chapter: chapterLabel })}
        actions={[
          cancelAction(t, () => setIsConfirmOpen(false)),
          {
            label: t("language-versions-save-links"),
            variant: "primary",
            isLoading: linkMutation.isPending,
            onPress: save,
          },
        ]}
      >
        <div className={dialogBodyCss}>
          <p>
            {t("language-versions-save-links-body", {
              count: changes.length,
              sourceLanguage,
              language,
            })}
          </p>
          <p className={mutedCss}>{t("language-versions-points-and-content-stay")}</p>
        </div>
      </Dialog>
    </section>
  )
}

export default LinkFixer
