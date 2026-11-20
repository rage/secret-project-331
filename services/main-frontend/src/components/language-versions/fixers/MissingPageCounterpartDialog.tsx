"use client"

import { useRouter } from "next/navigation"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { LanguageVersionCourse, LanguageVersionPage } from "@/generated/api/types.generated"
import { useLanguageVersionStructure, usePageLinksMutation } from "@/hooks/useLanguageVersions"
import useLanguageName from "@/shared-module/common/hooks/useLanguageName"
import { manageCreateCounterpartRoute } from "@/shared-module/common/utils/routes"
import { Dialog, QueryResult, Radio, RadioGroup, Select } from "@/shared-module/components"

import { LINK } from "../constants"
import {
  cancelAction,
  courseById,
  dialogBodyCss,
  findPageRow,
  otherLanguageCounterpartIds,
  pageLabel,
  pageOfCourse,
  pagesInChapter,
} from "../shared"

const METHOD_CREATE = "create"
const METHOD_LINK = "link"

interface Props {
  courseId: string
  courses: LanguageVersionCourse[]
  counterpartCourseId: string
  pages: LanguageVersionPage[]
  onClose: () => void
}

interface Fields {
  pageId: string
  method: typeof METHOD_CREATE | typeof METHOD_LINK
  counterpartPageId: string
}

/** Gives a page a counterpart by creating a copy or by linking an existing page. */
const MissingPageCounterpartDialog: React.FC<Props> = ({
  courseId,
  courses,
  counterpartCourseId,
  pages,
  onClose,
}) => {
  const { t } = useTranslation()
  const router = useRouter()
  const languageName = useLanguageName()
  const structureQuery = useLanguageVersionStructure(courseId)
  const linkMutation = usePageLinksMutation()
  const { control, watch } = useForm<Fields>({
    defaultValues: { pageId: pages[0]?.id ?? "", method: METHOD_CREATE, counterpartPageId: "" },
  })
  const pageId = watch("pageId")
  const method = watch("method")
  const counterpartPageId = watch("counterpartPageId")
  const page = pages.find((candidate) => candidate.id === pageId) ?? pages[0]
  const counterpartCourse = courseById(courses, counterpartCourseId)
  const language = counterpartCourse ? languageName(counterpartCourse.language_code) : ""
  const sourceLanguage = page ? languageName(page.language_code) : ""

  const confirm = () => {
    if (!page || !counterpartCourse) {
      return
    }
    if (method === METHOD_CREATE) {
      router.push(
        manageCreateCounterpartRoute(page.course_id, page.id, counterpartCourse.language_code),
      )
      return
    }
    const ownRow = structureQuery.data ? findPageRow(structureQuery.data, page.id)?.row : undefined
    const otherCounterparts = otherLanguageCounterpartIds(
      (ownRow?.pages ?? []).map((structurePage) => structurePage.page),
      page.id,
      counterpartCourseId,
    )
    linkMutation.mutate(
      {
        path: { course_id: courseId },
        body: {
          changes: [{ action: LINK, ids: [page.id, counterpartPageId, ...otherCounterparts] }],
        },
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("language-versions-missing-page-title", {
        language,
        title: page?.title ?? "",
      })}
      actions={[
        cancelAction(t, onClose),
        {
          label:
            method === METHOD_CREATE
              ? t("language-versions-continue")
              : t("language-versions-link-page"),
          variant: "primary",
          disabled: method === METHOD_LINK && counterpartPageId === "",
          isLoading: linkMutation.isPending,
          onPress: confirm,
        },
      ]}
    >
      <div className={dialogBodyCss}>
        {pages.length > 1 && (
          <Select
            name="pageId"
            control={control}
            label={t("language-versions-page")}
            options={pages.map((candidate) => ({
              value: candidate.id,
              label: pageLabel(t, candidate),
            }))}
          />
        )}
        <QueryResult query={structureQuery}>
          {(structure) => {
            const candidates = page
              ? pagesInChapter(structure, counterpartCourseId, page.chapter_number)
              : []
            const options = candidates.map(({ page: candidate, row }) => {
              const isLinked = page ? pageOfCourse(row, page.course_id) !== undefined : false
              return {
                value: candidate.id,
                isDisabled: isLinked,
                label: isLinked
                  ? t("language-versions-option-already-linked", { name: pageLabel(t, candidate) })
                  : pageLabel(t, candidate),
              }
            })
            const hasFreePage = options.some((option) => !option.isDisabled)
            return (
              <RadioGroup
                name="method"
                control={control}
                label={t("language-versions-missing-page-lead")}
              >
                <Radio
                  value={METHOD_CREATE}
                  label={t("language-versions-create-missing-counterpart")}
                  description={t("language-versions-create-missing-counterpart-description", {
                    sourceLanguage,
                    language,
                  })}
                />
                <Radio
                  value={METHOD_LINK}
                  label={t("language-versions-link-existing-page", { language })}
                  description={
                    hasFreePage
                      ? undefined
                      : t("language-versions-no-free-pages", { language, sourceLanguage })
                  }
                  nestedContent={
                    <Select
                      name="counterpartPageId"
                      control={control}
                      label={t("language-versions-choose-page", { language })}
                      options={options}
                    />
                  }
                />
              </RadioGroup>
            )
          }}
        </QueryResult>
      </div>
    </Dialog>
  )
}

export default MissingPageCounterpartDialog
