import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme, headingFont } from "../styles"
import { respondToOrLarger } from "../styles/respond"

const Container = styled.div`
  margin: 6rem 0;
  height: 100%;
  h2 {
    font-family: ${headingFont};
    font-weight: 600;
    font-size: clamp(28px, 3vw, 30px);
    color: ${baseTheme.colors.grey[700]};
    text-align: center;
    margin-bottom: 2rem;
  }
  ${respondToOrLarger.xxs} {
    width: 100%;
    margin: 4rem 0;
    padding: 0;
  }
  ${respondToOrLarger.xs} {
    padding: 0;
    margin: 5rem 0;
  }
  ${respondToOrLarger.sm} {
    width: 100%;
    padding: 0;
    margin: 6rem 0;
  }
`
const SponsorBox = styled.div`
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
const SponsorLogo = styled.div<StyledSponsor>`
  width: ${({ width }) => (width ? width : "200px")};
  aspect-ratio: 2 / 1;
  font-size: 1.6rem;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 50px;
  opacity: 0.9;

  img {
    max-width: 100%;
    max-height: 100%;
  }

  @media (max-width: 767.98px) {
    width: 150px;
  }
`

interface Logo {
  clientId: string
  attributes: {
    url: string
    alt: string
  }
}

export interface SponsorExtraProps {
  logos: Logo[]
  width?: string
}
interface StyledSponsor {
  width?: string
}

export type SponsorProps = React.HTMLAttributes<HTMLDivElement> & SponsorExtraProps

const Sponsor: React.FC<React.PropsWithChildren<React.PropsWithChildren<SponsorProps>>> = ({
  width = "250px",
  logos,
}) => {
  const { t } = useTranslation()

  return (
    <Container>
      <h2> {t("partners")} </h2>
      <SponsorBox>
        {logos.map(({ attributes, clientId }) => {
          return (
            <SponsorLogo width={width} key={clientId}>
              <img src={attributes.url} alt={attributes.alt} />
            </SponsorLogo>
          )
        })}
      </SponsorBox>
    </Container>
  )
}

export default Sponsor
