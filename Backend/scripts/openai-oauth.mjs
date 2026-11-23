// Official Sign in with ChatGPT plan-usage flow for a single-user self-hosted app.
// No browser/session scraping, copied Codex tokens, private endpoints or API keys.
import 'reflect-metadata';
import { loadEnvFile } from 'node:process';
import { createServer } from 'node:http';
import {
  randomBytes,
  randomUUID,
  createHash,
  timingSafeEqual,
} from 'node:crypto';
import { readFile, mkdir, writeFile, open, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { JwtVerifier } from '@nestjs/authentication';
import { z } from 'zod';
import {
  OpenAiOAuthSession,
  oauthCredentialsSchema,
  saveOAuthCredentials,
  OPENAI_TOKEN_ENDPOINT,
  OPENAI_RESOURCE,
} from '../dist/infrastructure/ai/openai-oauth.session.js';

try {
  loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const config = new ConfigService(process.env);
const file = resolve(
  process.env.OPENAI_OAUTH_FILE ?? '.secrets/openai-oauth.json',
);
try {
  if (process.argv.includes('--models')) {
    const token = await new OpenAiOAuthSession(config).accessToken();
    const response = await fetch(`${OPENAI_RESOURCE}/models`, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error('Model catalog request failed');
    const result = z
      .object({
        models: z.array(
          z.object({
            slug: z.string(),
            display_name: z.string(),
            visibility: z.string().optional(),
          }),
        ),
      })
      .parse(await response.json());
    console.log(
      JSON.stringify(
        result.models
          .filter((model) => model.visibility === 'list')
          .map(({ slug, display_name }) => ({ slug, display_name })),
        null,
        2,
      ),
    );
  } else {
    await signIn();
  }
} catch {
  console.error(
    'OpenAI OAuth operation failed. Check eligibility, consent, callback availability and Documentation/Backend/AI/OPENAI_OAUTH.md. No credentials were printed.',
  );
  process.exitCode = 1;
}

async function signIn() {
  let previous;
  try {
    previous = oauthCredentialsSchema.parse(
      JSON.parse(await readFile(file, 'utf8')),
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const hostFile = `${file}.host-id`;
  let hostId;
  try {
    hostId = (await readFile(hostFile, 'utf8')).trim();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    hostId = `urn:uuid:${randomUUID()}`;
    await writeFile(hostFile, hostId, { mode: 0o600, flag: 'wx' });
  }
  const state = randomBytes(32).toString('base64url');
  const nonce = randomBytes(32).toString('base64url');
  const verifier = randomBytes(48).toString('base64url');
  let redirectUri;
  let handling = false;
  let finish;
  let fail;
  const done = new Promise((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    const callback = new URL(request.url ?? '/', redirectUri);
    if (request.method !== 'GET' || callback.pathname !== '/auth/callback') {
      response.writeHead(404).end('Not found');
      return;
    }
    const returnedState = callback.searchParams.get('state') ?? '';
    if (
      Buffer.byteLength(returnedState) !== Buffer.byteLength(state) ||
      !timingSafeEqual(Buffer.from(returnedState), Buffer.from(state))
    ) {
      response.writeHead(400).end('Invalid authorization state');
      return;
    }
    if (handling) {
      response.writeHead(409).end('Authorization already handled');
      return;
    }
    handling = true;
    try {
      if (callback.searchParams.has('error'))
        throw new Error('Authorization refused');
      const issuedClient =
        callback.searchParams.get('client_id') ?? previous?.client_id;
      if (
        !issuedClient ||
        issuedClient === 'dynamic_agent_client' ||
        (previous && issuedClient !== previous.client_id)
      )
        throw new Error('Client registration mismatch');
      const code = callback.searchParams.get('code');
      if (!code) throw new Error('Missing authorization code');
      const tokenResponse = await fetch(OPENAI_TOKEN_ENDPOINT, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: issuedClient,
          code,
          code_verifier: verifier,
          redirect_uri: redirectUri,
          resource: OPENAI_RESOURCE,
        }),
      });
      if (!tokenResponse.ok) throw new Error('Code exchange failed');
      const tokens = z
        .object({
          access_token: z.string().min(1),
          refresh_token: z.string().min(1),
          id_token: z.string().min(1),
          token_type: z
            .string()
            .refine((value) => value.toLowerCase() === 'bearer'),
          expires_in: z.number().int().positive(),
          scope: z.string(),
        })
        .parse(await tokenResponse.json());
      const identity = await new JwtVerifier({
        jwks: 'https://auth.openai.com/.well-known/jwks.json',
        issuer: 'https://auth.openai.com',
        audience: issuedClient,
        algorithms: ['RS256'],
        required: ['sub', 'exp'],
      }).verify(tokens.id_token);
      if (
        identity.nonce !== nonce ||
        !identity.sub ||
        (previous && identity.sub !== previous.subject)
      ) {
        throw new Error('OpenAI identity or nonce mismatch');
      }
      const scopes = tokens.scope.split(/\s+/);
      if (
        !scopes.includes('chatgpt.tokens.use.direct') ||
        !scopes.includes('resource.invoke')
      ) {
        throw new Error('Plan usage was not granted');
      }
      const lock = await open(`${file}.lock`, 'wx', 0o600);
      try {
        await saveOAuthCredentials(file, {
          client_id: issuedClient,
          issuer: 'https://auth.openai.com',
          subject: identity.sub,
          ext_agent_host_id: hostId,
          id_token: tokens.id_token,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: Date.now() + tokens.expires_in * 1000,
          scopes,
        });
      } finally {
        await lock.close();
        await unlink(`${file}.lock`);
      }
      response.writeHead(200).end('OpenAI connected. You may close this page.');
      finish();
    } catch {
      response
        .writeHead(400)
        .end('Authorization failed. Return to the terminal and retry.');
      fail(new Error('Authorization failed'));
    }
  });
  const timeout = setTimeout(
    () => fail(new Error('OAuth timed out')),
    10 * 60_000,
  );
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    redirectUri = `http://127.0.0.1:${server.address().port}/auth/callback`;
    const authorization = new URL(
      'https://auth.openai.com/api/accounts/authorize',
    );
    const parameters = {
      client_id: previous?.client_id ?? 'dynamic_agent_client',
      ext_agent_host_id: hostId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope:
        'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
      resource: OPENAI_RESOURCE,
      state,
      nonce,
      code_challenge_method: 'S256',
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      ...(!previous ? { agent_name_hint: 'AI Study Workspace' } : {}),
    };
    for (const [name, value] of Object.entries(parameters))
      authorization.searchParams.set(name, value);
    // No id_token_hint is placed in this printed URL.
    console.log('Continue with ChatGPT in a browser on THIS computer:');
    console.log(authorization.toString());
    await done;
    console.log(
      'OpenAI OAuth session saved privately. Run npm run ai:models to choose an authorized model.',
    );
  } finally {
    clearTimeout(timeout);
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
