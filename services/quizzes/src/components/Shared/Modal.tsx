import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { Box, Button, Modal } from "@mui/material"

export const ModalWrapper = styled.article`
  padding: 3rem;
`

export const ModalContent = styled.div`
  padding: 1rem;
  display: flex;
`

export const ModalContentTitleWrapper = styled.div`
  display: flex;
  padding: 1rem;
  justify-content: center;
`

/**
 * QuizEditForms / QuizItem shared components
 */
export const StyledModal = styled(Modal)`
  display: flex;
  align-items: center;
  justify-content: center;
`

export const AdvancedBoxModalOpenClass = (
  clickYLocation: number | undefined,
  optionCount?: number,
) => css`
  ${clickYLocation &&
  ((optionCount !== undefined && optionCount < 3) || optionCount === undefined) &&
  // eslint-disable-next-line i18next/no-literal-string
  `
    position: fixed;
    top: ${clickYLocation}px;
  `}
`

export const AdvancedBox = styled(Box)`
  background-color: #fafafa;
  max-width: 60%;
  min-width: 60%;
  max-height: 500px;
  overflow-y: scroll;
`

export const CloseButton = styled(Button)`
  display: flex !important;
`

export const DeleteButton = styled(Button)`
  display: flex !important;
`

export const ModalButtonWrapper = styled.div`
  display: flex;
  justify-content: flex-end;
`
