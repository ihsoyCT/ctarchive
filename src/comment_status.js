import { updateStatusLog } from "./subreddit";
const axios = require("axios").default;

const backendUrl = "https://ihsoy.com";
// The backend checks at most this many comments per request
const MAX_COMMENTS = 2000;

// status from the backend -> [label, class for the comment box, tooltip]
const STATUS_DISPLAY = {
  deleted: ["deleted by user", "comment-red", "The author deleted this comment on Reddit"],
  removed: ["removed by moderators", "comment-red", "Removed on Reddit by the subreddit's moderators or Reddit's spam filters"],
  removed_by_reddit: ["removed by Reddit", "comment-red", "Removed by Reddit's admins"],
  account_deleted: ["account deleted", "comment-amber", "Still visible on Reddit, but the author deleted their account"],
  unknown: ["not found on Reddit", "comment-red", "Reddit does not return this comment"],
};

// If the archive only captured the placeholder, it was gone before archiving
const ARCHIVED_PLACEHOLDER = { "[deleted]": "deleted", "[removed]": "removed" };

/**
 * Flatten an Arctic Shift comment tree into [{id, body}], replies included.
 * @param {Array} nodes top-level nodes ({kind, data: {id, body, replies}})
 * @returns {Array<{id: string, body: string}>}
 */
export function flattenCommentTree(nodes) {
  const out = [];
  const stack = [...nodes];
  while (stack.length > 0) {
    const node = stack.pop();
    const data = node?.data;
    if (!data?.id) continue;
    out.push({ id: data.id, body: data.body });
    stack.push(...(data.replies?.data?.children || []));
  }
  return out;
}

function markComment(id, status) {
  const [label, className, tooltip] = STATUS_DISPLAY[status];
  const title = document.getElementById(id);
  if (!title) return;
  const box = title.closest(".post, .post_highlight");
  if (box) box.classList.add(className);
  if (title.querySelector(".comment-status")) return;
  const badge = document.createElement("span");
  badge.className = `comment-status comment-status-${status}`;
  badge.textContent = label;
  badge.title = tooltip;
  title.appendChild(badge);
}

/**
 * Ask the backend how each archived comment looks on Reddit today and label
 * the ones that were deleted or removed.
 * @param {Array<{id: string, body: string}>} comments all comments of the thread
 */
export async function markCommentStatus(comments) {
  if (comments.length === 0) return;
  if (comments.length > MAX_COMMENTS) {
    updateStatusLog(`Not checking for deleted comments: this thread has more than ${MAX_COMMENTS} comments.`, "error");
    return;
  }
  updateStatusLog(`Checking which comments were deleted or removed on Reddit.`, "loading");

  let result;
  try {
    // text/plain keeps this a simple CORS request (no preflight)
    const response = await axios.post(`${backendUrl}/reddit-comments/status`, comments.map((c) => c.id).join(","), {
      headers: { "Content-Type": "text/plain" },
      timeout: 30000,
    });
    result = response.data;
  } catch (err) {
    const reason = typeof err?.response?.data === "string" ? err.response.data : err.message;
    updateStatusLog(`Could not check comments on Reddit: ${reason}.`, "error");
    return;
  }

  const counts = {};
  for (const comment of comments) {
    let status = result.statuses?.[comment.id];
    if ((!status || status === "ok") && ARCHIVED_PLACEHOLDER[comment.body]) {
      status = ARCHIVED_PLACEHOLDER[comment.body];
    }
    if (!STATUS_DISPLAY[status]) continue;
    markComment(comment.id, status);
    counts[status] = (counts[status] || 0) + 1;
  }

  const summary = Object.entries(counts).map(([status, n]) => `${n} ${STATUS_DISPLAY[status][0]}`);
  const partial = result.incomplete ? " Some comments could not be checked (Reddit rate limit), try again later." : "";
  updateStatusLog(
    summary.length > 0 ? `Checked ${comments.length} comments on Reddit: ${summary.join(", ")}.${partial}` : `Checked ${comments.length} comments on Reddit: none deleted or removed.${partial}`,
    result.incomplete ? "error" : "success",
  );
}
