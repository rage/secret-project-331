import { Checkbox, FormControl, FormControlLabel } from "@material-ui/core"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import styled from "styled-components"

import {
  editedOptionCorrectness,
  editedOptionFailureMessage,
  editedOptionSuccessMessage,
  editedOptionTitle,
} from "../../../../store/editor/options/optionActions"
import { useTypedSelector } from "../../../../store/store"
import { NormalizedQuizItemOption } from "../../../../types/types"
import MarkdownEditor from "../../../MarkdownEditor"

const ModalContent = styled.div`
  padding: 1rem;
  display: flex;
`

interface OptionEditorProps {
  option: NormalizedQuizItemOption
}

export const OptionModalContent: React.FC<OptionEditorProps> = ({ option }) => {
  const { t } = useTranslation()
  const storeOption = useTypedSelector((state) => state.editor.options[option.id])
  const dispatch = useDispatch()
  return (
    <>
      <ModalContent>
        <p>{t("editing-option")}</p>
      </ModalContent>
      <ModalContent>
        <FormControl>
          <FormControlLabel
            label={t("label-correct")}
            // eslint-disable-next-line i18next/no-literal-string
            labelPlacement="start"
            control={
              <Checkbox
                // eslint-disable-next-line i18next/no-literal-string
                color="primary"
                checked={storeOption.correct}
                onChange={(event) =>
                  dispatch(editedOptionCorrectness(storeOption.id, event.target.checked))
                }
              />
            }
          />
        </FormControl>
      </ModalContent>
      <ModalContent>
        <MarkdownEditor
          label={t("option-title")}
          text={storeOption.title ?? ""}
          onChange={(event) => dispatch(editedOptionTitle(event.target.value, storeOption.id))}
        />
      </ModalContent>
      <ModalContent>
        <MarkdownEditor
          label={storeOption.correct ? t("success-message") : t("failure-message")}
          text={
            storeOption.correct
              ? storeOption.successMessage ?? ""
              : storeOption.failureMessage ?? ""
          }
          onChange={
            storeOption.correct
              ? (event) => dispatch(editedOptionSuccessMessage(storeOption.id, event.target.value))
              : (event) => dispatch(editedOptionFailureMessage(storeOption.id, event.target.value))
          }
        />
      </ModalContent>
    </>
  )
}

export default OptionModalContent
