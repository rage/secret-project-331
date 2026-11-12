"use client"

import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

import { linkifyResourceLine } from "../analysis-form/analysisFormDomain"
import GuidanceText from "../GuidanceText"
import GreatMoocVisionField from "./GreatMoocVisionField"

const rootStyles = css`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 56rem;
  padding-bottom: 2rem;
`

const cardStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  background: white;
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
  border: 1px solid ${baseTheme.colors.gray[200]};
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
`

const headingStyles = css`
  font-size: 1.2rem;
  font-weight: 650;
  color: ${baseTheme.colors.gray[900]};
  margin: 0;
`

const subheadingStyles = css`
  font-size: 1rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[800]};
  margin: 0.25rem 0 0 0;
`

const noteStyles = css`
  border-left: 3px solid ${baseTheme.colors.green[500]};
  padding: 0.35rem 0 0.35rem 0.75rem;
  margin: 0;
  font-size: 0.9rem;
  color: ${baseTheme.colors.gray[700]};
  line-height: 1.55;
`

const letterGridStyles = css`
  display: grid;
  gap: 0.85rem;
  grid-template-columns: minmax(0, 1fr);

  ${respondToOrLarger.md} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`

const letterCardStyles = css`
  border-radius: 0.5rem;
  border: 1px solid ${baseTheme.colors.gray[200]};
  background: ${baseTheme.colors.gray[50]};
  padding: 0.85rem 1rem;
`

const bulletListStyles = css`
  margin: 0.4rem 0 0 0;
  padding-left: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.88rem;
  color: ${baseTheme.colors.gray[700]};
  line-height: 1.5;
`

const uhBoxStyles = css`
  border-radius: 0.5rem;
  border: 1px solid ${baseTheme.colors.blue[200]};
  background: ${baseTheme.colors.blue[25]};
  padding: 0.85rem 1rem;
`

/** Bullet list from translated text with one item per line. */
function BulletList(props: { text: string }) {
  const items = props.text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
  return (
    <ul className={bulletListStyles}>
      {items.map((item, index) => (
        <li key={index}>{linkifyResourceLine(item)}</li>
      ))}
    </ul>
  )
}

const MOOC_LETTERS = [
  {
    headingKey: "course-plans-mooc-design-massive",
    pointsKey: "course-plans-mooc-design-massive-points",
  },
  {
    headingKey: "course-plans-mooc-design-open",
    pointsKey: "course-plans-mooc-design-open-points",
  },
  {
    headingKey: "course-plans-mooc-design-online",
    pointsKey: "course-plans-mooc-design-online-points",
  },
  {
    headingKey: "course-plans-mooc-design-course",
    pointsKey: "course-plans-mooc-design-course-points",
  },
] as const

/** The "MOOC design" tab: how to use the planner, what a MOOC is and how mooc.fi courses are built. */
export default function MoocDesignOverview(props: {
  planId: string
  greatMoocVision: string | null | undefined
  isReadOnly: boolean
}) {
  const { planId, greatMoocVision, isReadOnly } = props
  const { t } = useTranslation()
  const showUhInfo = process.env.NEXT_PUBLIC_SHOW_UH_ANALYSIS_RESOURCES !== "false"

  return (
    <div className={rootStyles}>
      <section className={cardStyles} aria-labelledby="mooc-design-welcome">
        <h3 className={headingStyles} id="mooc-design-welcome">
          {t("course-plans-mooc-design-welcome-heading")}
        </h3>
        <GuidanceText text={t("course-plans-mooc-design-welcome")} />
      </section>

      <section className={cardStyles} aria-labelledby="mooc-design-process">
        <h3 className={headingStyles} id="mooc-design-process">
          {t("course-plans-mooc-design-process-heading")}
        </h3>
        <GuidanceText text={t("course-plans-mooc-design-process")} />
        <p className={noteStyles}>{t("course-plans-mooc-design-process-note")}</p>
      </section>

      <section className={cardStyles} aria-labelledby="mooc-design-what-is">
        <h3 className={headingStyles} id="mooc-design-what-is">
          {t("course-plans-mooc-design-what-is-heading")}
        </h3>
        <div className={letterGridStyles}>
          {MOOC_LETTERS.map((letter) => (
            <div key={letter.headingKey} className={letterCardStyles}>
              <h4 className={subheadingStyles}>{t(letter.headingKey)}</h4>
              <BulletList text={t(letter.pointsKey)} />
            </div>
          ))}
        </div>
        <p className={noteStyles}>{t("course-plans-mooc-design-what-is-source")}</p>
      </section>

      <section className={cardStyles} aria-labelledby="mooc-design-great">
        <h3 className={headingStyles} id="mooc-design-great">
          {t("course-plans-mooc-design-great-heading")}
        </h3>
        <GuidanceText text={t("course-plans-mooc-design-great")} />
        <GreatMoocVisionField
          planId={planId}
          greatMoocVision={greatMoocVision}
          isReadOnly={isReadOnly}
        />
      </section>

      <section className={cardStyles} aria-labelledby="mooc-design-structure">
        <h3 className={headingStyles} id="mooc-design-structure">
          {t("course-plans-mooc-design-structure-heading")}
        </h3>
        <GuidanceText text={t("course-plans-mooc-design-structure")} />
        {showUhInfo ? (
          <div className={uhBoxStyles}>
            <h4 className={subheadingStyles}>{t("course-plans-analysis-resources-uh-heading")}</h4>
            <GuidanceText text={t("course-plans-mooc-design-uh-registration")} />
          </div>
        ) : null}
        <GuidanceText text={t("course-plans-mooc-design-top-level-pages")} />
        <h4 className={subheadingStyles}>{t("course-plans-mooc-design-chapter-heading")}</h4>
        <GuidanceText text={t("course-plans-mooc-design-chapter")} />
        <BulletList text={t("course-plans-mooc-design-chapter-points")} />
        <h4 className={subheadingStyles}>{t("course-plans-mooc-design-page-heading")}</h4>
        <GuidanceText text={t("course-plans-mooc-design-page")} />
        <BulletList text={t("course-plans-mooc-design-page-points")} />
      </section>
    </div>
  )
}
