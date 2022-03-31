import { Checkbox, FormControl, FormControlLabel } from "@mui/material"
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
          onChange={(value) => dispatch(editedOptionTitle(value, storeOption.id))}
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
              ? (value) => dispatch(editedOptionSuccessMessage(storeOption.id, value))
              : (value) => dispatch(editedOptionFailureMessage(storeOption.id, value))
          }
        />
      </ModalContent>
    </>
  )
}

export default OptionModalContent
