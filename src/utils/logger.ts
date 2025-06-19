/*
 * Simple conditional logger used by melodi-observe-openai.
 * Logging is enabled when either:
 *   1. MelodiConfig.debug === true, or
 *   2. process.env.MELODI_DEBUG_LOG is truthy ("1", "true", "yes")
 */

export function isDebugEnabled(config?: { debug?: boolean }): boolean {
  if (config?.debug) return true;
  const env = process.env.MELODI_DEBUG_LOG;
  if (!env) return false;
  return ['1', 'true', 'yes', 'y'].includes(env.toLowerCase());
}

export function debugLog(config: { debug?: boolean } | undefined, ...args: any[]) {
  if (isDebugEnabled(config)) {
    const ts = new Date().toISOString();
    console.debug(`🪵 [melodi-observe-openai][${ts}]`, ...args);
  }
} 