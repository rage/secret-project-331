"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  getMyCoursesQueryKey,
  getMyStudiesQueryKey,
  unhideCourseFromMyCoursesMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type { MyStudiesCourse } from "@/generated/api/types.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import { Button, Disclosure } from "@/shared-module/components"

export interface HiddenCoursesSectionProps {
  courses: MyStudiesCourse[]
}

const rowCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid ${baseTheme.colors.clear[300]};

  &:last-of-type {
    border-bottom: none;
  }
`

const courseNameCss = css`
  font-weight: ${fontWeights.medium};
  color: ${baseTheme.colors.gray[700]};
`

const POST = "POST"

/**
 * The only place a course hidden from "My courses" can be brought back deliberately: everywhere else
 * `hidden` is cleared as a side effect of opening the course material.
 */
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
      {courses.map((course) => (
        <div className={rowCss} key={course.course_id}>
          <span className={courseNameCss}>{course.course_name}</span>
          <Button
            variant="secondary"
            size="small"
            onPress={() => unhideCourseMutation.mutate({ path: { course_id: course.course_id } })}
            aria-label={t("unhide-course", { title: course.course_name })}
          >
            {t("unhide")}
          </Button>
        </div>
      ))}
    </Disclosure>
  )
}

export default HiddenCoursesSection
