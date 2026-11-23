# AI provider configuration

The backend calls an OpenAI-compatible **Chat Completions** endpoint using the
OpenAI SDK, like the reference StudyCoach project. Configure `Backend/.env`
(or `CI/.env` when launching the root Compose stack):

```dotenv
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=
LLM_API_KEY=
LLM_TIMEOUT_MS=45000
LLM_MAX_CONTEXT_CHARS=60000
LLM_MAX_OUTPUT_TOKENS=8192
```

Set both model and key to enable generation. Blank values leave generation
unavailable (503); ordinary API calls remain available. The base URL must include
the API prefix, usually `/v1`. The provider must support JSON object mode.
The context limit counts prompt, system instructions and JSON schema characters,
not tokens. Oversized input is rejected, never silently truncated.
Output is locally schema-validated; refusals, truncation and invalid JSON fail
without publishing a quiz. There are no automatic retries or provider fallbacks.
Direct OpenAI API use is billed under the configured API key.

## Codex-session gateway

Run a separate OpenAI-compatible gateway, for example the third-party
[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI), which supports Codex
OAuth. This is an external service, not an embedded dependency or an official
OpenAI product. Review its current installation instructions, license, provider
terms and account eligibility before use.

1. Install a reviewed, pinned gateway release.
2. Configure its API listener on `127.0.0.1:8317`, create a strong client API key,
   disable remote management, and keep its auth directory private and outside Git.
3. Complete its explicit Codex login flow on the gateway host. The gateway alone
   stores/refreshes OAuth credentials; do not paste a session token into `.env`.
4. Choose a model exposed by the gateway's authenticated `/v1/models` endpoint.
5. Set the backend configuration:

```dotenv
LLM_BASE_URL=http://127.0.0.1:8317/v1
LLM_MODEL=MODEL_EXPOSED_BY_GATEWAY
LLM_API_KEY=YOUR_GATEWAY_CLIENT_KEY
```

This key authenticates the backend **to the gateway**, not to OpenAI.
Do not publicly expose the gateway or pool a personal subscription for unrelated
users. Subscription limits and provider terms still apply.
For a containerized backend, `127.0.0.1` refers to that container: use a private
gateway service address or an appropriately secured host address instead.
The gateway must be reachable only by intended clients; never expose OAuth
callback/management ports broadly.

The backend no longer loads the legacy direct-OAuth session or uses `OPENAI_*`
settings for generation. The old login helper remains for compatibility but is
not the gateway login flow. Existing material ownership checks still apply.
Source text is sent to the configured provider only upon generation.
Material must be READY; automatic extraction runs when `TIKA_URL` is configured.
