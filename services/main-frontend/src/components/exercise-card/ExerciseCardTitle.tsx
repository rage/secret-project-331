"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { headingFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

const LONG_NAME_LENGTH = 35

/** Smaller type on narrow viewports so longer exercise names fit without crowding the header. */
function titleStyles(isNameLong: boolean) {
  const long = isNameLong
  return {
    heading: css`
      font-size: ${long ? "1.03rem" : "1.08rem"};
      font-weight: 500;
      font-family: ${headingFont} !important;
      overflow-wrap: anywhere;
      min-width: 0;
      margin-top: -2px;

      /* Focused programmatically after grading, not via tab, so no focus ring needed. */
      &:focus {
        outline: none;
      }

      ${respondToOrLarger.xxxs} {
        font-size: ${long ? "1.06rem" : "1.14rem"};
      }
      ${respondToOrLarger.xxs} {
        font-size: ${long ? "1.09rem" : "1.2rem"};
      }
      ${respondToOrLarger.xs} {
        font-size: ${long ? "1.12rem" : "1.28rem"};
      }
      ${respondToOrLarger.sm} {
        font-size: ${long ? "1.16rem" : "1.36rem"};
      }
      ${respondToOrLarger.md} {
        font-size: ${long ? "1.2rem" : "1.46rem"};
      }
      ${respondToOrLarger.lg} {
        font-size: ${long ? "1.3rem" : "1.58rem"};
      }
      ${respondToOrLarger.xl} {
        font-size: ${long ? "1.4rem" : "1.7rem"};
      }
    `,
    label: css`
      font-weight: 600;
      font-size: 0.8125rem;
      margin-bottom: 0.25rem;

      ${respondToOrLarger.xxxs} {
        font-size: 0.875rem;
      }
      ${respondToOrLarger.xxs} {
        font-size: 0.90625rem;
      }
      ${respondToOrLarger.xs} {
        font-size: 0.9375rem;
      }
      ${respondToOrLarger.sm} {
        font-size: 0.96875rem;
      }
      ${respondToOrLarger.md} {
        font-size: 1rem;
      }
      ${respondToOrLarger.lg} {
        font-size: 1.0625rem;
      }
      ${respondToOrLarger.xl} {
        font-size: 1.125rem;
      }
    `,
    nameLine: css`
      line-height: 1.38;
      padding-bottom: 0.2rem;
    `,
  }
}

interface ExerciseCardTitleProps {
  name: string
  id?: string
  ref?: React.Ref<HTMLHeadingElement>
  tabIndex?: number
}

/** An exercise card's heading as students see it: an "Exercise:" label over the name. */
const ExerciseCardTitle: React.FC<ExerciseCardTitleProps> = ({ name, ...headingProps }) => {
  const { t } = useTranslation()
  const styles = titleStyles(name.length > LONG_NAME_LENGTH)
  return (
    <h2 {...headingProps} className={styles.heading}>
      <div className={styles.label}>{t("label-exercise")}:</div>
      <div className={styles.nameLine}>{name}</div>
    </h2>
  )
}

export default ExerciseCardTitle
