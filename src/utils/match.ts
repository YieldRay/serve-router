/// <reference types="urlpattern-polyfill" />

/**
 * @example
 * match("/user/:name", "http://example.net/user/ray") // => { name: "ray" }
 */
export function match<T extends string>(pathname: T, url: string) {
    const pattern = new URLPattern({ pathname })
    return pattern.exec(url)?.pathname.groups as Params<T> | undefined
}

export type Params<T extends string = string> = T extends `${string}:${infer U}`
    ? U extends `${infer R}/${infer S}`
        ? { [Group in R]: string } & Params<S>
        : { [Group in U]: string }
    : { [Group in string]?: string }
