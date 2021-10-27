import { Checkbox, FormControl, FormControlLabel } from "@material-ui/core"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { NormalizedQuizItemOption } from "../../../../../types/types"
import {
  editedOptionCorrectness,
  editedOptionFailureMessage,
  editedOptionSuccessMessage,
  editedOptionTitle,
} from "../../../../store/editor/options/optionActions"
import { useTypedSelector } from "../../../../store/store"
import MarkdownEditor from "../../../MarkdownEditor"
import { ModalContent } from "../../../Shared/Modal"

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
