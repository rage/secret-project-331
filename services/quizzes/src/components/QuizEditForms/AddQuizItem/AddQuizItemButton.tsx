import { css } from "@emotion/css"
import { t } from "i18next"
import React from "react"
import { useDispatch } from "react-redux"

import Button from "../../../shared-module/components/Button"
import { createdNewItem } from "../../../store/editor/editorActions"
import { useTypedSelector } from "../../../store/store"

interface ButtonProps {
  type: string
}

export const AddQuizItemButton: React.FC<ButtonProps> = ({ type }) => {
  const dispatch = useDispatch()
  const quizId = useTypedSelector((state) => state.editor.quizId)
  const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1)
  return (
    <>
      <Button
        // eslint-disable-next-line i18next/no-literal-string
        title={t("add-new-quiz-title-text", { capitalizedType })}
        variant="outlined"
        transform="capitalize"
        onClick={() => dispatch(createdNewItem(quizId, type))}
        size={"medium"}
        className={css`
          margin-bottom: 1rem;
          margin-left: 1rem;
        `}
      >
        {type}
      </Button>
    </>
  )
}

export default AddQuizItemButton
