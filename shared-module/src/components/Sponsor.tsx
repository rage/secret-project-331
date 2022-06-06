import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import SponsorLogoSVG from "../img/UHLogo.svg"
import { respondToOrLarger } from "../styles/respond"

const sponsors = [
  { id: "1", logo: <SponsorLogoSVG /> },
  { id: "2", logo: <SponsorLogoSVG /> },
]

const Container = styled.div`
  margin: 6rem 0;
  height: 100%;
  h2 {
    font-family: "Josefin Sans", sans-serif;
    font-weight: 500;
    text-transform: uppercase;
    font-size: clamp(28px, 3vw, 30px);
    color: #333;
    text-align: center;
    margin-bottom: 3rem;
  }
  ${respondToOrLarger.xxs} {
    width: 100%;
    margin: 0;
    padding: 0;
  }
  ${respondToOrLarger.xs} {
    padding: 0;
  }
  ${respondToOrLarger.sm} {
    width: 100%;
    padding: 0;
  }
`
const SponsorBox = styled.div`
  /*   padding: 2rem;
  width: 40px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
  margin: 2rem auto; */
  display: flex;
  flex-wrap: wrap;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  align-content: center;
  gap: 10px;
  img {
    display: flex;
    align-self: center;
  }
`
// eslint-disable-next-line i18next/no-literal-string
const SponsorLogo = styled.div<SponsorProps>`
  width: ${({ width }) => (width ? width : "200px")};
  aspect-ratio: 2 / 1;
  font-size: 1.6rem;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 50px;
  opacity: 0.9;
`

export interface SponsorExtraProps {
  logos: unknown
  width?: string
  title: string
}

export type SponsorProps = React.HTMLAttributes<HTMLDivElement> & SponsorExtraProps

const Sponsor: React.FC<SponsorProps> = ({ width = "250px" }, props) => {
  const { t } = useTranslation()

  return (
    <Container>
      <h2> {t("Sponsor")} </h2>
      <SponsorBox>
        {sponsors.map(({ logo, id }) => (
          <SponsorLogo key={id} {...props} width={width}>
            {logo}
          </SponsorLogo>
        ))}
      </SponsorBox>
    </Container>
  )
}

export default Sponsor
