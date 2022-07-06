/* eslint-disable i18next/no-literal-string */
import styled from "@emotion/styled"

import { headingFont } from "../../styles"

import ModuleCard from "./ModuleCard"

const Wrapper = styled.div`
  font-family: ${headingFont};
  background: #6ba578;
  width: 100%;
  border-radius: 4px;
  min-height: 50vh;
  display: flex;
  justify-content: center;
  align-items: center;
`
const Content = styled.div`
  width: 900px;
  height: auto;
  padding: 2rem;
  text-align: center;

  .heading {
    color: #f5f6f7;
    font-size: clamp(40px, 5vw, 70px) !important;
  }

  .subtitle {
    font-size: 20px;
    color: #ffffff;
    opacity: 0.8;
  }
`
export const CTAWrapper = styled.div`
  margin-top: 2rem;
`
export const RegisterLink = styled.a`
  padding: 1rem 2rem;
  background: #1a2333;
  font-size: 20px;
  margin-right: 10px;
  font-weight: bold;
  color: #6fb27e;
`
export const StyledLink = styled.a`
  padding: 1rem;
  font-size: 20px;
`

const Congratulation = () => {
  return (
    <Wrapper>
      <Content>
        <h1 className="heading">Onnittelut</h1>
        <span className="subtitle">
          The passage experienced a surge in popularity during the again during the 90s as{" "}
        </span>
        <CTAWrapper>
          <RegisterLink>Register</RegisterLink>
          <StyledLink>Generate certificate</StyledLink>
        </CTAWrapper>
        <ModuleCard />
      </Content>
    </Wrapper>
  )
}

export default Congratulation
