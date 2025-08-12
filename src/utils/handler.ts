import { transformResponse } from "./response.ts"
import type { Awaitable } from "./types.ts"

export type WebHandler = (request: Request, ...extra: unknown[]) => Awaitable<Response>

export function withCORS(handler: WebHandler): WebHandler {
    return async (request, ...extra) => {
        const origin = request.headers.get("origin")
        const headers = new Headers()
        if (origin) {
            headers.set("access-control-allow-origin", origin === "null" ? "*" : origin)
            headers.set("access-control-allow-credentials", "true")
        }
        if (request.method === "OPTIONS") {
            headers.set("access-control-max-age", "7200")
            if (request.headers.has("access-control-request-headers")) {
                headers.set(
                    "access-control-allow-headers",
                    request.headers.get("access-control-request-headers")!
                )
            }
            if (request.headers.has("access-control-request-method")) {
                headers.set(
                    "access-control-allow-methods",
                    request.headers.get("access-control-request-method")!
                )
            }
            return new Response(null, {
                headers,
                status: 204,
            })
        } else {
            const response = await handler(request, ...extra)
            if (origin) {
                if (request.credentials === "include") {
                    headers.set(
                        "access-control-expose-headers",
                        Array.from(response.headers.keys()).join(", ")
                    )
                } else {
                    headers.set("access-control-expose-headers", "*")
                }
            }
            return transformResponse(response, { headers })
        }
    }
}
