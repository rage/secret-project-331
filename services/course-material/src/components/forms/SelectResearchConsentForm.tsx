import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useContext, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { CheckboxContext } from "../../contexts/CheckboxContext"
import PageContext from "../../contexts/PageContext"
import {
  Block,
  fetchResearchFormQuestionsWithCourseId,
  fetchResearchFormWithCourseId,
  postResearchFormUserAnswer,
} from "../../services/backend"
import { ResearchFormQuestionAnswer } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import Dialog from "../../shared-module/components/Dialog"
import useToastMutation from "../../shared-module/hooks/useToastMutation"
import useUserInfo from "../../shared-module/hooks/useUserInfo"
import { headingFont } from "../../shared-module/styles"
import { assertNotNullOrUndefined } from "../../shared-module/utils/nullability"
import ContentRenderer from "../ContentRenderer"

interface ResearchConsentFormProps {
  onClose: () => void
  editForm: boolean
  shouldAnswerResearchForm: boolean
  usersInitialAnswers?: ResearchFormQuestionAnswer[]
}

type UserAnswer = {
  questionId: string
  answer: boolean
}

const SelectResearchConsentForm: React.FC<React.PropsWithChildren<ResearchConsentFormProps>> = ({
  editForm,
  onClose,
  shouldAnswerResearchForm,
}) => {
  const { t } = useTranslation()
  const userId = useUserInfo().data?.user_id
  const courseId = useContext(PageContext).pageData?.course_id

  const [questionIdsAndAnswers, setQuestionIdsAndAnswers] = useState<{ [key: string]: boolean }>()

  const getResearchConsentForm = useQuery([`courses-${courseId}-research-consent-form`], () =>
    fetchResearchFormWithCourseId(assertNotNullOrUndefined(courseId)),
  )

  const getResearchFormQuestions = useQuery(
    [`courses-${courseId}-research-consent-form-questions`],
    () => fetchResearchFormQuestionsWithCourseId(assertNotNullOrUndefined(courseId)),
  )

  // Adds all checkbox ids and false as default answer to questionIdsAndAnswers
  useEffect(() => {
    const questions = getResearchFormQuestions.data?.reduce(
      (acc, obj) => ({
        ...acc,
        [obj.id]: false,
      }),
      {},
    )
    setQuestionIdsAndAnswers(questions)
  }, [getResearchFormQuestions.data, questionIdsAndAnswers, setQuestionIdsAndAnswers])

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

  const handleOnSubmit = async () => {
    if (questionIdsAndAnswers) {
      Object.entries(questionIdsAndAnswers).forEach(([id, bol]) => {
        const newAnswer: UserAnswer = { questionId: id, answer: bol }
        mutation.mutate(newAnswer)
      })
    }
    onClose()
  }

  if (getResearchConsentForm.isError) {
    return null
  }

  return (
    <div>
      <Dialog open={shouldAnswerResearchForm || editForm} closeable={false}>
        <CheckboxContext.Provider value={{ questionIdsAndAnswers, setQuestionIdsAndAnswers }}>
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
          </div>
        </CheckboxContext.Provider>
      </Dialog>
    </div>
  )
}

export default SelectResearchConsentForm
