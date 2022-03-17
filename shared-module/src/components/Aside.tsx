import styled from "@emotion/styled"
import React from "react"

const Wrapper = styled.aside`
  padding-bottom: 2rem;
  padding-top: 1.5rem;
  border-top: 0.4rem solid #007acc;
  border-bottom: 0.4rem solid #007acc;
  background: rgba(0, 122, 204, 0.08);
  margin: 3rem 0;
`

const Header = styled.div`
  padding: 0 2rem 1rem 2rem;
  height: auto;
  display: flex;
  align-content: center;
  margin-top: 1.5rem;

  h4 {
    font-family: "Josefin Sans", sans-serif;
    font-size: clamp(20px, 2.4vw, 30px);
    font-weight: 500;
    color: #202020;
    text-align: center;
    margin: 0 auto;
  }
`

const Body = styled.div`
  text-align: center;
  padding: 0rem 2rem;
`
export interface AsideComponentProps {
  bodyText: string
  title?: string
}

const Aside: React.FC<AsideComponentProps> = ({ title, bodyText }) => {
  return (
    <Wrapper>
      {title !== undefined ? (
        <Header>
          <h4>{title}</h4>
        </Header>
      ) : null}
      <Body>{bodyText}</Body>
    </Wrapper>
  )
}

export default Aside
