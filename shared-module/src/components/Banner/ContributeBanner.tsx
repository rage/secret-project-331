/* eslint-disable i18next/no-literal-string */
import styled from "@emotion/styled"
import React from "react"

import contributecover from "../../img/contribute.png"
import Arrow from "../../img/screwedArrow.svg"
import { baseTheme, headingFont } from "../../styles"

// eslint-disable-next-line i18next/no-literal-string
const BannerWrapper = styled.div`
  height: 257px;
  position: relative;
  img {
    position: absolute;
    right: 0;
    top: 0;
    width: 100%;
    height: 257px;
    z-index: -1;
    object-fit: cover;
  }

  margin-bottom: 10px;
`
const Content = styled.div`
  font-weight: 500;
  font-size: 1.2rem;
  line-height: 1.4;
  margin: 0 auto;
  max-width: 700px;
  text-align: center;
  padding-top: 30px;

  h2 {
    text-align: center;
  }
`
const Text = styled.div`
  text-align: center;
  font-size: 22px;

  div {
    color: #3b4754;
  }
`
const StyledLink = styled.a`
  font-family: ${headingFont};
  font-size: 30px;
  color: #44827e;
  text-decoration: none;

  span {
    padding-bottom: 10px;
    position: relative;
    margin-right: 10px;
  }

  span::after {
    content: "";

    width: 100%;
    position: absolute;
    left: 0;
    bottom: 5px;

    border-width: 0 0 3px;
    border-style: solid;
  }
`
const StyledArrow = styled(Arrow)`
  background: #dae6e5;
  width: 30px;
  height: 28px;
  border: 2px solid #8fb4b2;
  padding-left: 8px;
  padding-top: 7px;
`
export type ContributeProps = React.HTMLAttributes<HTMLDivElement>

const Contribute: React.FC<ContributeProps> = () => {
  return (
    <BannerWrapper>
      <img src={contributecover} alt="background cover" />
      <Content>
        <h2>Contribute to this project</h2>
        <Text>
          <div>
            Courses.mooc.fi is an open source project developed by the MOOC Centre of University of
            Helsinki. Star the project on github for more details:
          </div>
        </Text>
        <StyledLink href="github.com/rage/secret-project-331">
          <span>Go to project</span>
          <StyledArrow />
        </StyledLink>
      </Content>
    </BannerWrapper>
  )
}

export default Contribute
