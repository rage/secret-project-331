/* eslint-disable i18next/no-literal-string */
import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import { Visibility } from "@mui/icons-material"
import React, { ChangeEvent, useState } from "react"

import RadioButton from "../InputFields/RadioButton"
import TextAreaField from "../InputFields/TextAreaField"

import Thread from "./Thread"

const Wrapper = styled.div`
  background: #fff;
  width: 60%;
  height: auto;
  border: 2px solid rgba(205, 205, 205, 0.8);
  border-radius: 4px;
`
const Head = styled.div`
  border-bottom: 1px solid rgba(205, 205, 205, 0.6);
`
const CommentSection = styled.form`
  width: 100%;
  height: auto;
  border-top: 1px solid rgba(205, 205, 205, 0.6);
  padding: 2rem;
`
const Label = styled.span`
  color: #333;
  opacity: 0.5;
  font-size: 16px;
`
const RadioSection = styled.div`
  display: flex;
  margin-top: 0.2rem;
  margin-bottom: 1rem;
`

const StyledButton = styled.input`
  display: flex;
  border: none;
  align-self: end;
  padding: 0.5rem 2rem;
  font-size: 18px;
  color: #313947;
  margin-top: 1.5rem;
`
const leadingRadio = css`
  border-left: 1px solid rgba(205, 205, 205, 0.8);
  margin-right: 2rem !important;
`

const Forum = () => {
  const [state, setState] = useState({
    comment: "",
    visibility: "hide",
    items: "dkgksgksngkslkgnswgnk",
  })

  const current = new Date()

  const handleChange = (value, name) => {
    setState({
      ...state,
      [name]: value,
    })
    console.log("****name", name)
  }

  console.log("state", state)
  return (
    <Wrapper>
      <Head>
        <Thread></Thread>
      </Head>
      {state.comment && (
        <Thread
          text={state.comment}
          time={current.toLocaleTimeString()}
          author={state.visibility === "hide" && "Anonymous"}
          items={state.items}
        />
      )}
      <CommentSection
        onSubmit={(e: React.SyntheticEvent) => {
          e.preventDefault()
          const target = e.target as typeof e.target & {
            comment: { value: string }
          }

          const comment = target.comment.value
          console.log("****comment", comment)

          setState({
            ...state,
            comment: comment,
          })
          target.comment.value = ""
        }}
      >
        <Label>Select name visibility: </Label>
        <RadioSection>
          <RadioButton
            className={cx(leadingRadio)}
            name="visibility"
            label="show name"
            value="show"
            checked={state.visibility === "show"}
            onChange={handleChange}
          />
          <RadioButton
            name="visibility"
            label="hide name"
            value="hide"
            onChange={handleChange}
            checked={state.visibility === "hide"}
          />
        </RadioSection>
        <TextAreaField
          name="comment"
          placeholder="leave a comment"
          /* value={state.comment} */
          onChange={() => null}
        />
        <StyledButton type="submit" name="submit" value="Submit" />
      </CommentSection>
    </Wrapper>
  )
}

export default Forum
