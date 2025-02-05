/**
 * Overwrite dest Headers using src Headers
 */
export function mergeHeaders(dest?: HeadersInit, src?: HeadersInit): Headers {
    if (!dest) return new Headers(src)
    const h = new Headers(dest)
    new Headers(src).forEach((v, k) => h.set(k, v))
    return h
}

/**
 * Overwrite dest ResponseInit using src ResponseInit
 */
export function mergeResponseInit(dest?: ResponseInit, src?: ResponseInit): ResponseInit {
    return {
        headers: mergeHeaders(dest?.headers, src?.headers),
        status: dest?.status ?? src?.status,
    }
}

/**
 * Create a Response class with pre-defined ResponseInit
 */
export function createResponse(preInit?: ResponseInit) {
    return class CreatedResponse extends Response {
        constructor(body?: BodyInit | null | undefined, init?: ResponseInit | undefined) {
            super(body, mergeResponseInit(preInit, init))
        }
        static redirect(url: string | URL, status = 302): CreatedResponse {
            const res = Response.redirect(url, status)
            return new this(res.body, mergeResponseInit(preInit, res))
        }
        static json(data: unknown, init?: ResponseInit) {
            const res = Response.json(data, init)
            return new this(res.body, mergeResponseInit(preInit, res))
        }
    }
}

/**
 * Response class with pre-defined access-control-* headers
 */
export const CORSResponse = createResponse({
    headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Method": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Expose-Headers": "*",
        "Access-Control-Max-Age": "7200",
        "Timing-Allow-Origin": "*",
    },
})

/**
 * Based on the input response, returns a new response with given headers and status
 */
export function transformResponse(response: Response, init: ResponseInit): Response {
    return new Response(response.body, mergeResponseInit(response, init))
}
