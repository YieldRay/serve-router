import { serve as serveNode } from "../node/index.js"

let serve: typeof serveNode

//@ts-ignore
if (typeof Deno !== "undefined" && typeof Deno.serve !== "undefined") serve = Deno.serve
else serve = serveNode

export { serve }
