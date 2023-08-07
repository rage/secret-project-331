import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useContext, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { CheckboxContext } from "../../contexts/CheckboxContext"
import PageContext from "../../contexts/PageContext"
import {
  Block,
  fetchResearchFormAnswersWithUserId,
  fetchResearchFormQuestionsWithCourseId,
  fetchResearchFormWithCourseId,
  postResearchFormUserAnswer,
} from "../../services/backend"
import Button from "../../shared-module/components/Button"
import Dialog from "../../shared-module/components/Dialog"
import useToastMutation from "../../shared-module/hooks/useToastMutation"
import useUserInfo from "../../shared-module/hooks/useUserInfo"
import { headingFont } from "../../shared-module/styles"
import { assertNotNullOrUndefined } from "../../shared-module/utils/nullability"
import ContentRenderer from "../ContentRenderer"

interface ResearchConsentFormProps {
  onClose?: () => void
}

type UserAnswer = {
  questionId: string
  answer: boolean
}

const SelectResearchConsentForm: React.FC<
  React.PropsWithChildren<ResearchConsentFormProps>
> = () => {
  const { t } = useTranslation()
  const userId = useUserInfo().data?.user_id
  const courseId = useContext(PageContext).pageData?.course_id

  const [shouldAnswerForm, setShouldAnswerForm] = useState<boolean>(false)
  const [answers, setAnswers] = useState<{ [key: string]: boolean }>()

  const getResearchConsentForm = useQuery([`courses-${courseId}-research-consent-form`], () =>
    fetchResearchFormWithCourseId(assertNotNullOrUndefined(courseId)),
  )

  const getResearchFormAnswers = useQuery({
    queryKey: [`courses-${courseId}-research-consent-form-question-answer`],
    queryFn: () => fetchResearchFormAnswersWithUserId(assertNotNullOrUndefined(courseId)),
    enabled: getResearchConsentForm.isSuccess,
  })

  useEffect(() => {
    if (getResearchFormAnswers.data?.length == 0) {
      setShouldAnswerForm(true)
    }
  }, [getResearchFormAnswers.data?.length])

  const getResearchFormQuestions = useQuery(
    [`courses-${courseId}-research-consent-form-questions`],
    () => fetchResearchFormQuestionsWithCourseId(assertNotNullOrUndefined(courseId)),
  )

  // Adds all checkbox ids and false as deault answer to answers
  useEffect(() => {
    const questions = getResearchFormQuestions.data?.reduce(
      (acc, obj) => ({
        ...acc,
        [obj.id]: false,
      }),
      {},
    )
    setAnswers(questions)
  }, [getResearchFormQuestions.data, setAnswers])

  const mutation = useToastMutation(
    (answer: UserAnswer) =>
      postResearchFormUserAnswer(
        assertNotNullOrUndefined(courseId),
        assertNotNullOrUndefined(userId),
        answer.questionId,
        answer.answer,
      ),
    {
      notify: true,
      method: "POST",
    },
  )

  const handleOnSubmit = () => {
    setShouldAnswerForm(false)
    if (answers) {
      Object.entries(answers).forEach(([id, bol]) => {
        const newAnswer: UserAnswer = { questionId: id, answer: bol }
        mutation.mutate(newAnswer)
      })
    }
    getResearchFormAnswers.refetch()
  }
  if (!shouldAnswerForm) {
    return null
  }
  return (
    <div>
      <Dialog open={shouldAnswerForm} closeable={false}>
        <CheckboxContext.Provider value={{ answers, setAnswers }}>
          {getResearchConsentForm.isSuccess && (
            <ContentRenderer
              data={(getResearchConsentForm.data?.content as Array<Block<unknown>>) ?? []}
              editing={false}
              selectedBlockId={null}
              setEdits={(map) => map}
              isExam={false}
            />
          )}
          <div
            className={css`
              display: flex;
              flex-direction: row;
              justify-content: flex-end;
              padding: 16px 20px 16px 20px;
              height: 72px;
              font-family: ${headingFont};
            `}
          >
            <Button
              className={css`
                font-size: 14px;
              `}
              variant="tertiary"
              size="medium"
              type="submit"
              transform="capitalize"
              onClick={handleOnSubmit}
              value={t("save")}
            >
              {t("save")}
            </Button>
          </div>{" "}
        </CheckboxContext.Provider>
      </Dialog>
    </div>
  )
}

export default SelectResearchConsentForm
