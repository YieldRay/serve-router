import fetch, { Request, Headers } from "node-fetch";

/**
 * Usage:
import { serve } from "xxx"
export default serve((req) => {
    const u = new URL(req.url);
    u.host = "example.net";
    return fetch(u, new Request(req));
});
*/

export function serve(handler) {
    return defineComponent({
        async run({ steps, $ }) {
            const response = await pipedreamToRequest(steps, handler);
            await responseToPipedream($, response);
        },
    });
}

async function pipedreamToRequest(steps, handler) {
    const event = steps.trigger.event;
    const url = new URL(event.url);
    const headers = { "x-client-ip": event.client_ip };
    for (let i = 0; i < event.headers.length; i += 2) {
        const k = event.headers[i];
        if (k.toLowerCase() === "host") continue;
        const v = event.headers[i + 1];
        headers[k] = v;
    }
    const method = event.method;
    const body = method === "GET" || method === "HEAD" ? undefined : event.body;
    const request = new Request(url, { method, headers, body });
    return await handler(request);
}

async function responseToPipedream($, response) {
    const headers = new Headers(response.headers);
    headers.delete("connection");
    headers.delete("content-encoding");
    const body = Boolean(response.body) ? Buffer.from(await response.arrayBuffer()) : "";
    return await $.respond({
        status: response.status,
        headers: Object.fromEntries(headers),
        body,
    });
}
