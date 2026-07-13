"use client"

import styled from "@emotion/styled"
import { CheckCircle } from "@vectopus/atlas-icons-react"
import type { ReactNode } from "react"
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
  icon?: ReactNode
  headerColor?: string
  closeHoverBackgroundColor?: string
  deleteVariant?: boolean
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

const CloseIconWrapper = styled.div<{ hoverBackgroundColor: string }>`
  display: none;
  ${respondToOrLarger.xs} {
    display: block;
    margin-left: auto;
    height: 24px;

    svg {
      opacity: 0.7;
    }
    &:hover {
      background: ${({ hoverBackgroundColor }) => hoverBackgroundColor};
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

const SuccessHeader = styled.div<{ color: string }>`
  ${respondToOrLarger.xs} {
    font-size: 1.25rem;
  }
  color: ${({ color }) => color};
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
    <NotificationWrapper data-testid="toast-notification">
      <Content>
        <IconWrapper>
          {props.icon ?? <CheckCircle color={baseTheme.colors.green[600]} size={20} />}
        </IconWrapper>
        <TextWrapper role="alert" data-testid="toast-notification-success">
          <SuccessHeader
            color={props.headerColor ?? baseTheme.colors.green[600]}
            data-testid="toast-notification-success-title"
          >
            {props.header ??
              t(props.deleteVariant ? "default-toast-delete-title" : "default-toast-success-title")}
          </SuccessHeader>
          <SuccessMessage data-testid="toast-notification-success-message">
            {props.message ??
              t(
                props.deleteVariant
                  ? "default-toast-delete-message"
                  : "default-toast-success-message",
              )}
          </SuccessMessage>
        </TextWrapper>
        {props.toastId && (
          <CloseIconWrapper
            hoverBackgroundColor={props.closeHoverBackgroundColor ?? baseTheme.colors.gray[300]}
            onClick={() => toast.remove(props.toastId)}
          >
            <CloseIcon />
          </CloseIconWrapper>
        )}
      </Content>
    </NotificationWrapper>
  )
}

export default SuccessNotification
