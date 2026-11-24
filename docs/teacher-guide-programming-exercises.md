# Programming exercises on courses.mooc.fi: a guide for teachers

Programming exercises are TestMyCode (`tmc`) exercises. Their templates, tests and model solutions live
in a git repository that you connect to the course. Students solve them either in the TestMyCode
extension for Visual Studio Code or, for Python exercises, in the browser.

## 1. Prepare the repository

A repository holds exercises the way tmc.mooc.fi courses do. A directory is an exercise when it
contains a project that TestMyCode recognises (for example a Maven `pom.xml`, a Python `test/` or
`tmc/` directory, a `Makefile`, a C# project, or an R project), usually laid out as
`part01/01_hello`, `part01/02_sum`, `part02/01_lists`. The directory above an exercise is its part.

- A directory whose name starts with a dot, a directory named `private`, and a directory containing a
  `.tmcignore` file are skipped.
- A `.tmcproject.yml` at the root of the repository applies to every exercise; an exercise's own
  `.tmcproject.yml` overrides it key by key. Use it, for example, for `tests_timeout_ms` or
  `sandbox_image`.
- Mark solution code and stubs with the usual TestMyCode comments (`// BEGIN SOLUTION`,
  `// STUB:` and so on). Students get the stub; the model solution is built from the same files.
- Points come from the tests' point annotations. Each point is awarded when every test carrying it
  passes, as on tmc.mooc.fi.
- Code style checks (`checkstyle`) and Valgrind are enforced as on tmc.mooc.fi: when the exercise's
  strategy says a failed check fails the submission, it gets no points.

## 2. Connect the repository

On the course management page, open **Exercises** and add the repository under
**Exercise repositories**.

- Use an `https://` URL for a public repository, or an ssh URL (`git@github.com:org/repo.git`) with a
  deploy key for a private one. Give the deploy key's private key and its public key; the private key
  is never shown again.
- You can name a branch; otherwise the repository's default branch is used.
- For GitHub, GitLab and Bitbucket the server's ssh host key is checked against the keys those
  services publish. For any other host, the key seen on the first clone is remembered and every later
  clone must present the same key. If the server's key really changed, ask an administrator to remove
  the remembered key.

Processing runs in the background and the list shows its status. When processing fails, the error is
shown next to the repository.

## 3. Update the exercises

When you change the repository, press **Refresh** next to it. Changed exercises are updated in place:
the stub students download and the model solution change, and new submissions are graded with the new
tests. Exercises removed from the repository stay available while a course page still uses them.

Changing the repository's URL or deploy key processes it again. Deleting a repository tells you how many
exercise tasks still use its exercises.

## 4. Place exercises on pages

Add an exercise block to a page, add a task of type **TestMyCode**, and pick the exercise from the list
(grouped by part, with a filter). In the exercise settings you can set the points, tries, and a deadline
that overrides the chapter's.

Choose **Solve in the browser** only for Python exercises: tests run in the browser only for Python.
Other exercises are solved in the editor.

A slide with a programming task should not contain other kinds of tasks: the editor answers only the
programming task, so such exercises are not offered in the editor at all.

## 5. Exams

An exam has its own exercise repositories: connect them on the exam's management page, then place the
exercises on the exam page as above. Once a student has started the exam, the editor lists it and
serves its programming exercises until the student's time or the exam ends. Like the exam page, the
editor hides gradings until then and shows no model solutions.

## 6. What students see

- In the course material, an editor exercise links to the TestMyCode extension and lets students
  download the stub and upload their answer as a `.zip` or `.tar.zst` file.
- In Visual Studio Code, students log in with their courses.mooc.fi account, add the course, download
  exercises, run tests locally and submit. Courses appear in the editor once the student has enrolled
  on courses.mooc.fi; teachers and assistants see their own courses without enrolling, including
  chapters that have not opened yet, and always see model solutions.
- A submission's test results, style check and Valgrind output are shown to the student and, in the
  submission view, to course staff.
- A student sees an exercise's model solution after getting full points or using all tries. Under
  **Exercises → Model solutions** you can also show model solutions to everyone after each exercise's
  deadline, or from a date.
- Students can share their code from the editor as a link (a paste). Course staff and the
  student can always open such a link; other students can open it only while the student has not
  passed the exercise, and afterwards only if they have passed it themselves. Staff find the links on
  the exercise's submissions page under **Shared answers**.
