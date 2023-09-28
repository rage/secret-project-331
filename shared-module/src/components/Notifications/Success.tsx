import styled from "@emotion/styled"
import { CheckCircle } from "@vectopus/atlas-icons-react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

import CloseIcon from "../../img/close.svg"
import { baseTheme } from "../../styles"
import { respondToOrLarger } from "../../styles/respond"

import { NotificationWrapper } from "./Base"

interface SuccessNotificationProps {
  header?: string
  message?: string
  toastId?: string
}

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
      background: ${baseTheme.colors.gray[300]};
      cursor: pointer;
    }
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

const SuccessHeader = styled.div`
  ${respondToOrLarger.xs} {
    font-size: 1.25rem;
  }
  color: ${baseTheme.colors.green[600]};
  line-height: 18px;
`

const SuccessMessage = styled.div`
  margin-top: auto;
  display: none;
  color: ${baseTheme.colors.gray[500]};
  ${respondToOrLarger.xs} {
    display: block;
  }
`

const SuccessNotification = (props: SuccessNotificationProps) => {
  const { t } = useTranslation()
  return (
    <NotificationWrapper className="toast-notification">
      <Content>
        <IconWrapper>
          <CheckCircle color={baseTheme.colors.green[600]} size={20} />
        </IconWrapper>
        <TextWrapper role="alert">
          <SuccessHeader>{props.header ?? t("default-toast-success-title")}</SuccessHeader>
          <SuccessMessage>{props.message ?? t("default-toast-success-message")}</SuccessMessage>
        </TextWrapper>
        {props.toastId && (
          <CloseIconWrapper onClick={() => toast.remove(props.toastId)}>
            <CloseIcon />
          </CloseIconWrapper>
        )}
      </Content>
    </NotificationWrapper>
  )
}

export default SuccessNotification
