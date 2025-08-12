/// <reference types="urlpattern-polyfill" />

/**
 * @example
 * match("/user/:name", "http://example.net/user/ray") // => { name: "ray" }
 */
export function match<T extends string>(pathname: T, url: string) {
    const pattern = new URLPattern({ pathname })
    return pattern.exec(url)?.pathname.groups as Params<T> | undefined
}

// Extract params from a pathname pattern supporting modifiers ?, *, + and regex parts like :id(\d+)
// Examples:
// "/user/:id" -> { id: string }
// "/optional/:val?" -> { val?: string }
// "/files/:path*" -> { path?: string }
// "/list/:item+" -> { item: string }
// "/num/:id(\\d+)" -> { id: string }
export type Params<T extends string = string> = string extends T
    ? { [key: string]: string | undefined }
    : T extends `${string}:${infer After}`
    ? After extends `${infer Raw}/${infer Rest}`
        ? ParamFromToken<Raw> & Params<Rest>
        : ParamFromToken<After>
    : {}

type StripRegex<Token extends string> = Token extends `${infer Name}(${string})${infer Mod}`
    ? `${Name}${Mod}`
    : Token

type ParamFromToken<Token extends string> = ParamRecord<StripRegex<Token>>

type ParamRecord<Token extends string> = Token extends `${infer Name}?`
    ? { [K in Name]?: string }
    : Token extends `${infer Name}*`
    ? { [K in Name]?: string }
    : Token extends `${infer Name}+`
    ? { [K in Name]: string }
    : { [K in Token]: string }
