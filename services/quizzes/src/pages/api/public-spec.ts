/* eslint-disable i18next/no-literal-string */
import { NextApiRequest, NextApiResponse } from "next"

import { PublicQuiz, PublicQuizItem, PublicQuizItemOption, Quiz } from "../../../types/types"

export default (req: NextApiRequest, res: NextApiResponse): void => {
  if (req.method !== "POST") {
    return res.status(404).json({ message: "Not found" })
  }

  return handlePost(req, res)
}

function handlePost(req: NextApiRequest, res: NextApiResponse) {
  const quiz: Quiz = req.body

  const publicSpecQuiz: PublicQuiz = {
    id: quiz.id,
    courseId: quiz.courseId,
    body: quiz.body,
    deadline: quiz.deadline,
    open: quiz.open,
    part: quiz.part,
    section: quiz.section,
    title: quiz.title,
    tries: quiz.tries,
    triesLimited: quiz.triesLimited,
    items: quiz.items.map((i) => {
      const pi: PublicQuizItem = {
        id: i.id,
        body: i.body,
        direction: i.direction,
        formatRegex: i.formatRegex,
        maxLabel: i.maxLabel,
        maxValue: i.maxValue,
        maxWords: i.maxWords,
        minLabel: i.minLabel,
        minValue: i.minValue,
        minWords: i.minWords,
        multi: i.multi,
        order: i.order,
        quizId: i.quizId,
        title: i.title,
        type: i.type,
        options: i.options.map((o) => {
          const po: PublicQuizItemOption = {
            id: o.id,
            body: o.body,
            order: o.order,
            title: o.title,
            quizItemId: o.quizItemId,
          }
          return po
        }),
        timelineItems:
          i.timelineItems?.map((t) => {
            return { year: t.year, id: t.id }
          }) || [],
        timelineItemEvents: (
          i.timelineItems?.map((t) => {
            return { id: t.correctEventId, name: t.correctEventName }
          }) || []
        ).sort((a, b) => a.name.localeCompare(b.name)),
        shuffleOptions: i.shuffleOptions ?? false,
        multipleChoiceGradingPolicy: "default",
      }
      return pi
    }),
  }

  return res.status(200).json(publicSpecQuiz)
}
