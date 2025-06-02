import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import AnswersRequiringAttentionItem from "./AnswersRequiringAttentionItem"

import { AnswerRequiringAttentionWithTasks } from "@/shared-module/common/bindings"
import { useAccordionContext } from "@/shared-module/common/components/Accordion/accordionContext"
import Button from "@/shared-module/common/components/Button"
import Centered from "@/shared-module/common/components/Centering/Centered"
import DebugModal from "@/shared-module/common/components/DebugModal"

interface Props {
  answersRequiringAttention: AnswerRequiringAttentionWithTasks[]
  exercise_max_points: number
  refetch: () => void
}

const AnswersRequiringAttentionList: React.FC<Props> = ({
  answersRequiringAttention,
  exercise_max_points,
  refetch,
}) => {
  const { expandAll, collapseAll } = useAccordionContext()
  const { t } = useTranslation()

  return (
    <>
      <Centered variant="narrow">
        <div
          className={css`
            margin-bottom: 1rem;
            display: flex;
            gap: 1rem;
            justify-content: flex-end;
          `}
        >
          <Button variant="secondary" size="small" onClick={expandAll}>
            {t("expand-all")}
          </Button>
          <Button variant="secondary" size="small" onClick={collapseAll}>
            {t("collapse-all")}
          </Button>
        </div>
        {answersRequiringAttention.map((answerRequiringAttention) => (
          <AnswersRequiringAttentionItem
            key={answerRequiringAttention.id}
            answerRequiringAttention={answerRequiringAttention}
            exerciseMaxPoints={exercise_max_points}
            refetch={refetch}
          />
        ))}
      </Centered>
      <DebugModal data={answersRequiringAttention} />
    </>
  )
}

export default AnswersRequiringAttentionList
