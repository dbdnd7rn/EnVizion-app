/**
 * A SPA fallback can return index.html with HTTP 200 even for missing bundles.
 * Treat that as a release failure, never as successful JavaScript delivery.
 */
export function resolveLocalScriptUrl(source, htmlUrl) {
  const src = new URL(source, htmlUrl);
  const site = new URL(htmlUrl);
  if (src.origin !== site.origin) {
    throw new Error("Production HTML references a JavaScript asset outside the application origin.");
  }
  if (!/\.js$/i.test(src.pathname)) {
    throw new Error("Production HTML references an unexpected script asset type.");
  }
  return src.toString();
}

export function isJavascriptContentType(contentType) {
  return /^\s*(?:application|text)\/(?:javascript|ecmascript|x-javascript)(?:\s*;|$)/i.test(contentType || "");
}

export function hasHtmlFallback(body) {
  const prefix = body.slice(0, 1024).trimStart().toLowerCase();
  return prefix.startsWith("<!doctype html") || prefix.startsWith("<html") ||
    prefix.startsWith("<head") || prefix.startsWith("<body");
}
