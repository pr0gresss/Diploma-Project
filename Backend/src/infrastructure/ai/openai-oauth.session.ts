import {
  mkdir,
  readFile,
  rename,
  writeFile,
  open,
  unlink,
} from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { AiUnavailableError } from '../../common/errors/index.js';

export const oauthCredentialsSchema = z.object({
  client_id: z
    .string()
    .min(1)
    .refine((value) => value !== 'dynamic_agent_client'),
  issuer: z.literal('https://auth.openai.com'),
  subject: z.string().min(1),
  ext_agent_host_id: z.string().min(1),
  id_token: z.string().min(1),
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_at: z.number().int().positive(),
  scopes: z.array(z.string()),
});
export type OAuthCredentials = z.infer<typeof oauthCredentialsSchema>;
export const OPENAI_TOKEN_ENDPOINT =
  'https://auth.openai.com/api/accounts/oauth/token';
export const OPENAI_RESOURCE = 'https://api.openai.com/v1';

export async function saveOAuthCredentials(
  path: string,
  credentials: OAuthCredentials,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(credentials)}\n`, {
      mode: 0o600,
      flag: 'wx',
    });
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}

@Injectable()
export class OpenAiOAuthSession {
  private refreshing?: Promise<string>;
  constructor(private readonly config: ConfigService) {}

  async accessToken(): Promise<string> {
    try {
      const path = resolve(
        this.config.get<string>('OPENAI_OAUTH_FILE') ??
          '.secrets/openai-oauth.json',
      );
      const current = oauthCredentialsSchema.parse(
        JSON.parse(await readFile(path, 'utf8')),
      );
      if (
        !current.scopes.includes('chatgpt.tokens.use.direct') ||
        !current.scopes.includes('resource.invoke')
      )
        throw new AiUnavailableError('OpenAI plan usage consent is missing');
      if (current.expires_at > Date.now() + 60_000) return current.access_token;
      this.refreshing ??= this.refresh(path).finally(() => {
        this.refreshing = undefined;
      });
      return await this.refreshing;
    } catch {
      // Never include tokens, refresh responses or filesystem contents in errors.
      throw new AiUnavailableError();
    }
  }

  private async refresh(path: string): Promise<string> {
    const lockPath = `${path}.lock`;
    // Cross-process serialization. A lock left after a crash requires operator
    // confirmation that no process is using the session before removing it.
    const lock = await open(lockPath, 'wx', 0o600);
    try {
      const latest = oauthCredentialsSchema.parse(
        JSON.parse(await readFile(path, 'utf8')),
      );
      if (latest.expires_at > Date.now() + 60_000) return latest.access_token;
      const response = await fetch(OPENAI_TOKEN_ENDPOINT, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: latest.client_id,
          refresh_token: latest.refresh_token,
          resource: OPENAI_RESOURCE,
        }),
      });
      if (!response.ok) throw new AiUnavailableError();
      const refreshed = z
        .object({
          access_token: z.string().min(1),
          refresh_token: z.string().min(1).optional(),
          expires_in: z.number().int().positive(),
          scope: z.string().optional(),
          token_type: z
            .string()
            .refine((value) => value.toLowerCase() === 'bearer'),
        })
        .parse(await response.json());
      const scopes = refreshed.scope?.split(/\s+/) ?? latest.scopes;
      if (
        !scopes.includes('chatgpt.tokens.use.direct') ||
        !scopes.includes('resource.invoke')
      )
        throw new AiUnavailableError();
      const updated = {
        ...latest,
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token ?? latest.refresh_token,
        expires_at: Date.now() + refreshed.expires_in * 1000,
        scopes,
      };
      await saveOAuthCredentials(path, updated);
      return updated.access_token;
    } finally {
      await lock.close();
      await unlink(lockPath);
    }
  }
}
