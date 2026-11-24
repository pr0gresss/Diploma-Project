# User flows

## Authentication and workspace navigation

1. Open login or registration and complete the framework-managed form.
2. Invalid values produce validation feedback; valid submission calls AuthService.
3. A successful session is persisted and the user enters the authenticated shell.
4. Open an existing workspace or create one through the name dialog.
5. Navigate between files, notes and quizzes, or use the global notes/quizzes pages.

Authenticated non-auth requests attach the bearer token. A 401 clears the session and redirects to login with returnUrl. Other HTTP statuses do not have a universal dedicated page.

## Documents and generation

1. Open a workspace and upload a supported document.
2. Extraction is performed by backend infrastructure; the frontend presents material processing state.
3. Select documents and click Generate quiz, or open generation from the quizzes page.
4. In the dialog, select READY materials, question types and an integer question count from 1 to 50.
5. Submit. The frontend creates one quiz per selected material, sequentially.
6. On partial failure, completed quizzes remain saved and Retry remaining processes only unfinished materials.

Generation controls are disabled while busy. Leaving the page cancels the frontend subscription; it does not guarantee cancellation of backend work already accepted.

## Complete a quiz

1. Open a quiz; the runner opens or resumes its backend draft.
2. Answer single-choice, dropdown or multi-select questions using option UUIDs.
3. Changes trigger a 750 ms debounce. Saves are serialized and carry the latest server revision.
4. Save progress flushes pending changes. Leaving through the router also attempts a flush.
5. A failed save warns before discarding changes; browser unload warns about unsaved edits.
6. A revision conflict requires explicit reload of the server draft.
7. Submit after answering every question. Pending changes are saved before submission.
8. Display server-calculated score, correct selections and explanations.
9. Try again opens or resumes a new active draft.

Results can be opened using attemptId in the query string; a result from another quiz is rejected. The client does not grade answers locally.

See the [detailed draft flow](plan/quiz-completion-flow-plan.md).

