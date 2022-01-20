import styled from "@emotion/styled"
import { useTranslation } from "react-i18next"

import { baseTheme } from "../../styles"
import { respondToOrLarger } from "../../styles/respond"
import Spinner from "../Spinner"

interface LoadingNotificationProps {
  message?: string
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

const TextWrapper = styled.div`
  display: inline-flex;
  flex-direction: column;
  height: 100%;
  ${respondToOrLarger.xs} {
    padding-top: 0.1rem;
  }
`

const LoadingMessage = styled.div`
  opacity: 0.4;
  display: none;
  ${respondToOrLarger.xs} {
    display: block;
  }
`

const LoadingNotification = (props: LoadingNotificationProps) => {
  const { t } = useTranslation()
  return (
    <Wrapper>
      <Content>
        <IconWrapper>
          <Spinner variant={"medium"} />
        </IconWrapper>
        <TextWrapper>
          <LoadingMessage>{props.message ?? t("default-toast-loading-message")}</LoadingMessage>
        </TextWrapper>
      </Content>
    </Wrapper>
  )
}

export default LoadingNotification
