import { css } from "@emotion/css"
import styled from "@emotion/styled"
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  MoreHoriz as MoreHorizIcon,
} from "@mui/icons-material"
import React from "react"
import { useTranslation } from "react-i18next"

import { PaginationInfo } from "../hooks/usePaginationInfo"
import { headingFont } from "../styles"

import PaginationItemsPerPage from "./PaginationItemsPerPage"

interface PaginationProps {
  paginationInfo: PaginationInfo
  totalPages: number
  disableItemsPerPage?: boolean
}

const CAPACITY = 5

const Circle = styled.div`
  width: 47px;
  height: 47px;
  font-size: 20px;

  display: flex;
  justify-content: center;
  align-items: center;
  font-family: ${headingFont};
  &:hover {
    cursor: pointer;
  }
  color: #707070;
`
const SelectedCircle = styled.div`
  width: 47px;
  height: 47px;
  border-radius: 50%;
  font-family: ${headingFont};
  font-size: 20px;

  display: flex;
  justify-content: center;
  align-items: center;

  &:hover {
    cursor: pointer;
  }

  background-color: #222222;
  color: #ffffff;
`
const LeftButton = styled.div`
  width: 47px;
  height: 47px;
  color: #707070;

  display: flex;
  justify-content: center;
  align-items: center;

  &:hover {
    cursor: pointer;
  }
`
const RightButton = styled.div`
  width: 47px;
  height: 47px;
  color: #707070;

  display: flex;
  justify-content: center;
  align-items: center;

  &:hover {
    cursor: pointer;
  }
`
const HorizontalDots = styled.div`
  width: 47px;
  height: 47px;
  color: #707070;

  display: flex;
  justify-content: center;
  align-items: center;
`

const Container = styled.div`
  display: flex;
  flex-direction: row;
`

const CircleText = styled.div`
  position: relative;
  top: -1px;
`

