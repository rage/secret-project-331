/* eslint-disable i18next/no-literal-string */
import styled from "@emotion/styled"
import { useTranslation } from "react-i18next"

import ConfettiBg from "../../img/confetti-bg.svg"
import { headingFont } from "../../styles"

import ModuleCard from "./ModuleCard"

const Wrapper = styled.div`
  font-family: ${headingFont};
  background: #6ba578;
  width: 100%;
  border-radius: 4px;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
`
const Content = styled.div`
  width: 900px;
  height: auto;
  padding: 2rem;
  text-align: center;
  position: relative;

  .heading {
    color: #f5f6f7;
    font-weight: 800;
    font-size: clamp(40px, 5vw, 70px) !important;
  }

  .subtitle {
    font-size: 22px;
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
const StyledSVG = styled(ConfettiBg)`
  position: absolute;
  left: 35%;
  top: 13px;
`

const Congratulation = ({ modules = true }) => {
  const { t } = useTranslation()
  return (
    <Wrapper>
      <Content>
        <StyledSVG />
        <h1 className="heading">Onnittelut</h1>
        <span className="subtitle">
          The passage experienced a surge in popularity during the again during the 90s as{" "}
        </span>
        <CTAWrapper>
          <RegisterLink>{t("register")}</RegisterLink>
          <StyledLink>{t("generate-certicate")}</StyledLink>
        </CTAWrapper>
        {modules && <ModuleCard />}
      </Content>
    </Wrapper>
  )
}

export default Congratulation
