import styled from "@emotion/styled"
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  MoreHoriz as MoreHorizIcon,
} from "@mui/icons-material"
import React from "react"

import { headingFont } from "../styles"

interface PaginationProps {
  count: number
  page: number
  onChange: (event: unknown, page: number) => void
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

const Pagination: React.FC<PaginationProps> = ({ count, page, onChange }) => {
  const handleChangeEvent = (pageNumber: number) => (changeEvent: unknown) => {
    onChange(changeEvent, pageNumber)
  }

  /**
   * Generate an array of components for Pagination
   * @returns Components for pagination
   */
  const generateComponents = () => {
    const components: JSX.Element[] = []
    components.push(
      <LeftButton onClick={handleChangeEvent(Math.max(1, page - 1))}>
        <ChevronLeftIcon />
      </LeftButton>,
    )

    // In case there is nothing
    if (count == 0) {
      components.push(<SelectedCircle> 1 </SelectedCircle>)
      components.push(
        <RightButton onClick={handleChangeEvent(Math.min(page + 1, count))}>
          <ChevronRightIcon />
        </RightButton>,
      )
      return components
    }

    if (count <= CAPACITY + 2) {
      for (let idx = 1; idx <= count; idx++) {
        if (idx == page) {
          components.push(<SelectedCircle> {idx} </SelectedCircle>)
        } else {
          components.push(<Circle onClick={handleChangeEvent(idx)}> {idx} </Circle>)
        }
      }

      components.push(
        <RightButton onClick={handleChangeEvent(Math.min(page + 1, count))}>
          <ChevronRightIcon />
        </RightButton>,
      )
      return components
    }

    if (page < CAPACITY) {
      for (let idx = 1; idx <= CAPACITY; idx++) {
        if (idx == page) {
          components.push(<SelectedCircle> {idx} </SelectedCircle>)
        } else {
          components.push(<Circle onClick={handleChangeEvent(idx)}> {idx} </Circle>)
        }
      }
      if (count > CAPACITY) {
        components.push(
          <HorizontalDots>
            <MoreHorizIcon />
          </HorizontalDots>,
        )
      }
      components.push(<Circle onClick={handleChangeEvent(count)}> {count}</Circle>)
    } else if (CAPACITY <= page && page <= count - CAPACITY + 1) {
      components.push(<Circle onClick={handleChangeEvent(1)}> 1 </Circle>)
      components.push(
        <HorizontalDots>
          <MoreHorizIcon />
        </HorizontalDots>,
      )
      components.push(<Circle onClick={handleChangeEvent(page - 1)}> {page - 1} </Circle>)
      components.push(<SelectedCircle> {page} </SelectedCircle>)
      components.push(<Circle onClick={handleChangeEvent(page + 1)}> {page + 1} </Circle>)
      components.push(
        <HorizontalDots>
          <MoreHorizIcon />
        </HorizontalDots>,
      )
      components.push(<Circle onClick={handleChangeEvent(count)}> {count} </Circle>)
    } else {
      components.push(<Circle onClick={handleChangeEvent(1)}> 1 </Circle>)
      components.push(
        <HorizontalDots>
          <MoreHorizIcon />
        </HorizontalDots>,
      )
      for (let idx = count - CAPACITY + 1; idx <= count; idx++) {
        if (idx == page) {
          components.push(<SelectedCircle> {idx} </SelectedCircle>)
        } else {
          components.push(<Circle onClick={handleChangeEvent(idx)}> {idx} </Circle>)
        }
      }
    }

    components.push(
      <RightButton onClick={handleChangeEvent(Math.min(page + 1, count))}>
        <ChevronRightIcon />
      </RightButton>,
    )
    return components
  }

  return <Container>{generateComponents()}</Container>
}

export default Pagination
