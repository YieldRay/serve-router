/**
 * Overwrite dest Headers with src Headers
 */
export function mergeHeaders(dest?: HeadersInit, src?: HeadersInit): Headers {
    if (!dest) return new Headers(src)
    const h = new Headers(dest)
    new Headers(src).forEach((v, k) => h.set(k, v))
    return h
}

/**
 * Overwrite dest ResponseInit with src ResponseInit
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
            // @ts-ignore
            // current typescript declaration does not support this type
            // this comment should be removed if it is supported in future version
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
 * Based on the input response, returns a new response with given headers & status
 */
export function transformResponse(response: Response, init: ResponseInit): Response
export function transformResponse(
    response: Response,
    mapper: (init: ResponseInit) => ResponseInit
): Response
export function transformResponse(
    response: Response,
    mapper: ((init: ResponseInit) => ResponseInit) | ResponseInit
) {
    return new Response(
        response.body,
        typeof mapper === "function"
            ? mapper({ status: response.status, headers: response.headers })
            : mapper
    )
}
