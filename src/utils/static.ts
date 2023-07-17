import { type Handler } from "../index.js"

/**
 * returns if file exists
 */
async function exist(path: string | URL) {
    try {
        const stat = await Deno.stat(path)
        return stat.isFile
    } catch {
        return false
    }
}

async function fileResponse(path: string, mediaTypes?: Record<string, string>, headOnly = false) {
    const realPath: string = await Deno.realPath(path)
    const file = await Deno.open(realPath, { read: true, create: false, createNew: false })
    const stat = await file.stat()
    const headers = { "content-length": String(stat.size) }
    if (stat.mtime) Reflect.set(headers, "last-modified", stat.mtime.toUTCString())
    // extract extension from file path
    const ext = realPath.replaceAll("\\", "/").split("/").reverse()[0].split(".").at(-1)
    // see: https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types
    const contentType = (
        {
            htm: "text/html",
            html: "text/html",
            xhtml: "application/xhtml+xml",
            js: "text/javascript",
            mjs: "text/javascript",
            cjs: "text/javascript",
            css: "text/css",
            sh: "application/x-sh",
            txt: "text/plain",
            csv: "text/csv",
            json: "application/json",
            xml: "application/xml",
            svg: "image/svg+xml",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            gif: "image/gif",
            webp: "image/webp",
            pdf: "application/pdf",
            wav: "audio/wav",
            mp3: "audio/mp3",
            mp4: "video/mpeg4",
            bin: "application/octet-stream",
            ...mediaTypes,
        } as Record<string, string | undefined>
    )[ext!]
    if (contentType) Reflect.set(headers, "content-type", contentType)
    return new Response(headOnly ? null : file.readable, { headers })
}

interface Options {
    /**
     * the direcory path that need to be served
     */
    dir?: string
    /**
     * if not specified, by default is ["index.html", "index.htm"]
     */
    index?: string[]
    /**
     * suffix to media type table, e.g. {"mp4": "application/mp4"}
     */
    mediaTypes?: Record<string, string>
}

type InstanceFn<P extends object = object> = (path: string, ...handlers: Handler<P>[]) => unknown

/**
 * **(deno only)**
 * attach a static file hosting handler to specified path
 * @param instance must be top level instance
 * @param path must starts with '/'
 * @param options if is a string, equals to {"dir": ...}
 * @example
 * ```ts
 * import App from "serve-router"
 * import { attachStatic } from "serve-router/utils"
 * const app = App()
 * attachStatic(app, "/assets")
 * ```
 */
export function attachStatic<
    P extends object = object,
    T extends { get: InstanceFn<P>; head: InstanceFn<P> } = { get: InstanceFn<P>; head: InstanceFn<P> }
>(instance: T, path: string, options?: string | Options) {
    if (!path.startsWith("/"))
        throw new Error(
            `static handler only supports top level instance, so path should begin with '/', receive '${path}'`
        )

    // dir may not ends with '/'
    const dir = Deno.realPathSync(
        typeof options === "string"
            ? options
            : // if dir is not specified, get from path
              options?.dir ??
                  // path must starts with '/', so remove prefix '/'
                  path.slice(1)
    )
    if (!Deno.statSync(dir).isDirectory) throw new Error(`'${dir}' is not a directory!'`)

    // remove suffix '/', if present
    const urlPath = path.endsWith("/") ? path.slice(0, -1) : path

    const handler = async (request: Request) => {
        // helper function, given a path, returns a Response object
        const returnResponse = (path: string) =>
            fileResponse(path, typeof options === "object" ? options.mediaTypes : undefined, request.method === "HEAD")

        // this must starts with '/', as the prefix '/' is from url.pathname
        const filePart = new URL(request.url).pathname.slice(urlPath.length)

        // if ends with '/', index file is required to send
        if (filePart.endsWith("/")) {
            const indexs = []
            if (typeof options === "object") options.index?.forEach((v) => indexs.push(v))
            else indexs.push("index.html", "index.htm")

            for (const index of indexs.map((i) => "/" + i))
                if (await exist(dir + index)) return returnResponse(dir + index)
        }

        // otherwise, send if is a file
        if (await exist(dir + filePart)) return returnResponse(dir + filePart)

        // otherwise, do not send response, allowing next handler to handle it
    }

    // handle GET and HEAD request only
    instance.head(`${urlPath}/(.*)`, handler)
    instance.get(`${urlPath}/(.*)`, handler)
}
