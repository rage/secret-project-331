import styled from "@emotion/styled"
import { useTranslation } from "react-i18next"

import CircularCheck from "../../img/circular-check.svg"
import { headingFont } from "../../styles"

import { CTAWrapper, RegisterLink, StyledLink } from "./index"

// eslint-disable-next-line i18next/no-literal-string
const Wrapper = styled.div`
  font-family: ${headingFont};
  width: 520px;
  min-height: 190px;
  background: #6fb37e;
  box-shadow: 0px 10px 20px rgba(68, 130, 126, 0.2);
  border-radius: 4px;
  margin-top: 5rem;
  text-align: left;
  padding: 1.5rem;
  position: relative;

  h3 {
    color: #fff;
    font-style: normal;
    font-weight: 500;
    font-size: 25px;
    line-height: 30px;
  }
`
const StyledSVG = styled(CircularCheck)`
  position: absolute;
  top: 26px;
  right: 29px;
`
interface ModuleCardEXtraProps {
  title: string
}

export type ModuleType = React.HTMLAttributes<HTMLDivElement> & ModuleCardEXtraProps

const ModuleCard: React.FC<ModuleType> = ({ title }) => {
  const { t } = useTranslation()
  return (
    <Wrapper>
      <StyledSVG />
      <h3>{title}</h3>
      <CTAWrapper>
        <RegisterLink>{t("register")}</RegisterLink>
        <StyledLink>{t("generate-certicate")}</StyledLink>
      </CTAWrapper>
    </Wrapper>
  )
}

export default ModuleCard
