module.exports = {
  rules: {
    "ban-ts-ignore-without-comment": {
      meta: {
        type: "problem",
        docs: {
          description: 'Bans "// @ts-ignore" comments from being used if no comment is specified',
          category: "Best Practices",
          recommended: "error",
        },
        schema: [],
        messages: {
          tsIgnoreWithoutCommentComment:
            'Do not use "// @ts-ignore" comments because they suppress compilation errors. If you want to use one, add a comment after it, like // @ts-ignore: this is needed because x.',
        },
      },
      create: function (context) {
        const tsIgnoreRegExp = /^\/*\s*@ts-ignore(?!:.*)/
        const sourceCode = context.getSourceCode()

        return {
          Program() {
            const comments = sourceCode.getAllComments()

            comments.forEach((comment) => {
              if (comment.type !== "Line") {
                return
              }
              if (tsIgnoreRegExp.test(comment.value)) {
                context.report({
                  node: comment,
                  messageId: "tsIgnoreWithoutCommentComment",
                })
              }
            })
          },
        }
      },
    },
    "no-trans-without-t": {
      meta: {
        type: "problem",
        docs: {
          description: "Trans does not update if you don't give it a t prop",
          category: "Best Practices",
          recommended: "error",
        },
        schema: [],
        messages: {
          transDoesNotUpdateWithoutT: "Add a t prop e.g. Trans t={t}",
        },
      },
      create: function (context) {
        const tsIgnoreRegExp = /^\/*\s*@ts-ignore(?!:.*)/
        const sourceCode = context.getSourceCode()

        return {
          Program() {
            const comments = sourceCode.getAllComments()

            comments.forEach((comment) => {
              if (comment.type !== "Line") {
                return
              }
              if (tsIgnoreRegExp.test(comment.value)) {
                context.report({
                  node: comment,
                  messageId: "transDoesNotUpdateWithoutT",
                })
              }
            })
          },
        }
      },
    },
  },
}
