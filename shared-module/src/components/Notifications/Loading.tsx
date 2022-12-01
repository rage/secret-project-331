import { keyframes } from "@emotion/react"
import styled from "@emotion/styled"
import { useTranslation } from "react-i18next"

import { baseTheme } from "../../styles"
import { respondToOrLarger } from "../../styles/respond"
import Spinner from "../Spinner"

import { NotificationWrapper } from "./Base"

interface LoadingNotificationProps {
  message?: string
}

const fadeIn = keyframes`
0% {
  opacity: 0;
}
100% {
  opacity: 1;
}
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
  /** We will hide the loading state for a short while because flashing loading animations make the notification look weird **/
  opacity: 0;
  animation-name: ${fadeIn};
  animation-duration: 600ms;
  animation-timing-function: ease;
  animation-iteration-count: 1;
  animation-delay: 400ms;
  animation-fill-mode: forwards;
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

const TextWrapper = styled.div`
  display: inline-flex;
  flex-direction: column;
  height: 100%;
  margin-bottom: 0.5rem;
  ${respondToOrLarger.xs} {
    padding-top: 0.1rem;
  }
`

const LoadingMessage = styled.div`
  display: none;
  color: ${baseTheme.colors.gray[500]};
  ${respondToOrLarger.xs} {
    display: block;
  }
`

const LoadingNotification = (props: LoadingNotificationProps) => {
  const { t } = useTranslation()
  return (
    <NotificationWrapper className="toast-notification">
      <Content>
        <IconWrapper>
          <Spinner variant={"medium"} />
        </IconWrapper>
        <TextWrapper role="alert">
          <LoadingMessage>{props.message ?? t("default-toast-loading-message")}</LoadingMessage>
        </TextWrapper>
      </Content>
    </NotificationWrapper>
  )
}

export default LoadingNotification
