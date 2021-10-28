# Internationalization

See the following documentations:

1. https://react.i18next.com/
2. https://www.i18next.com/

Try to use easier string to translate e.g. `Remove image` -> `Remove` so that we can reuse translations.

## Lint

We enforce all translatable strings are translated with an ESLint plugin. It will give you `Disallow literal` string errors on places where you probably should use a translation.

## Short language codes vs long language codes

For translating UI, short language codes preferred. Long language codes supported too, but they inherit the translations from the base language. For example, we have specified that `en` translation is for American English. If we wanted to create a British English translation, we would create them with the `en-GB` identifier. This translation would inherit the `en` translations, and we can just override the strings that differ.

For specifying the language of a course a long language code should be used.

## VSCode snippets

To get the useTranslation hook, type `ut`.

To use the t function in a JSX context, type `tj`.


## Workflow

Open a terminal in shared-module and run:

```bash
npm run watch
```

To keep changes to the translation files automatically synchronized with the different microservices.

Try to use reusable strings for the interface. For example if you have a button that says "Save page", it might be a good idea to replace that with just "Save" so that we don't need a new translation for that.

Here's a video that shows how to start the workflow, how to use the ut snippet and the tj snippet. Finally, it also shows that you don't use the tj snippet when you're not in a jsx context: 

https://user-images.githubusercontent.com/1922896/139198182-4fd3ce70-60dc-444a-8615-e2a9b58b5a7f.mp4

### etc

#### Upper case text

If the design of the interface demands upper case text, our convention is to put the text in the translation file in lowercase and apply css text-transform: uppercase to the element.


#### False positive 'disallow literal string' eslint messages

Try to do the one of the following. Things further up on the list are preferrable.

1. move the literal string to a constant to the top level of the file with upper case name e.g. `const CONSTANT = 'foo'`. **If you have temporary content that will be replaced later do this instead of ignoring the line with a comment.**
2. Ignore the instance with an eslint comment that vscode suggests
3. Ignore property/function name in eslint config (only do this if you are sure that it will not ignore any real translatable strings.

#### React components in middle of translatable strings

See the following link. Note that it does not rerender on language change unless you pass it the t function.

https://react.i18next.com/latest/trans-component
