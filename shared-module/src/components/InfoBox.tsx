import styled from "@emotion/styled"
import React from "react"

const Wrapper = styled.aside`
  @media (min-width: 711px) {
    width: 100vw;
  }

  @media (min-width: 425px) {
    width: 100vw;
  }

  @media (min-width: 1px) {
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
  }
`
const Container = styled.div`
  max-width: 880px;
  margin-left: auto;
  margin-right: auto;
  position: relative;
`

const Body = styled.div`
  @media (min-width: 1px) {
    padding-bottom: 0.5rem;
    width: auto;
    margin-left: 2em;
  }
  @media (min-width: 425px) {
    padding-bottom: 0.5rem;
    width: auto;
    margin-left: 8em;
  }
  @media (min-width: 900px) {
    padding-bottom: 0.5rem;
    width: auto;
    margin-left: 15em;
  }
  p {
    font-size: 1.125rem;
    line-height: 1.89;
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
          {bodyText}
        </Body>
        {/*Icon block here*/}
      </Container>
    </Wrapper>
  )
}

export default InfoBox
