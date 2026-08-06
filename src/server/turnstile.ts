/**
 * Verify a Cloudflare Turnstile token via the Siteverify API.
 * Uses TURNSTILE_SECRET_KEY from the environment.
 */
export async function verifyTurnstileToken(
  token: string,
  remoteip?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    return false;
  }
  if (!token.trim()) {
    return false;
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  });
  if (remoteip) {
    body.set("remoteip", remoteip);
  }

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      },
    );
    const outcome = (await response.json()) as { success?: boolean };
    return outcome.success === true;
  } catch (err) {
    console.error("Turnstile verification failed:", err);
    return false;
  }
}

export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
}
