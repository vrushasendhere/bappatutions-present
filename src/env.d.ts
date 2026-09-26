/// <reference types="astro/client" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}

interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  LIBRARY_ORIGIN: string;
  /** Comma-separated Google account emails that author the library. */
  ADMIN_EMAILS?: string;
  GOOGLE_CLIENT_ID?: string;
  /** A secret — set with `wrangler secret put`, never in wrangler.jsonc. */
  GOOGLE_CLIENT_SECRET?: string;
  /** "on" enables the local stand-in for Google sign-in. Honoured only on
   *  localhost; see lib/auth-server.ts. */
  DEV_LOGIN?: string;
}
