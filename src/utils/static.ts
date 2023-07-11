import { type Handler } from "../index.js"

async function exist(path: string | URL) {
    try {
        const stat = await Deno.stat(path)
        return stat.isFile
    } catch {
        return false
    }
}

async function fileResponse(path: string) {
    const realPath = await Deno.realPath(path)
    const file = await Deno.open(realPath, { read: true, create: false, createNew: false })
    const stat = await file.stat()
    const headers = { "content-length": String(stat.size) }

    const ext = realPath.replaceAll("\\", "/").split("/").toReversed()[0].split(".").at(-1)
    const contentType = (
        {
            htm: "text/html",
            html: "text/html",
            xhtml: "application/xhtml+xml",
            js: "text/javascript",
            mjs: "text/javascript",
            css: "text/css",
            txt: "text/plain",
            json: "application/json",
            xml: "application/xml",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            webp: "image/webp",
            bin: "application/octet-stream",
        } as Record<string, string>
    )[ext!] as string | undefined
    if (contentType) Reflect.set(headers, "content-type", contentType)
    return new Response(file.readable, { headers })
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
}

type InstanceFn<P extends object = object> = (path: string, ...handlers: Handler<P>[]) => unknown

/**
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
export function attachStatic<P extends object = object, T extends { get: InstanceFn<P> } = { get: InstanceFn<P> }>(
    instance: T,
    path: string,
    options?: string | Options
) {
    const dir = Deno.realPathSync(
        typeof options === "string"
            ? options
            : // if dir is not specified, get from path
              options?.dir ??
                  // path must starts with '/', so remove prefix '/'
                  path.slice(1)
    )
    if (!Deno.statSync(dir).isDirectory) throw new Error(`'${dir}' is not a directory!'`)

    const urlPath = path.endsWith("/") ? path.slice(0, -1) : path
    instance.get(`${urlPath}/(.*)`, async (request: Request) => {
        const filePart = new URL(request.url).pathname.slice(urlPath.length) // this must starts with '/'

        // if ends with '/', index file is required to send
        if (filePart.endsWith("/")) {
            const indexs = []
            if (typeof options === "object") options.index?.forEach((v) => indexs.push(v))
            else indexs.push("index.html", "index.htm")

            for (const index of indexs.map((i) => "/" + i)) {
                if (await exist(dir + index)) {
                    return fileResponse(dir + index)
                }
            }
        }

        // otherwise, send if is a file
        if (await exist(dir + filePart)) {
            return fileResponse(dir + filePart)
        }
        // do not send response, allowing next handler to handle it
    })
}
