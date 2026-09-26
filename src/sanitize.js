import DOMPurify from "dompurify";
const marked = require("marked");

/**
 * Render Reddit markdown to HTML with anything executable stripped
 * (script tags, event handlers, javascript: links).
 * @param {string} text
 * @returns {string}
 */
export function renderMarkdown(text) {
  return DOMPurify.sanitize(marked.parse(text || ""));
}

/**
 * Reddit base36 ids, e.g. "1r3pcis". Anything else in an id slot is rejected.
 * @param {string} id
 * @returns {boolean}
 */
export function isRedditId(id) {
  return typeof id === "string" && /^[a-z0-9]{1,16}$/i.test(id);
}

/**
 * Only allow http(s) links from archive data into href/src attributes.
 * @param {string} url
 * @returns {string}
 */
export function safeUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url) ? url : "";
}
