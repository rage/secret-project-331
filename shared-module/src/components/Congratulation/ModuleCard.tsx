/* eslint-disable i18next/no-literal-string */
import styled from "@emotion/styled"

import CircularCheck from "../../img/circular-check.svg"
import { headingFont } from "../../styles"

import { CTAWrapper, RegisterLink, StyledLink } from "./index"

const Wrapper = styled.div`
  font-family: ${headingFont};
  width: 500px;
  height: 200px;
  background: #6fb37e;
  box-shadow: 0px 10px 20px rgba(68, 130, 126, 0.2);
  border-radius: 4px;
  margin-top: 5rem;
  text-align: left;
  padding: 1.4rem;
  position: relative;
`
const StyledSVG = styled(CircularCheck)`
  position: absolute;
  top: 26px;
  right: 29px;
`

const ModuleCard = ({ title = "The Intoduction to the University of Helsinki and ..." }) => {
  return (
    <Wrapper>
      <StyledSVG />
      <h3>{title}</h3>
      <CTAWrapper>
        <RegisterLink>Register</RegisterLink>
        <StyledLink>Generate certificate</StyledLink>
      </CTAWrapper>
    </Wrapper>
  )
}

export default ModuleCard
