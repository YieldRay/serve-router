import { match, type Params } from "./utils/match.ts"
import type { Awaitable } from "./utils/types.ts"

export const METHOD_ALL = Symbol("METHOD_ALL")
export const METHOD_USE = Symbol("METHOD_USE")
export const METHOD = Symbol("METHOD")

/**
 * This Error class allow you to distinct if error is thrown by serve-router.
 */
export class ServeRouterError extends Error {
    override name = "ServeRouterError"
}

type TContext = Exclude<object, "params" | "next">
type BuiltInContext<Path extends string = string> = {
    params: Params<Path>
    next: () => Promise<Response>
}
type Method = string | symbol

interface Routes {
    [method: Method]:
        | Array<{
              path: string
              handlers: ServeRouterHandler<any, any>[]
          }>
        | undefined
}

export type ServeRouterHandler<Context extends TContext = {}, Path extends string = string> = {
    (request: Request, context: BuiltInContext<Path> & Context): Awaitable<Response>
}

export interface ServeRouterOptions<Context extends TContext = {}> {
    /**
     * Callback function when a registered handler throws, this callback capture the error variable,
     * the handler itself, and parameters the handler consumes.
     *
     * This callback function may return Response and it will be sent to the client.
     * Please note that onError can be async, but make sure it DOES NOT throws.
     *
     * @param error the variable thrown by the handler.
     * @param handler the throwing handler that cause the error, this should ONLY for debug purpose.
     * @param args the arguments passed to the handler.
     */
    onError?(
        error: unknown,
        handler: ServeRouterHandler,
        args: Parameters<ServeRouterHandler>
    ): ReturnType<ServeRouterHandler> | Awaitable<void>
    /**
     * @default {}
     */
    context?: Context | ((request: Request) => Awaitable<Context>)
}

/**
 * @example
 * ```
 * const app = ServeRouter()
 * app.get("/(.*)", req => new Response("hello, world!"))
 * Deno.serve(app.fetch)
 * ```
 */
function ServeRouter<GlobalContext extends TContext = {}>(
    options?: ServeRouterOptions<GlobalContext>
) {
    // prevent call by `new`
    if (new.target)
        throw new ServeRouterError(
            "ServeRouter() should be called as a function, not as a constructor. Please remove the 'new' keyword."
        )

    const onError: NonNullable<ServeRouterOptions["onError"]> =
        options?.onError ||
        ((e, handler, args) =>
            console.error(
                e,
                [
                    "\r\n",
                    "-".repeat(50),
                    "Caused by handler:",
                    handler,
                    "-".repeat(50),
                    "Arguments:",
                ].join("\r\n"),
                args,
                "\r\n",
                "-".repeat(50),
                "\r\n"
            ))

    // store routes added by instance methods
    const routes: Routes = {}

    async function serveHandler(request: Request) {
        // the context object, will pass to handler as the second parameter
        const context = (
            options && "context" in options
                ? typeof options.context === "function"
                    ? await options.context(request)
                    : options.context
                : {}
        ) as GlobalContext & BuiltInContext

        if (typeof context !== "object")
            throw new TypeError(
                "Invalid context: expected an object or a function returning an object. Please check the 'context' option in ServeRouter."
            )

        const pendingRoutes = routes[METHOD_USE] || []
        if (request.method in routes) pendingRoutes.push(...routes[request.method]!)
        if (METHOD_ALL in routes) pendingRoutes.push(...routes[METHOD_ALL]!)

        let i = -1
        const next: () => Promise<Response> = async () => {
            i++ // current route index
            if (i >= pendingRoutes.length) {
                return new Response(`Cannot ${request.method} ${new URL(request.url).pathname}`, {
                    status: 404,
                })
            }

            const { path } = pendingRoutes[i]
            const matches = match(path, request.url)
            if (!matches) {
                // try next route
                return next()
            }
            // assign matches to context object
            Reflect.set(context, "params", matches)

            const { handlers } = pendingRoutes[i]
            for (const handler of handlers) {
                try {
                    const response = await handler(request, context)
                    if (response instanceof Response) {
                        return response
                    }
                } catch (e) {
                    const response = await onError(e, handler, [request, context])
                    return response instanceof Response
                        ? response
                        : new Response("Internal Server Error", { status: 500 })
                }
            }

            // no return in current route
            return next()
        }

        Reflect.set(context, "next", next)
        return next()
    }

    const createInstance = (prefix = "") => {
        const add = <Context extends GlobalContext = GlobalContext, Path extends string = string>(
            method: Method,
            path: Path,
            ...handlers: ServeRouterHandler<Context, Path>[]
        ) => {
            ;(routes[method] ||= []).push({ path: prefix + path, handlers })
            return instance
        }
        const instance = {
            [METHOD]: <Context extends GlobalContext = GlobalContext, Path extends string = string>(
                method: string,
                path: Path,
                ...handlers: ServeRouterHandler<Context, Path>[]
            ) => add(method, path, ...handlers),

            get: <Context extends GlobalContext = GlobalContext, Path extends string = string>(
                path: Path,
                ...handlers: ServeRouterHandler<Context, Path>[]
            ) => add("GET", path, ...handlers),

            head: <Context extends GlobalContext = GlobalContext, Path extends string = string>(
                path: Path,
                ...handlers: ServeRouterHandler<Context, Path>[]
            ) => add("HEAD", path, ...handlers),

            post: <Context extends GlobalContext = GlobalContext, Path extends string = string>(
                path: Path,
                ...handlers: ServeRouterHandler<Context, Path>[]
            ) => add("POST", path, ...handlers),

            put: <Context extends GlobalContext = GlobalContext, Path extends string = string>(
                path: Path,
                ...handlers: ServeRouterHandler<Context, Path>[]
            ) => add("PUT", path, ...handlers),

            delete: <Context extends GlobalContext = GlobalContext, Path extends string = string>(
                path: Path,
                ...handlers: ServeRouterHandler<Context, Path>[]
            ) => add("DELETE", path, ...handlers),

            options: <Context extends GlobalContext = GlobalContext, Path extends string = string>(
                path: Path,
                ...handlers: ServeRouterHandler<Context, Path>[]
            ) => add("OPTIONS", path, ...handlers),

            patch: <Context extends GlobalContext = GlobalContext, Path extends string = string>(
                path: Path,
                ...handlers: ServeRouterHandler<Context, Path>[]
            ) => add("PATCH", path, ...handlers),

            use: <Context extends GlobalContext = GlobalContext, Path extends string = string>(
                path: Path,
                ...handlers: ServeRouterHandler<Context, Path>[]
            ) => add(METHOD_USE, path, ...handlers),

            all: <Context extends GlobalContext = GlobalContext, Path extends string = string>(
                path: Path,
                ...handlers: ServeRouterHandler<Context, Path>[]
            ) => add(METHOD_ALL, path, ...handlers),

            route: (path: string) => createInstance(path),
        }
        return instance
    }

    // export it so we can use it from other library
    const $export: Readonly<Routes> = routes

    return { ...createInstance(), export: $export, fetch: serveHandler }
}

export { ServeRouter, ServeRouter as default }
