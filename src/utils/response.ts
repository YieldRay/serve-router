/**
 * create a Response class with predefined headers & status
 */
export function createResponse(preInit?: ResponseInit) {
    return class CreatedResponse extends Response {
        constructor(body?: BodyInit | null | undefined, init?: ResponseInit | undefined) {
            const h = new Headers(preInit?.headers)
            new Headers(init?.headers).forEach((v, k) => h.set(k, v))
            // overwrite preInit?.headers with init?.headers
            delete init?.headers
            super(body, { status: preInit?.status, ...init, headers: h })
        }
        static redirect(url: string | URL, status = 302): CreatedResponse {
            return new this(null, { headers: { location: new URL(url).href }, status })
        }
    }
}

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
