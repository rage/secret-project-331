import { Checkbox, FormControl, FormControlLabel } from "@mui/material"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { NormalizedQuizItemOption } from "../../../../../types/types"
import {
  editedOptionAdditionalCorrectnessExplanationOnModelSolution,
  editedOptionAfterSubmissionSelectedMessage,
  editedOptionCorrectness,
  editedOptionTitle,
} from "../../../../store/editor/options/optionActions"
import { useTypedSelector } from "../../../../store/store"
import { ModalContent } from "../../../Shared/Modal"
import TextEditor from "../../../TextEditor"

interface OptionEditorProps {
  option: NormalizedQuizItemOption
}

export const OptionModalContent: React.FC<React.PropsWithChildren<OptionEditorProps>> = ({
  option,
}) => {
  const { t } = useTranslation()
  const storeOption = useTypedSelector((state) => state.editor.options[option.id])
  const dispatch = useDispatch()
  return (
    <>
      <ModalContent>
        <h4>{t("editing-option")}</h4>
      </ModalContent>
      <ModalContent>
        <FormControl>
          <FormControlLabel
            label={t("label-correct")}
            labelPlacement="start"
            control={
              <Checkbox
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
        <TextEditor
          label={t("option-title")}
          text={storeOption.title ?? ""}
          latex={true}
          inline
          markdown={true}
          onChange={(value) => dispatch(editedOptionTitle(value, storeOption.id))}
        />
      </ModalContent>
      <ModalContent>
        <TextEditor
          label={t("message-after-submission-when-selected")}
          text={storeOption.messageAfterSubmissionWhenSelected ?? ""}
          latex={true}
          inline
          markdown={true}
          onChange={(value) =>
            dispatch(editedOptionAfterSubmissionSelectedMessage(storeOption.id, value))
          }
        />
      </ModalContent>
      <ModalContent>
        <TextEditor
          label={t("additional-correctness-explanation-on-model-solution")}
          text={storeOption.additionalCorrectnessExplanationOnModelSolution ?? ""}
          latex={true}
          inline
          markdown={true}
          onChange={(value) =>
            dispatch(
              editedOptionAdditionalCorrectnessExplanationOnModelSolution(storeOption.id, value),
            )
          }
        />
      </ModalContent>
    </>
  )
}

export default OptionModalContent
