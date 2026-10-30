"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useSetAtom } from "jotai"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { saveCourseModuleEndQuestionnaireAnswersMutation } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { getCourseModuleEndQuestionnaire } from "@/generated/course-material-api/sdk.generated"
import type { CourseModuleEndingQuestion } from "@/generated/course-material-api/types.generated"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import { RadioGroup, Radio, TextArea, Button, Checkbox } from "@/shared-module/components"
import { needsToAnswerEndQuestionnaire } from "@/stores/course-material/endQuestionStore"

interface Answer {
  freeText: string
  select: string
  multiSelect: Record<string, boolean>
}

export interface EndQuestionnaireDialogProps {
  courseId: string
  courseModuleId: string
}

type AnswersData = Record<string, Answer>

const multiSelectAnswerMap = (multi: Record<string, boolean> | undefined) => {
  let answers: string[] = []
  if (!multi) {
    return answers
  }
  for (let key in multi) {
    if (Object.prototype.hasOwnProperty.call(multi, key) && multi[key]) {
      answers.push(key)
    }
  }
  return answers
}

const EndQuestionnaireDialog: React.FC<EndQuestionnaireDialogProps> = ({
  courseId,
  courseModuleId,
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const setShowEndQuestionnaire = useSetAtom(needsToAnswerEndQuestionnaire)
  const { control, handleSubmit } = useForm<AnswersData>({
    defaultValues: {},
    // oxlint-disable-next-line i18next/no-literal-string
    mode: "onChange",
  })

  const getEndQuestionnaire = useQuery({
    queryKey: [`course-${courseId}-endQuestions`],
    queryFn: (): Promise<CourseModuleEndingQuestion[]> =>
      getCourseModuleEndQuestionnaire({
        path: {
          course_id: assertNotNullOrUndefined(courseId),
        },
      }),
    enabled: !!courseId,
  })

  const answerEndQuestionnaireMutation = useToastMutationOptions(
    saveCourseModuleEndQuestionnaireAnswersMutation(),
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        setOpen(false)
        setShowEndQuestionnaire(false)
      },
    },
  )

  const onSaveEndQuestionnaireAnswersWrapper = handleSubmit(async (data) => {
    const questionIds = getEndQuestionnaire.data?.map((q) => q.id)
    if (!questionIds) {
      return //error
    }
    const answerData = questionIds.map((id) => {
      let answer = data[id]
      return {
        question_id: id,
        answer_text_value: answer?.freeText ?? null,
        answer_select_value: answer?.select ?? null,
        answer_multi_select_value: multiSelectAnswerMap(answer?.multiSelect),
      }
    })
    await answerEndQuestionnaireMutation.mutateAsync({
      body: answerData,
      path: {
        course_id: assertNotNullOrUndefined(courseId),
        course_module_id: assertNotNullOrUndefined(courseModuleId),
      },
    })
  })

  return (
    <>
      {getEndQuestionnaire.isLoading && <Spinner variant="small" />}
      {getEndQuestionnaire.isError && <ErrorBanner error={getEndQuestionnaire.error} />}
      {getEndQuestionnaire.isSuccess && (
        <>
          <Button
            onClick={() => {
              setOpen(true)
            }}
          >
            {t("give-answers")}
          </Button>
          <StandardDialog
            open={open}
            title={t("answer-to-complete-course")}
            showCloseButton={false}
            closeable={false}
          >
            <form
              className={css`
                flex: 1;
                ${respondToOrLarger.sm} {
                  flex: 0 45%;
                }
                display: flex;
                flex-direction: column;
                gap: 1rem;
                overflow: scroll;
              `}
              onSubmit={onSaveEndQuestionnaireAnswersWrapper}
            >
              {getEndQuestionnaire.data.map((q, i) => {
                return (
                  <div key={i}>
                    {q.select_labels && (
                      <RadioGroup
                        control={control}
                        name={`${q.id}.select`}
                        label={q.question_text}
                        isRequired
                        rules={{ required: t("required") }}
                        // oxlint-disable-next-line i18next/no-literal-string
                        orientation="horizontal"
                      >
                        {q.select_labels.map((x) => (
                          <Radio key={x} value={x} label={x} />
                        ))}
                      </RadioGroup>
                    )}
                    {q.multi_select_labels && (
                      <>
                        <p>{t("select-all-that-apply")}</p>
                        {q.multi_select_labels.map((m) => (
                          <Checkbox
                            key={m}
                            control={control}
                            name={`${q.id}.multiSelect.${m}`}
                            label={m}
                          />
                        ))}
                      </>
                    )}
                    {q.question_free_text_instruction && (
                      <label>{q.question_free_text_instruction}</label>
                    )}
                    <TextArea
                      control={control}
                      name={`${q.id}.freeText`}
                      label={q.question_text}
                      autoResize={true}
                      isRequired
                      rules={{ required: t("required-field") }}
                    />
                  </div>
                )
              })}
              <Button type="submit">{t("submit")}</Button>
            </form>
          </StandardDialog>
        </>
      )}
    </>
  )
}

export default EndQuestionnaireDialog
