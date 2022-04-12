/* eslint-disable i18next/no-literal-string */
import styled from "@emotion/styled"
import React from "react"

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
export interface OptionComponentProps {}

const PLACEHOLDER_TEXT_ONE = "Shuffle"
const PLACEHOLDER_TEXT_TWO = "Report as spam"

const Option: React.FC<OptionComponentProps> = () => {
  return (
    <Wrapper>
      <Body>
        <Header>
          <h3>Option 1:</h3>
        </Header>
        <Text>
          <p>
            Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum
            has been the industry's standard dummy text ever since the 1500s, when an unknown
            printer took a galley of type and scrambled it to make a type specimen book. It has
            survived not only five centuries, but also the leap into electronic typesetting,
            remaining essentially unchanged. It was popularised in the 1960s with the release of
            Letraset sheets containing Lorem Ipsum passages, and more recently with desktop
            publishing software like Aldus PageMaker including versions of Lorem Ipsum. Lorem Ipsum
            is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the
            industry's standard dummy text ever since the 1500s, when an unknown printer took a
            galley of type and scrambled it to make a type specimen book. It has survived not only
            five centuries, but also the leap into electronic typesetting, remaining essentially
            unchanged. Lorem Ipsum is simply dummy text of the printing and typesetting industry.
            Lorem Ipsum has been the industry's standard dummy text ever since the 1500s.
          </p>
        </Text>
      </Body>
      <Footer>
        <Button transform="normal" variant="primary" size="large">
          {PLACEHOLDER_TEXT_ONE}
        </Button>
        <Button transform="normal" variant="primary" size="large">
          {PLACEHOLDER_TEXT_TWO}
        </Button>
      </Footer>
    </Wrapper>
  )
}

export default Option
