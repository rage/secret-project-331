import { faInfoCircle } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { FormControlLabel, MenuItem, Switch, TextField } from "@material-ui/core"
import AdapterDateFns from "@material-ui/lab/AdapterDateFns"
import DateTimePicker from "@material-ui/lab/DateTimePicker"
import LocalizationProvider from "@material-ui/lab/LocalizationProvider"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import styled from "styled-components"

import {
  editedQuizTitle,
  editedQuizTriesLimited,
  editedQuizzesAutoconfirm,
  editedQuizzesBody,
  editedQuizzesDeadline,
  editedQuizzesNumberOfTries,
  editedQuizzesPart,
  editedQuizzesPointsGrantingPolicy,
  editedQuizzesPointsToGain,
  editedQuizzesSection,
  editedQuizzesSubmitmessage,
} from "../../store/editor/quiz/quizActions"
import { useTypedSelector } from "../../store/store"
import MarkdownEditor from "../MarkdownEditor"

const SubsectionTitleWrapper = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 1.5rem;
  justify-content: center;
`

const NumberOfTriesContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  width: 100%;
`
const TryLimitNumberContainer = styled.div`
  width: 50%;
  padding-left: 1rem;
`

const ToggleAndHelperWrapper = styled.div`
  display: flex;
  flex-direction: column;
  width: 50%;
`

const InfoContainer = styled.div`
  padding: 1rem 0;
  display: flex;
`

const TitleIcon = styled(FontAwesomeIcon)`
  width: 2rem;
  height: 2rem;
  margin-right: 0.25rem;
`

const PartField = styled(TextField)`
  display: flex;
  margin-right: 0.5rem !important;
`

const SectionField = styled(TextField)`
  display: flex;
  margin-left: 0.5rem !important;
`

const HelperText = styled.h4`
  display: flex !important;
  margin-top: 1rem !important;
  margin-bottom: 1rem !important;
  color: #9e9e9e !important;
`

const MarginlessHelperText = styled.h4`
  display: flex !important;
  margin-bottom: 1rem !important;
  color: #9e9e9e !important;
`

const AutoConfirmSwitch = styled.div`
  display: flex;
  flex-wrap: wrap;
  width: 50%;
`

