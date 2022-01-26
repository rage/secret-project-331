import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { faTimesCircle } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

import CloseIcon from "../../img/close.svg"
import { baseTheme } from "../../styles"
import { respondToOrLarger } from "../../styles/respond"

interface ErrorNotificationProps {
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
  background: ${baseTheme.colors.clear[200]};
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
      background: ${baseTheme.colors.grey[100]};
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

const ErrorHeader = styled.div`
  ${respondToOrLarger.xs} {
    font-size: 1.25rem;
  }
  color: ${baseTheme.colors.red[700]};
  line-height: 18px;
`

const ErrorMessage = styled.div`
  margin-top: auto;
  display: none;
  color: ${baseTheme.colors.grey[500]};
  ${respondToOrLarger.xs} {
    display: block;
  }
`

const ErrorNotification = (props: ErrorNotificationProps) => {
  const { t } = useTranslation()
  return (
    <Wrapper>
      <Content>
        <IconWrapper>
          <FontAwesomeIcon
            className={css`
              color: ${baseTheme.colors.red[700]};
            `}
            icon={faTimesCircle}
          />
        </IconWrapper>
        <TextWrapper role="alert">
          <ErrorHeader>{props.header ?? t("default-toast-error-title")}</ErrorHeader>
          <ErrorMessage>{props.message ?? t("default-toast-error-message")}</ErrorMessage>
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

export default ErrorNotification
