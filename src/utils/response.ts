/**
 * overwrite dest Headers with src Headers
 */
export function mergeHeaders(dest?: HeadersInit, src?: HeadersInit): Headers {
    if (!dest) return new Headers(src)
    const h = new Headers(dest)
    new Headers(src).forEach((v, k) => h.set(k, v))
    return h
}

/**
 * overwrite dest ResponseInit with src ResponseInit
 */
export function mergeResponseInit(dest?: ResponseInit, src?: ResponseInit): ResponseInit {
    const headers = mergeHeaders(dest?.headers, src?.headers)
    return {
        ...dest,
        ...src,
        headers,
    }
}

/**
 * create a Response class with pre-defined ResponseInit
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
export const AcaoResponse = createResponse({
    headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-method": "*",
        "access-control-allow-headers": "*",
        "access-control-expose-headers": "*",
    },
})

/**
 * based on the input response, returns a new response with given headers & status
 */
export function transformResponse(response: Response, init: ResponseInit): Response
export function transformResponse(response: Response, mapper: (init: ResponseInit) => ResponseInit): Response
export function transformResponse(response: Response, mapper: ((init: ResponseInit) => ResponseInit) | ResponseInit) {
    return new Response(
        response.body,
        typeof mapper === "function" ? mapper({ status: response.status, headers: response.headers }) : mapper
    )
}
