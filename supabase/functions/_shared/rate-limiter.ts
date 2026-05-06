// /functions/_shared/rate-limiter.ts

// 1. PER-IP RATE LIMITER CACHE
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// 2. GLOBAL CIRCUIT BREAKER CACHE (The Master Switch)
let globalStats = { count: 0, resetAt: 0 };

export function checkRateLimit(req: Request, maxRequests: number, windowSeconds: number): { allowed: boolean; ip: string } {
  // Get the user's IP address from the request headers
  const ip = req.headers.get("x-forwarded-for") || "unknown_ip";
  
  if (ip === "unknown_ip") return { allowed: true, ip }; // Fallback

  const now = Date.now();
  const record = rateLimitMap.get(ip);

  // If this is their first request, or their timeout window expired, reset them
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + (windowSeconds * 1000) });
    return { allowed: true, ip };
  }

  // If they hit the limit within the time window, BLOCK THEM
  if (record.count >= maxRequests) {
    return { allowed: false, ip };
  }

  // Otherwise, increase their strike count and let them pass
  record.count += 1;
  return { allowed: true, ip };
}

// 🛑 NEW: THE GLOBAL CIRCUIT BREAKER
export function checkGlobalCircuitBreaker(maxGlobalRequests: number, windowSeconds: number): boolean {
  const now = Date.now();

  // If the time window has passed, reset the global counter
  if (now > globalStats.resetAt) {
    globalStats = { count: 1, resetAt: now + (windowSeconds * 1000) };
    return true; // Allowed (Breaker is Closed)
  }

  // If we hit the global limit, TRIP THE BREAKER
  if (globalStats.count >= maxGlobalRequests) {
    return false; // BLOCKED (Breaker is Open)
  }

  // Otherwise, count the request and allow
  globalStats.count += 1;
  return true; // Allowed
}