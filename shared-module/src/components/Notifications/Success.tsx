import styled from "@emotion/styled"
import { useTranslation } from "react-i18next"

import SuccessIcon from "../../img/SuccessIcon.svg"
import { baseTheme } from "../../styles"
import { respondToOrLarger } from "../../styles/respond"

interface SuccessNotificationProps {
  header?: string
  message?: string
}

const Wrapper = styled.div`
  ${respondToOrLarger.xs} {
    width: 400px;
    height: 100px;
  }
  width: 150px;
  background: ${baseTheme.colors.grey[200]};
`

const Content = styled.div`
  padding: 1rem 1rem;
  display: flex;
  flex-direction: row;
  ${respondToOrLarger.xs} {
    flex-direction: column;
    padding: 1.4rem 2rem;
    flex-wrap: wrap;
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
    flex-basis: 100%;
    padding-right: 1rem;
  }

  svg {
    display: block;
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

const SuccessNotification = (props: SuccessNotificationProps): JSX.Element => {
  const { t } = useTranslation()
  return (
    <Wrapper>
      <Content>
        <IconWrapper>
          <SuccessIcon />
        </IconWrapper>
        <SuccessHeader>{props.header ?? t("success-title")}</SuccessHeader>
        <SuccessMessage>{props.message ?? t("edit-has-been-saved")}</SuccessMessage>
      </Content>
    </Wrapper>
  )
}

export default SuccessNotification
