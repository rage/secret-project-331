"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { dividedListCss, noteCss, spacedRowCss } from "@/components/credit-registration/styles"
import {
  getMyCoursesQueryKey,
  getMyStudiesQueryKey,
  unhideCourseFromMyCoursesMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type { MyStudiesCourse } from "@/generated/api/types.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { Button, Disclosure } from "@/shared-module/components"

export interface HiddenCoursesSectionProps {
  courses: MyStudiesCourse[]
}

const courseNameCss = css`
  font-weight: 500;
  color: var(--color-gray-700);
`

const POST = "POST"

/** The only deliberate unhide: elsewhere `hidden` clears when the student opens the material. */
const HiddenCoursesSection: React.FC<HiddenCoursesSectionProps> = ({ courses }) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const unhideCourseMutation = useToastMutationOptions(
    unhideCourseFromMyCoursesMutation(),
    { notify: true, method: POST },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getMyStudiesQueryKey() })
        queryClient.invalidateQueries({ queryKey: getMyCoursesQueryKey() })
      },
    },
  )

  return (
    <Disclosure title={t("hidden-courses-n", { n: courses.length })}>
      <p className={noteCss}>{t("hidden-courses-are-not-included-in-the-summary")}</p>
      <ul className={dividedListCss}>
        {courses.map((course) => (
          <li className={spacedRowCss} key={course.course_id}>
            <span className={courseNameCss}>{course.course_name}</span>
            <Button
              variant="secondary"
              size="small"
              onPress={() => unhideCourseMutation.mutate({ path: { course_id: course.course_id } })}
              aria-label={t("unhide-course", { title: course.course_name })}
            >
              {t("unhide")}
            </Button>
          </li>
        ))}
      </ul>
    </Disclosure>
  )
}

export default HiddenCoursesSection
