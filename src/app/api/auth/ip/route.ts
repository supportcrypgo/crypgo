import { NextRequest, NextResponse } from 'next/server';

/**
 * Returns the client's real IP address based on request headers.
 * Works behind proxies (X-Forwarded-For) and direct connections (x-real-ip).
 */
export async function GET(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');

  let ip = cfConnectingIp || realIp || '';
  if (forwarded) {
    // X-Forwarded-For can contain a comma-separated list: client, proxy1, proxy2
    ip = forwarded.split(',')[0].trim() || ip;
  }

  if (!ip) {
    // Last resort: derive from the request URL hostname (dev fallback)
    // In production behind a reverse proxy, headers above are always present.
    ip = request.nextUrl.hostname || '';
  }

  return NextResponse.json({ ip });
}