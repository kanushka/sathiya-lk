import type { CallableOptions } from 'firebase-functions/v2/https';

export const REGION = 'us-central1';

// Production default is ON; the functions emulator, or ENFORCE_APP_CHECK=false (e.g. functions/.env.<project>), turns it off.
export function appCheckEnforced(env: Record<string, string | undefined> = process.env): boolean {
  if (env.FUNCTIONS_EMULATOR === 'true') return false;
  return env.ENFORCE_APP_CHECK !== 'false';
}

export const callOpts: CallableOptions = { region: REGION, enforceAppCheck: appCheckEnforced() };
