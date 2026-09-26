/**
 * POST /api/downloads/check — the actual enforcement point for "3
 * downloads/day, logged in or not" (see the plan). The Download button calls
 * this BEFORE building the export; only a 200 lets the client proceed. This
 * is what stops the limit being bypassed by just not calling an export API
 * (export itself is entirely client-side, see the plan's Download / export
 * section) — the gate is this lightweight counter check, not the export
 * logic.
 */
import type { APIRoute } from 'astro';
import { db } from '../../../db/client';
import { resolveIdentity, checkAndRecordDownload } from '../../../lib/identity';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const database = db(locals.runtime.env.DB);
  const identity = await resolveIdentity(database, request, locals.runtime.env.ADMIN_EMAILS);

  if (!identity) {
    return new Response(JSON.stringify({ allowed: false, reason: 'no-identity' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await checkAndRecordDownload(database, identity);
  return new Response(JSON.stringify(result), {
    status: result.allowed ? 200 : 429,
    headers: { 'Content-Type': 'application/json' },
  });
};
