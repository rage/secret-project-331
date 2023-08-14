import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useContext, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { CheckboxContext } from "../../contexts/CheckboxContext"
import PageContext from "../../contexts/PageContext"
import {
  Block,
  fetchResearchFormQuestionsWithCourseId,
  postResearchFormUserAnswer,
} from "../../services/backend"
import { ResearchForm, ResearchFormQuestionAnswer } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import Dialog from "../../shared-module/components/Dialog"
import useToastMutation from "../../shared-module/hooks/useToastMutation"
import useUserInfo from "../../shared-module/hooks/useUserInfo"
import { baseTheme } from "../../shared-module/styles"
import { assertNotNullOrUndefined } from "../../shared-module/utils/nullability"
import ContentRenderer from "../ContentRenderer"

interface ResearchConsentFormProps {
  onClose: () => void
  editForm: boolean
  shouldAnswerResearchForm: boolean
  usersInitialAnswers?: ResearchFormQuestionAnswer[]
  researchForm: ResearchForm
}

type UserAnswer = {
  questionId: string
  answer: boolean
}

const SelectResearchConsentForm: React.FC<React.PropsWithChildren<ResearchConsentFormProps>> = ({
  editForm,
  onClose,
  shouldAnswerResearchForm,
  usersInitialAnswers,
  researchForm,
}) => {
  const { t } = useTranslation()
  const userId = useUserInfo().data?.user_id
  const courseId = useContext(PageContext).pageData?.course_id

  const [questionIdsAndAnswers, setQuestionIdsAndAnswers] = useState<{ [key: string]: boolean }>()
  const getResearchFormQuestions = useQuery(
    [`courses-${courseId}-research-consent-form-questions`],
    () => fetchResearchFormQuestionsWithCourseId(assertNotNullOrUndefined(courseId)),
  )

  // Adds all checkbox ids and false as default answer to questionIdsAndAnswers
  useEffect(() => {
    if (usersInitialAnswers) {
      const questions = usersInitialAnswers?.reduce(
        (acc, obj) => ({
          ...acc,
          [obj.research_form_question_id]: obj.research_consent,
        }),
        {},
      )
      setQuestionIdsAndAnswers(questions)
    } else {
      const questions = getResearchFormQuestions.data?.reduce(
        (acc, obj) => ({
          ...acc,
          [obj.id]: false,
        }),
        {},
      )
      setQuestionIdsAndAnswers(questions)
    }
  }, [getResearchFormQuestions.data, setQuestionIdsAndAnswers, usersInitialAnswers])

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
  console.log(usersInitialAnswers)
  const handleOnSubmit = async () => {
    if (questionIdsAndAnswers) {
      Object.entries(questionIdsAndAnswers).forEach(([id, bol]) => {
        const newAnswer: UserAnswer = { questionId: id, answer: bol }
        mutation.mutate(newAnswer)
      })
    }
    onClose()
  }
  return (
    <div>
      <Dialog open={shouldAnswerResearchForm || editForm} noPadding={true} closeable={false}>
        <div
          className={css`
            display: flex;
            line-height: 22px;
            padding: 16px 20px 16px 20px;
          `}
        >
          <CheckboxContext.Provider value={{ questionIdsAndAnswers, setQuestionIdsAndAnswers }}>
            <ContentRenderer
              data={(researchForm.content as Array<Block<unknown>>) ?? []}
              editing={false}
              selectedBlockId={null}
              setEdits={(map) => map}
              isExam={false}
            />
          </CheckboxContext.Provider>
        </div>

        <div
          className={css`
            display: flex;
            justify-content: flex-end;
            align-items: center;
            padding: 16px 20px;
            height: 72px;
            border: ${baseTheme.colors.clear[700]};
            border-style: solid;
            border-width: 1px 0px;
          `}
        >
          <Button
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
      </Dialog>
    </div>
  )
}

export default SelectResearchConsentForm
