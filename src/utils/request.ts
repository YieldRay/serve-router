declare global {
    interface FormData {
        // this is not a standard method so typescript does not have it
        // however it is widely supported in all the runtimes
        entires(): Iterable<[string, string | Blob]>
    }
}

/**
 * Parse the request body, by the content-type header
 */
export async function parseRequestBody(request: Request, fallbackContentType?: string) {
    const contentType = request.headers.get("content-type") ?? fallbackContentType
    if (!contentType) throw new Error(`unknown content-type: ${contentType}`)
    if (contentType.startsWith("application/json")) {
        return await request.json()
    }
    if (contentType.startsWith("application/x-www-form-urlencoded")) {
        const sp = new URLSearchParams(await request.text())
        return extractAllEntries(sp.entries())
    }
    if (contentType.startsWith("multipart/form-data")) {
        const fd = await request.formData()
        return extractAllEntries(fd.entires())
    }
}

function extractAllEntries<T extends keyof any, U>(it: Iterable<[T, U]>) {
    const record: Record<T, U | U[]> = {} as Record<any, any>
    for (const [k, v] of it) {
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
