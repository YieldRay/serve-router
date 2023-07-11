/**
 * Special Response constructor that automatically add cors header
 */

export function createResponse(headers?: HeadersInit) {
    return class CreatedResponse extends Response {
        constructor(body?: BodyInit | null | undefined, init?: ResponseInit | undefined) {
            const h = new Headers(headers)
            new Headers(init?.headers).forEach(([v, k]) => h.set(k, v))
            super(body, { ...init, headers: h })
        }
        static redirect(url: string | URL, status = 302): CreatedResponse {
            return new this(null, { headers: { location: new URL(url).href }, status })
        }
    }
}
