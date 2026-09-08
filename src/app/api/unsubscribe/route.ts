import { NextResponse } from 'next/server';

const BACKEND_UNSUBSCRIBE_URL = 'https://crypgo-email.onrender.com/unsubscribe/process/';

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const response = await fetch(BACKEND_UNSUBSCRIBE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Accept: 'application/json',
      },
      body,
      cache: 'no-store',
    });

    const responseBody = await response.text();
    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'The unsubscribe service is currently unavailable.' },
      { status: 502 },
    );
  }
}
