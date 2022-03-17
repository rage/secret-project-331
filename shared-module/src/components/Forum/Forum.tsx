/* eslint-disable i18next/no-literal-string */
import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useCallback, useRef, useState } from "react"

import RadioButton from "../InputFields/RadioButton"
import TextAreaField from "../InputFields/TextAreaField"

import Thread from "./Thread"

const placeholder = `Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has
been the industry's standard dummy text ever since the 1500s, when an unknown printer took
a galley of type and scrambled it to make a type specimen book. It has survived not only
five centuries, but also the leap into electronic typesetting, remaining essentially
unchanged.`

const authorObject = {
  id: "1001",
  text: placeholder,
  time: "12hr ago",
}
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
interface Item {
  id: string
  text: string
  time: string
}

interface Thread {
  id: string
  text: string
  time: string
  items?: Item[]
}

const Forum = () => {
  const [state, setState] = useState<Thread[]>([])
  const [visibility, setVisibility] = useState("hide")
  const [clicked, setClicked] = useState(false)
  const selectedId = useRef("")

  const current = new Date()

  const handleChange = (value, name) => {
    setVisibility(value)
  }

  const handleClick = (event) => {
    setClicked(!clicked)
    selectedId.current = event.target.id
  }

  const onKeyPress = (e) => {
    if (e.key === "Enter" && e.shiftKey == false) {
      const data = e.target.value
      setState((prevState) => {
        return prevState.map((item) => {
          return item.id === selectedId.current
            ? {
                ...item,
                items: [
                  { id: current.toLocaleString(), text: data, time: current.toLocaleString() },
                ],
              }
            : item
        })
      })

      setClicked(false)
    }
  }

  console.log("state", state)
  return (
    <Wrapper>
      <Head>
        <Thread state={authorObject} author={"Henrik Ngyren"} />
      </Head>
      {state?.map((obj) => (
        <Thread
          key={obj.id}
          state={obj}
          author={visibility === "hide" ? "Anonymous" : "Sebastien"}
          onKeyPress={onKeyPress}
          handleClick={handleClick}
          selectedId={selectedId.current}
          clicked={clicked}
        />
      ))}
      <CommentSection
        onSubmit={(e: React.SyntheticEvent) => {
          e.preventDefault()
          const target = e.target as typeof e.target & {
            comment: { value: string }
            visibility: { value: string }
          }

          const comment = target.comment.value
          const visible = target.visibility.value
          console.log("****comment", comment)

          setState((state) => [
            ...state,
            {
              id: String(current.toLocaleTimeString()),
              text: comment,
              time: current.toLocaleString(),
              item: [],
            },
          ])
          setVisibility(visible)
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
            checked={visibility === "show"}
            onChange={handleChange}
          />
          <RadioButton
            name="visibility"
            label="hide name"
            value="hide"
            onChange={handleChange}
            checked={visibility === "hide"}
          />
        </RadioSection>
        <TextAreaField
          name="comment"
          placeholder="leave a comment"
          /* value={state.comment} */
          onChange={() => null}
          onKeyPress={() => null}
        />
        <StyledButton type="submit" name="submit" value="Submit" />
      </CommentSection>
    </Wrapper>
  )
}

export default Forum