const Pagination: React.FC<React.PropsWithChildren<React.PropsWithChildren<PaginationProps>>> = ({
  paginationInfo,
  totalPages,
  disableItemsPerPage = false,
}) => {
  const { t } = useTranslation()
  const page = paginationInfo.page
  const handleChangeEvent = (pageNumber: number) => (_changeEvent: unknown) => {
    if (totalPages <= 1) {
      return
    }
    paginationInfo.setPage(pageNumber)
  }

  /**
   * Generate an array of components for Pagination
   * @returns Components for pagination
   */
  const generateComponents = () => {
    const components: JSX.Element[] = []
    components.push(
      <LeftButton
        tabIndex={0}
        role="button"
        key={t("go-to-previous-page")}
        aria-label={t("go-to-previous-page")}
        onClick={handleChangeEvent(Math.max(1, page - 1))}
      >
        <ChevronLeftIcon />
      </LeftButton>,
    )

    // In case there is nothing
    if (totalPages === 0) {
      components.push(
        <SelectedCircle key={t("current-page-x")} aria-label={t("current-page-x", { number: 1 })}>
          <CircleText>1</CircleText>
        </SelectedCircle>,
      )
      components.push(
        <RightButton
          tabIndex={0}
          role="button"
          key={t("go-to-next-page")}
          aria-label={t("go-to-next-page")}
          onClick={handleChangeEvent(Math.min(page + 1, totalPages))}
        >
          <ChevronRightIcon />
        </RightButton>,
      )
      return components
    }

    if (totalPages <= CAPACITY + 2) {
      for (let idx = 1; idx <= totalPages; idx++) {
        if (idx == page) {
          components.push(
            <SelectedCircle key={idx} aria-label={t("current-page-x", { number: idx })}>
              <CircleText>{idx}</CircleText>
            </SelectedCircle>,
          )
        } else {
          components.push(
            <Circle
              tabIndex={0}
              role="button"
              key={t("go-to-page-x")}
              aria-label={t("go-to-page-x", { number: idx })}
              onClick={handleChangeEvent(idx)}
            >
              <CircleText>{idx}</CircleText>
            </Circle>,
          )
        }
      }

      components.push(
        <RightButton
          tabIndex={0}
          role="button"
          key={t("go-to-next-page")}
          aria-label={t("go-to-next-page")}
          onClick={handleChangeEvent(Math.min(page + 1, totalPages))}
        >
          <ChevronRightIcon />
        </RightButton>,
      )
      return components
    }

    if (page < CAPACITY) {
      for (let idx = 1; idx <= CAPACITY; idx++) {
        if (idx == page) {
          components.push(
            <SelectedCircle key={idx} aria-label={t("current-page-x", { number: idx })}>
              <CircleText>{idx}</CircleText>
            </SelectedCircle>,
          )
        } else {
          components.push(
            <Circle
              role="button"
              key={t("go-to-page-x")}
              aria-label={t("go-to-page-x", { number: idx })}
              onClick={handleChangeEvent(idx)}
            >
              <CircleText>{idx}</CircleText>
            </Circle>,
          )
        }
      }
      if (totalPages > CAPACITY) {
        components.push(
          <HorizontalDots>
            <MoreHorizIcon />
          </HorizontalDots>,
        )
      }
      components.push(
        <Circle key={totalPages} onClick={handleChangeEvent(totalPages)}>
          {totalPages}
        </Circle>,
      )
    } else if (CAPACITY <= page && page <= totalPages - CAPACITY + 1) {
      components.push(<Circle onClick={handleChangeEvent(1)}> 1 </Circle>)
      components.push(
        <HorizontalDots>
          <MoreHorizIcon />
        </HorizontalDots>,
      )
      components.push(
        <Circle
          tabIndex={0}
          role="button"
          key={t("go-to-page-x")}
          aria-label={t("go-to-page-x", { number: page - 1 })}
          onClick={handleChangeEvent(page - 1)}
        >
          <CircleText>{page - 1}</CircleText>
        </Circle>,
      )
      components.push(
        <SelectedCircle
          key={t("current-page-x")}
          aria-label={t("current-page-x", { number: page })}
        >
          <CircleText>{page}</CircleText>
        </SelectedCircle>,
      )
      components.push(
        <Circle
          tabIndex={0}
          role="button"
          key={t("go-to-page-x")}
          aria-label={t("go-to-page-x", { number: page + 1 })}
          onClick={handleChangeEvent(page + 1)}
        >
          <CircleText>{page + 1}</CircleText>
        </Circle>,
      )
      components.push(
        <HorizontalDots>
          <MoreHorizIcon />
        </HorizontalDots>,
      )
      components.push(
        <Circle
          tabIndex={0}
          role="button"
          key={t("go-to-page-x")}
          aria-label={t("go-to-page-x", { number: totalPages })}
          onClick={handleChangeEvent(totalPages)}
        >
          <CircleText>{totalPages}</CircleText>
        </Circle>,
      )
    } else {
      components.push(
        <Circle
          tabIndex={0}
          role="button"
          key={t("go-to-page-x")}
          aria-label={t("go-to-page-x", { number: 1 })}
          onClick={handleChangeEvent(1)}
        >
          <CircleText>1</CircleText>
        </Circle>,
      )
      components.push(
        <HorizontalDots key={"dots icon"}>
          <MoreHorizIcon />
        </HorizontalDots>,
      )
      for (let idx = totalPages - CAPACITY + 1; idx <= totalPages; idx++) {
        if (idx == page) {
          components.push(
            <SelectedCircle key={idx} aria-label={t("current-page-x", { number: idx })}>
              <CircleText>{idx}</CircleText>
            </SelectedCircle>,
          )
        } else {
          components.push(
            <Circle
              tabIndex={0}
              role="button"
              key={t("go-to-page-x")}
              aria-label={t("go-to-page-x", { number: idx })}
              onClick={handleChangeEvent(idx)}
            >
              <CircleText>{idx}</CircleText>
            </Circle>,
          )
        }
      }
    }

    components.push(
      <RightButton onClick={handleChangeEvent(Math.min(page + 1, totalPages))}>
        <ChevronRightIcon />
      </RightButton>,
    )
    return components
  }

  return (
    <div
      className={css`
        margin: 1rem auto;
        width: fit-content;
      `}
    >
      <Container>{generateComponents()}</Container>
      {!disableItemsPerPage && <PaginationItemsPerPage paginationInfo={paginationInfo} />}
    </div>
  )
}

export default Pagination
