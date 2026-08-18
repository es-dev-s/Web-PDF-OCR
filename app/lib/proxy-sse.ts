function backendOrigin() {
  const raw = (
    process.env.BACKEND_ORIGIN ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://127.0.0.1:8001"
  ).trim();
  let origin = raw.replace(/\/+$/, "");
  if (!origin) origin = "http://127.0.0.1:8001";
  if (!/^https?:\/\//i.test(origin)) origin = `https://${origin}`;
  return origin;
}

export async function proxySSE(request: Request, backendPath: string) {
  const incoming = await fetch(`${backendOrigin()}${backendPath}`, {
    headers: {
      Accept: "text/event-stream",
      Cookie: request.headers.get("cookie") ?? "",
      Authorization: request.headers.get("authorization") ?? "",
    },
    cache: "no-store",
    signal: request.signal,
  });
  if (!incoming.ok || !incoming.body) {
    return new Response(incoming.body, {
      status: incoming.status,
      headers: { "Cache-Control": "no-store" },
    });
  }
  return new Response(incoming.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
