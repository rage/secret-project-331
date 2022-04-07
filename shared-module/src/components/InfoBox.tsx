import styled from "@emotion/styled"
import React from "react"

import { respondToOrLarger } from "../styles/respond"

const Wrapper = styled.aside`
  ${respondToOrLarger.md} {
    width: 100vw;
  }

  ${respondToOrLarger.xxs} {
    width: 100vw;
  }

  width: 100vw;
  position: relative;
  left: calc(-50vw + 50%);
  padding: 1rem;
  margin-bottom: 5rem;
  margin-top: 4rem;
  background: rgba(246, 235, 232, 0.5) none repeat scroll 0% 0%;
  padding-left: 1rem;
  padding-top: 3rem;
  padding-bottom: 3rem;
  min-height: 17em;
  ul {
    padding-inline-start: 40px;
  }
`
const Container = styled.div`
  max-width: 880px;
  margin-left: auto;
  margin-right: auto;
  position: relative;
`

const Body = styled.div`
  padding-bottom: 0.5rem;
  width: auto;
  p {
    font-size: 1.125rem;
    line-height: 1.89;
  }
  ${respondToOrLarger.xxs} {
    margin-left: 1.5em;
    margin-right: 1.5em;
  }
  ${respondToOrLarger.xs} {
    margin-left: 1em;
    margin-right: 1em;
  }
  ${respondToOrLarger.md} {
    padding-bottom: 0.5rem;
    width: auto;
    margin-left: 3em;
  }
`
export interface InfoBoxComponentProps {
  bodyText: string
  title?: string
}

const InfoBox: React.FC<InfoBoxComponentProps> = ({ title, bodyText }) => {
  return (
    <Wrapper>
      <Container>
        <Body>
          <h3> {title}</h3>
          <p> {bodyText}</p>
        </Body>
        {/*Icon block here*/}
      </Container>
    </Wrapper>
  )
}

export default InfoBox
