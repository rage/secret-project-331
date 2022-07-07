import styled from "@emotion/styled"
import { useTranslation } from "react-i18next"

import ConfettiBg from "../../img/confetti-bg.svg"
import { headingFont } from "../../styles"
import { respondToOrLarger } from "../../styles/respond"

import ModuleCard from "./ModuleCard"

// eslint-disable-next-line i18next/no-literal-string
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
  width: 100%;
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
const ModuleWrapper = styled.div`
  display: grid;
  grid-template-columns: minmax(auto, 520px);
  grid-gap: 20px;
  margin-top: 3rem;
  justify-content: center;

  ${respondToOrLarger.lg} {
    grid-template-columns: 520px 520px;
  }
`

const modules = [
  // eslint-disable-next-line i18next/no-literal-string
  { name: "Bonus module", title: "The Introduction to the University of Helsinki and ..." },
  // eslint-disable-next-line i18next/no-literal-string
  { name: "Another bonus module", title: "The Introduction to the secret project and MOOC ..." },
]

// eslint-disable-next-line i18next/no-literal-string
const subTitle = "The passage experienced a surge in popularity during the again during the 90s as"

const Congratulation = (/* { modules } */) => {
  const { t } = useTranslation()
  const isModule = modules.length > 1
  return (
    <Wrapper>
      <Content>
        <StyledSVG />
        <h1 className="heading">{t("congratulation")}!</h1>
        <span className="subtitle">{subTitle}</span>
        {!isModule && (
          <CTAWrapper>
            <RegisterLink>{t("register")}</RegisterLink>
            <StyledLink>{t("generate-certicate")}</StyledLink>
          </CTAWrapper>
        )}
        <ModuleWrapper>
          {isModule && modules.map(({ title, name }) => <ModuleCard title={title} key={name} />)}
        </ModuleWrapper>
      </Content>
    </Wrapper>
  )
}

export default Congratulation
