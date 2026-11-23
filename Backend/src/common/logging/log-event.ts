import type { Logger } from '@nestjs/common';

export type LogLevel = 'log' | 'warn' | 'error' | 'debug';

/**
 * Emits one JSON object per event. Keeping the event name and its fields
 * machine-readable makes logs searchable instead of prose-only.
 */
export function logEvent(
  logger: Logger,
  level: LogLevel,
  event: string,
  fields: Record<string, unknown> = {},
): void {
  // The JSON console logger flattens structured params into the record root,
  // so every event stays one machine-readable line instead of nested JSON.
  logger[level](event, {
    ...fields,
    timestamp: new Date().toISOString(),
  });
}

export function errorDetails(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
    };
  }
  return { errorMessage: String(error) };
}
