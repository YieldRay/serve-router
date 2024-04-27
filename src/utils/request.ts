import { decodeBase64, encodeBase64, utf8Decoder, utf8Encoder } from "./base64.ts"

/**
 * Parse the request body, by the content-type header
 */
export async function parseRequestBody(request: Request, fallbackContentType?: string) {
    const contentType = request.headers.get("content-type") ?? fallbackContentType

    if (!contentType) {
        throw new Error(`unknown content-type: ${contentType}`)
    }
    if (contentType.startsWith("application/json")) {
        return await request.json()
    }
    if (contentType.startsWith("application/x-www-form-urlencoded")) {
        const sp = new URLSearchParams(await request.text())
        return extractAllEntries(sp.entries())
    }
    if (contentType.startsWith("multipart/form-data")) {
        const fd = await request.formData()
        return extractAllEntries(fd.entries())
    }
}

export function extractAllEntries<T extends keyof any, U>(
    entries: Iterable<[T, U]>
): Record<T, U | U[]> {
    const record: Record<T, U | U[]> = {} as Record<any, any>
    for (const [k, v] of entries) {
        const r: undefined | U[] | U = record[k]
        if (!r) {
            record[k] = v
        } else if (Array.isArray(r)) {
            r.push(v)
        } else {
            record[k] = [r, v]
        }
    }
    return record
}

/**
 * Intend to normalize `URLSearchParams.entries()` or `FormData.entries()`
 * when they are nested, which `extractAllEntries()` function does not do.
 *
 * Note that when conflict happens, the order of `entries` matters,
 * following one overwrite previous ones.
 *
 * Convert `{ "source[privacy]": "public", "source[language]": "en" }` to
 * `{ "source": { "privacy": "public", "language": "en" } }`
 *
 * @example https://docs.joinmastodon.org/client/intro/#hash
 */
export function extractNestedEntries<T>(entries: Iterable<[string, T]>): {
    [key: string]: T | object
} {
    type ExtractedObject = { [key: string]: ExtractedObject | T }
    const result: ExtractedObject = {}
    for (const [k, v] of entries) {
        if (!k.startsWith("[") && k.includes("[") && k.endsWith("]")) {
            // nested
            const firstSquareBracketIndex = k.indexOf("[")
            const subKeys = [
                k.slice(0, firstSquareBracketIndex),
                ...k.slice(firstSquareBracketIndex + 1, -1).split("]["),
            ]
            let prev = result
            let i: number
            for (i = 0; i < subKeys.length - 1; i++) {
                const subKey = subKeys[i]
                prev =
                    typeof prev[subKey] === "object"
                        ? (prev[subKey] as ExtractedObject)
                        : (prev[subKey] = {})
            }
            prev[subKeys[i]] = v
        } else {
            // not nested
            result[k] = v
        }
    }
    return result
}

const CREDENTIALS_REGEXP = /^ *(?:[Bb][Aa][Ss][Ii][Cc]) +([A-Za-z0-9._~+/-]+=*) *$/
const USER_PASS_REGEXP = /^([^:]*):(.*)$/

/**
 * Parse authorization header, `Basic encodeBase64(user + ":" + pass)`.
 *
 * @ref https://datatracker.ietf.org/doc/html/rfc7617
 * @example
 * serve((req) => {
 *    const basic = parseBasicAuth(req.headers.get("authorization"))
 *    if (!basic || !(basic.username === "admin" && basic.password === "pa$$w0rd")) {
 *        return new Response(null, {
 *            status: 401,
 *            headers: {
 *                "WWW-Authenticate": `Basic realm=""`,
 *            },
 *        })
 *    }
 *    return new Response("welcome to admin page")
 *})
 */
export function parseBasicAuth(authoriztion: string) {
    const match = CREDENTIALS_REGEXP.exec(authoriztion)
    if (!match) {
        return undefined
    }
    let userPass = undefined
    try {
        userPass = USER_PASS_REGEXP.exec(utf8Decoder.decode(decodeBase64(match[1])))
    } catch {}
    if (!userPass) {
        return undefined
    }
    return { username: userPass[1], password: userPass[2] }
}

export function buildBasicAuth(user: string, pass: string) {
    return `Basic ${encodeBase64(utf8Encoder.encode(`${user}:${pass}`))}`
}

const BEARER_REGEXP = /^Bearer +([A-Za-z0-9\-._~+/]+=*)$/

/**
 * @ref https://datatracker.ietf.org/doc/html/rfc6750
 */
export function parseBearerAuth(authoriztion: string) {
    const match = BEARER_REGEXP.exec(authoriztion)
    if (match) {
        return match[1]
    } else {
        return undefined
    }
}

export function buildBearerAuth(bearer: string) {
    return `Bearer ${bearer}`
}