const BasicInformation: React.FC = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()

  const quizId = useTypedSelector((state) => state.editor.quizId)

  const pointsGrantingPolicy = useTypedSelector(
    (state) => state.editor.quizzes[quizId].grantPointsPolicy,
  )

  const numberOfTries = useTypedSelector((state) => state.editor.quizzes[quizId].tries)

  const triesAreLimited = useTypedSelector((state) => state.editor.quizzes[quizId].triesLimited)

  const pointsToGain = useTypedSelector((state) => state.editor.quizzes[quizId].points)
  const title = useTypedSelector((state) => state.editor.quizzes[quizId].title)

  const body = useTypedSelector((state) => state.editor.quizzes[quizId].body)

  const submitMessage = useTypedSelector((state) => state.editor.quizzes[quizId].submitMessage)
  const part = useTypedSelector((state) => state.editor.quizzes[quizId].part)

  const section = useTypedSelector((state) => state.editor.quizzes[quizId].section)

  const variables = useTypedSelector((state) => state.editor.quizVariables[quizId])

  const autoConfirm = useTypedSelector((state) => state.editor.quizzes[quizId].autoConfirm)

  return (
    <>
      <SubsectionTitleWrapper>
        <TitleIcon icon={faInfoCircle} />
        <h2>{t("quiz-information")}</h2>
      </SubsectionTitleWrapper>

      <InfoContainer>
        <MarkdownEditor
          label={t("title")}
          text={title ?? ""}
          onChange={(event) => dispatch(editedQuizTitle(event.target.value, quizId))}
        />
      </InfoContainer>
      <InfoContainer>
        <PartField
          fullWidth
          type="number"
          label={t("part")}
          variant="outlined"
          value={part}
          InputLabelProps={{ shrink: true }}
          onChange={(event) => dispatch(editedQuizzesPart(quizId, Number(event.target.value)))}
        />
        <SectionField
          fullWidth
          type="number"
          label={t("section")}
          variant="outlined"
          value={section}
          InputLabelProps={{ shrink: true }}
          onChange={(event) => dispatch(editedQuizzesSection(quizId, Number(event.target.value)))}
        />
      </InfoContainer>
      <NumberOfTriesContainer>
        <ToggleAndHelperWrapper>
          <FormControlLabel
            id="label"
            control={
              <Switch
                checked={triesAreLimited}
                onChange={(event) => dispatch(editedQuizTriesLimited(event.target.checked, quizId))}
                color="secondary"
                inputProps={{ "aria-label": t("limit-tries") }}
              />
            }
            label={t("limit-tries")}
            labelPlacement="end"
          />
          <MarginlessHelperText>{t("limit-tries-explanation")}</MarginlessHelperText>
        </ToggleAndHelperWrapper>
        <TryLimitNumberContainer>
          {triesAreLimited && (
            <TextField
              type="number"
              InputLabelProps={{ shrink: true }}
              label={t("number-of-tries-allowed")}
              variant="outlined"
              value={numberOfTries}
              fullWidth
              onChange={(event) =>
                dispatch(editedQuizzesNumberOfTries(Number(event.target.value), quizId))
              }
            />
          )}
        </TryLimitNumberContainer>
      </NumberOfTriesContainer>
      <InfoContainer>
        <TextField
          label={t("points-to-gain")}
          type="number"
          fullWidth
          variant="outlined"
          value={pointsToGain}
          InputLabelProps={{ shrink: true }}
          onChange={(event) =>
            dispatch(editedQuizzesPointsToGain(Number(event.target.value), quizId))
          }
        />
      </InfoContainer>
      <InfoContainer>
        <TextField
          fullWidth
          label={t("points-granting-policy")}
          variant="outlined"
          select
          value={pointsGrantingPolicy}
          onChange={(event) =>
            dispatch(editedQuizzesPointsGrantingPolicy(event.target.value, quizId))
          }
        >
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <MenuItem value="grant_whenever_possible">{t("grant-whenever-possible")}</MenuItem>
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <MenuItem value="grant_only_when_answer_fully_correct">
            {t("grant-only-when-fully-correct")}
          </MenuItem>
        </TextField>
      </InfoContainer>
      <InfoContainer>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DateTimePicker
            renderInput={(props) => <TextField {...props} />}
            // deadline not needed
            // eslint-disable-next-line i18next/no-literal-string
            label="DateTimePicker"
            value={variables.deadline}
            // eslint-disable-next-line i18next/no-literal-string
            inputFormat="dd-MM-yyyy, hh:mm:ss"
            onChange={(event) => {
              dispatch(editedQuizzesDeadline(event, quizId))
            }}
          />
        </LocalizationProvider>
      </InfoContainer>
      <InfoContainer>
        <MarkdownEditor
          text={body}
          label={t("quiz-description")}
          onChange={(event) => dispatch(editedQuizzesBody(quizId, event.target.value))}
        />
      </InfoContainer>
      <InfoContainer>
        <MarkdownEditor
          text={submitMessage ?? ""}
          label={t("submit-message")}
          onChange={(event) => dispatch(editedQuizzesSubmitmessage(quizId, event.target.value))}
        />
      </InfoContainer>
      <InfoContainer>
        <AutoConfirmSwitch>
          <FormControlLabel
            // eslint-disable-next-line i18next/no-literal-string
            label="Autoconfirm"
            labelPlacement="end"
            control={
              <Switch
                checked={autoConfirm}
                onChange={(event) =>
                  dispatch(editedQuizzesAutoconfirm(quizId, event.target.checked))
                }
              />
            }
          />
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <HelperText>
            When unchecked for a peer reviewed exercise, all answers must be reviewed manually
          </HelperText>
        </AutoConfirmSwitch>
      </InfoContainer>
    </>
  )
}

export default BasicInformation
