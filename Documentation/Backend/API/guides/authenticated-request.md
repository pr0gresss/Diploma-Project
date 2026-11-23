# Integration tutorial: sign in and study

[Documentation home](../README.md) · [Getting started](getting-started.md)

This workflow uses real HTTP controllers. Set `BASE_URL=http://localhost:3000`
(or `http://localhost:8080/api` through the frontend proxy). Requests below use
Bash/curl. In PowerShell use `curl.exe`, or `Invoke-RestMethod` to capture JSON.

## 1. Register or sign in

Create an account:

```sh
curl -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"student@example.com","password":"StrongStudyPassword!2026"}'
```

Expect **201** with `{user, accessToken, expiresIn, tokenType}`. Registering the
same email again returns **409**. `user` never contains a password hash.

For an existing account:

```sh
curl -X POST "$BASE_URL/auth/sign-in" \
  -H "Content-Type: application/json" \
  -d '{"email":"student@example.com","password":"StrongStudyPassword!2026"}'
```

Expect **200** with the same session shape. Copy the returned `accessToken` into
your shell's `TOKEN` variable; do not copy the documentation example token.
Never commit real tokens or passwords.

PowerShell example:

```powershell
$baseUrl = "http://localhost:3000"
$session = Invoke-RestMethod -Method Post -Uri "$baseUrl/auth/sign-in" `
  -ContentType "application/json" `
  -Body '{"email":"alice@example.com","password":"StudyDemo!2026"}'
$headers = @{ Authorization = "Bearer $($session.accessToken)" }
Invoke-RestMethod -Uri "$baseUrl/me" -Headers $headers
```

The Alice credentials work only after loading development seed data.

## 2. Read your profile and create a workspace

```sh
curl "$BASE_URL/me" -H "Authorization: Bearer $TOKEN"
curl -X POST "$BASE_URL/workspaces" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Database systems"}'
```

Copy the returned workspace `id` into `WORKSPACE_ID`.

```sh
curl "$BASE_URL/workspaces?limit=20&offset=0&search=Database" \
  -H "Authorization: Bearer $TOKEN"
```

List responses have `{items, total, limit, offset}`. Limits range from 1 to 100;
offsets start at zero. Unknown body/query fields are rejected.

## 3. Upload a document

```sh
curl -X POST "$BASE_URL/workspaces/$WORKSPACE_ID/materials" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@lecture.pdf;type=application/pdf" \
  -F "displayName=Transactions lecture"
```

Expect **201** with a material and its queued extraction job. Store its `id` as
`MATERIAL_ID`. PDF and DOCX are supported up to 10 MiB; other types return 415.

```sh
curl "$BASE_URL/materials/$MATERIAL_ID/jobs" -H "Authorization: Bearer $TOKEN"
```

With `TIKA_URL` configured, the worker polls queued uploads and moves them through
`PROCESSING` to `READY` or `FAILED`. Without it, uploads remain queued. Guide/quiz
creation requires a `READY` material. Seed SQL does not populate R2/local file objects.

## 4. Create a quiz from supplied content on a READY material

Questions now accept `questionType`: `SINGLE_CHOICE` (radio), `SELECT`
(dropdown), or `MULTI_SELECT` (checkboxes). Omitting it keeps single-choice
behavior. Use the OAuth generation endpoint instead of supplying questions when
you have configured the [OpenAI plan connection](../../AI/OPENAI_OAUTH.md):

```sh
curl -X POST "$BASE_URL/materials/$MATERIAL_ID/quizzes/generate" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"questionCount":6,"questionTypes":["SINGLE_CHOICE","SELECT","MULTI_SELECT"]}'
```

Without OAuth setup this returns 503 `ai_unavailable`; it never falls back to a
paid API key. The following manual creation path works without an AI provider.

Use an owned READY material ID for this step:

```sh
curl -X POST "$BASE_URL/materials/$MATERIAL_ID/quizzes" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"displayName":"Transactions quiz","questions":[{"prompt":"Are transactions atomic?","explanation":"All changes commit together or roll back.","options":[{"text":"Yes","isCorrect":true},{"text":"No","isCorrect":false}]}]}'
```

Expect 201. An unprocessed material returns 409. This endpoint persists supplied
questions; it does not call an AI provider. Copy the returned `id` as `QUIZ_ID`.

## 5. Take and submit the quiz

```sh
curl "$BASE_URL/quizzes/$QUIZ_ID" -H "Authorization: Bearer $TOKEN"
```

Correctness flags and explanations are absent. Copy actual question/option IDs:

```sh
curl -X POST "$BASE_URL/quizzes/$QUIZ_ID/attempts" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"answers":[{"questionId":"REPLACE_WITH_QUESTION_UUID","selectedOptionIds":["REPLACE_WITH_OPTION_UUID"]}]}'
```

Expect **201** with grading, score and correct answers. All questions must be
answered exactly once. For multi-select include all selected IDs; missing a
correct option or adding a wrong one makes that question incorrect. Client-supplied `userId`, `scorePercent` or `isCorrect`
fields are rejected. Each submission creates a new attempt: do not automatically
retry a POST after an ambiguous network failure.

## 6. Review progress and failures

```sh
curl "$BASE_URL/me/attempts" -H "Authorization: Bearer $TOKEN"
curl "$BASE_URL/me/progress" -H "Authorization: Bearer $TOKEN"
curl "$BASE_URL/me/progress/overview" -H "Authorization: Bearer $TOKEN"
```

Trying another user's resource returns **404**. Deleting a quiz, material or
workspace with assessment history returns **409**. Expired tokens return **401**;
sign in again, because no refresh endpoint exists.

See the generated [endpoint reference](../reference/endpoints.md) for schemas,
request examples, response examples and error status codes for every operation.
