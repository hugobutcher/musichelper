/**
 * Google OAuth client ID for "Import from Google Drive" (a public identifier, safe to commit).
 * Google Cloud Console, one project:
 *   1. APIs & Services → Library → enable "Google Drive API".
 *   2. OAuth consent screen: External, Testing, add your own Google account as a test user
 *      (drive.readonly is a restricted scope; Testing mode allows it for listed users).
 *   3. Credentials → Create OAuth client ID → Web application, authorised JavaScript origin
 *      https://hugobutcher.github.io and redirect URI https://hugobutcher.github.io/musichelper/
 * Empty = Drive import not set up yet.
 */
export const GOOGLE_CLIENT_ID = '729566250846-022ejeaipivd6qr2ivdlbopkpuev8d1i.apps.googleusercontent.com'
