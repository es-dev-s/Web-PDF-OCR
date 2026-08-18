import { proxySSE } from "@/app/lib/proxy-sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request) {
  return proxySSE(request, "/health/stream");
}
