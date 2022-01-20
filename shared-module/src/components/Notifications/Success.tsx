import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { faCheck } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

import CloseIcon from "../../img/close.svg"
import { baseTheme } from "../../styles"
import { respondToOrLarger } from "../../styles/respond"

interface SuccessNotificationProps {
  header?: string
  message?: string
  toastId?: string
}

const Wrapper = styled.div`
  ${respondToOrLarger.xs} {
    width: 400px;
    min-height: 100px;
  }
  width: 150px;
  background: ${baseTheme.colors.grey[200]};
`

const Content = styled.div`
  padding: 1rem 1rem;
  display: flex;
  flex-direction: row;
  ${respondToOrLarger.xs} {
    padding: 1.4rem 2rem;
    flex-wrap: no-wrap;
    align-items: flex-start;
    justify-content: flex-start;
    align-content: flex-start;
  }
  justify-content: center;
  height: 100%;
`

const IconWrapper = styled.div`
  padding-right: 0.5rem;
  ${respondToOrLarger.xs} {
    padding-right: 1rem;
    padding-top: 0.1rem;
  }

  svg {
    display: block;
  }
`

const CloseIconWrapper = styled.div`
  display: none;
  ${respondToOrLarger.xs} {
    display: block;
    margin-left: auto;
    height: 24px;

    svg {
      opacity: 0.7;
    }
    &:hover {
      background: ${baseTheme.colors.grey[300]};
      cursor: pointer;
    }
  }
`

const TextWrapper = styled.div`
  display: inline-flex;
  flex-direction: column;
  height: 100%;
  ${respondToOrLarger.xs} {
    padding-top: 0.1rem;
  }
`

const SuccessHeader = styled.div`
  ${respondToOrLarger.xs} {
    font-size: 1.25rem;
  }
  color: ${baseTheme.colors.green[100]};
  line-height: 18px;
`

const SuccessMessage = styled.div`
  margin-top: auto;
  opacity: 0.4;
  display: none;
  ${respondToOrLarger.xs} {
    display: block;
  }
`

const SuccessNotification = (props: SuccessNotificationProps) => {
  const { t } = useTranslation()
  return (
    <Wrapper>
      <Content>
        <IconWrapper>
          <FontAwesomeIcon
            className={css`
              color: ${baseTheme.colors.green[100]};
            `}
            icon={faCheck}
          />
        </IconWrapper>
        <TextWrapper>
          <SuccessHeader>{props.header ?? t("default-toast-success-title")}</SuccessHeader>
          <SuccessMessage>{props.message ?? t("default-toast-success-message")}</SuccessMessage>
        </TextWrapper>
        {props.toastId && (
          <CloseIconWrapper onClick={() => toast.remove(props.toastId)}>
            <CloseIcon />
          </CloseIconWrapper>
        )}
      </Content>
    </Wrapper>
  )
}

export default SuccessNotification
