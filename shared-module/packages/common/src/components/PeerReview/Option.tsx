import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import Button from "../Button"

const Wrapper = styled.div`
  margin: 0 auto;
  max-width: 1000px;
`
const Header = styled.div`
  border-bottom: 4px solid #fff;
`
const Body = styled.div`
  background: #f9f9f9;

  h3 {
    padding: 20px 40px;
    text-transform: uppercase;
  }
`
const Text = styled.div`
  padding: 20px 40px 40px 40px;

  p {
    font-size: 20px;
    line-height: 30px;
    color: #313947;
  }
`
const Footer = styled.div`
  margin-top: 15px;
  background: #f9f9f9;
  height: auto;
  display: flex;
  justify-content: space-between;
  padding: 20px 40px;
`

const TITLE = "Option 1"
const CONTENT = `Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum
has been the industrys standard dummy text ever since the 1500s, when an unknown printer
took a galley of type and scrambled it to make a type specimen book. It has survived not
only five centuries, but also the leap into electronic typesetting, remaining
essentially unchanged. It was popularised in the 1960s with the release of Letraset
sheets containing Lorem Ipsum passages, and more recently with desktop publishing
software like Aldus PageMaker including versions of Lorem Ipsum. Lorem Ipsum is simply
dummy text of the printing and typesetting industry. Lorem Ipsum has been the industrys
standard dummy text ever since the 1500s, when an unknown printer took a galley of type
and scrambled it to make a type specimen book. It has survived not only five centuries,
but also the leap into electronic typesetting, remaining essentially unchanged. Lorem
Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has
been the industrys standard dummy text ever since the 1500s.`

export type OptionComponentProps = React.HTMLAttributes<HTMLDivElement>

const Option: React.FC<
  React.PropsWithChildren<React.PropsWithChildren<OptionComponentProps>>
> = () => {
  const { t } = useTranslation()
  return (
    <Wrapper>
      <Body>
        <Header>
          <h3>{TITLE}:</h3>
        </Header>
        <Text>
          <p>{CONTENT}</p>
        </Text>
      </Body>
      <Footer>
        <Button transform="capitalize" variant="primary" size="large">
          {t("shuffle")}
        </Button>
        <Button transform="capitalize" variant="primary" size="large">
          {t("report-as-spam")}
        </Button>
      </Footer>
    </Wrapper>
  )
}

export default Option
