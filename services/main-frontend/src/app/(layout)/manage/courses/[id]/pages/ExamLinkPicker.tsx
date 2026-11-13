"use client"

import { css } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import React from "react"
import { useDateFormatter } from "react-aria"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { DAY_AND_MONTH_FORMAT, formatDateWindow } from "@/components/credit-registration/constants"
import {
  getCourseLinkableExamsOptions,
  getCourseLinkableExamsQueryKey,
  getCourseLinkedExamsQueryKey,
  setExamCourseMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type { LinkableExam, LinkedExam } from "@/generated/api/types.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { Button, Link, QueryResult, Select } from "@/shared-module/components"

interface Props {
  courseId: string
  /** Fetches the exams only while open. */
  isOpen: boolean
  /** Where exams are made; `null` while unknown. */
  examsPage: string | null
  onLinked: (examId: string) => void
  onCancel: () => void
}

interface PickerFields {
  examId: string
}

const pickerCss = css`
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-gray-100);
  border-radius: var(--control-radius);
`

const actionsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
`

const mutedTextCss = css`
  margin: 0;
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
`

/** The dates and grading of an exam, e.g. "3.–17.6. · pass mark 30", for listing it by name. */
export function useExamDetails(): (
  exam: Pick<LinkedExam, "starts_at" | "ends_at" | "pass_mark">,
) => string {
  const { t } = useTranslation()
  const dateFormatter = useDateFormatter(DAY_AND_MONTH_FORMAT)
  return (exam) =>
    [
      formatDateWindow(dateFormatter, exam.starts_at, exam.ends_at),
      exam.pass_mark === null || exam.pass_mark === undefined
        ? t("linked-exam-graded-manually")
        : t("linked-exam-pass-mark", { points: exam.pass_mark }),
    ]
      .filter((part): part is string => part !== null)
      // oxlint-disable-next-line i18next/no-literal-string
      .join(" · ")
}

/** "Also used in: A, B and 2 other courses", or `null` for an exam linked to no other course. */
function useOtherCoursesText(): (exam: LinkableExam) => string | null {
  const { t, i18n } = useTranslation()
  return (exam) => {
    const courses = [...exam.linked_course_names]
    if (exam.hidden_linked_course_count > 0) {
      courses.push(t("count-other-courses", { count: exam.hidden_linked_course_count }))
    }
    if (courses.length === 0) {
      return null
    }
    const list = new Intl.ListFormat(i18n.language, { type: "conjunction" }).format(courses)
    return t("exam-also-used-in", { courses: list })
  }
}

/** Links one of the organization's exams to the course; the link takes effect without saving. */
const ExamLinkPicker: React.FC<Props> = ({ courseId, isOpen, examsPage, onLinked, onCancel }) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const examDetails = useExamDetails()
  const otherCoursesText = useOtherCoursesText()
  const { control, watch, reset } = useForm<PickerFields>({ defaultValues: { examId: "" } })
  const examId = watch("examId")

  const linkableExamsQuery = useQuery({
    ...getCourseLinkableExamsOptions({ path: { course_id: courseId } }),
    enabled: isOpen,
  })

  const chosenExam = linkableExamsQuery.data?.find((exam) => exam.id === examId)
  const chosenExamOtherCourses = chosenExam ? otherCoursesText(chosenExam) : null

  const linkMutation = useToastMutationOptions(
    setExamCourseMutation(),
    { notify: true, method: "POST" },
    {
      onSuccess: async (_data, variables) => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: getCourseLinkedExamsQueryKey({ path: { course_id: courseId } }),
          }),
          queryClient.invalidateQueries({
            queryKey: getCourseLinkableExamsQueryKey({ path: { course_id: courseId } }),
          }),
        ])
        reset()
        onLinked(variables.path.id)
      },
    },
  )

  const cancel = () => {
    reset()
    onCancel()
  }

  return (
    <div className={pickerCss}>
      <QueryResult query={linkableExamsQuery} treatEmptyAsData>
        {(exams) =>
          exams.length === 0 ? (
            <p className={mutedTextCss}>
              {t("linkable-exams-empty")}{" "}
              {examsPage && <Link href={examsPage}>{t("create-an-exam")}</Link>}
            </p>
          ) : (
            <>
              <Select
                name="examId"
                control={control}
                label={t("label-exam-to-link")}
                placeholder={t("placeholder-choose-exam")}
                options={exams.map((exam) => ({
                  value: exam.id,
                  textValue: exam.name,
                  label: `${exam.name} · ${examDetails(exam)}`,
                }))}
              />
              {chosenExamOtherCourses && <p className={mutedTextCss}>{chosenExamOtherCourses}</p>}
              <div className={actionsCss}>
                <Button
                  variant="primary"
                  size="small"
                  disabled={examId === ""}
                  isLoading={linkMutation.isPending}
                  onPress={() =>
                    linkMutation.mutate({ path: { id: examId }, body: { course_id: courseId } })
                  }
                >
                  {t("button-link-exam")}
                </Button>
                <Button variant="tertiary" size="small" onPress={cancel}>
                  {t("button-text-cancel")}
                </Button>
              </div>
            </>
          )
        }
      </QueryResult>
    </div>
  )
}

export default ExamLinkPicker
