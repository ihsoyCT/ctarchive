const axios = require("axios").default;
const moment = require("moment");
const marked = require("marked");

import { artic_shift } from "./artic_shift";
import { pushpull } from "./pushpull";

/**
 * Enum for supported backends.
 * @readonly
 * @enum {number}
 */
export const Backends = Object.freeze({
  PUSHPULL: 0,
  ARTIC_SHIFT: 1
});

/**
 * Main subreddit logic and backend dispatcher.
 * @namespace subreddit
 */
export const subreddit = {
  backend: Backends.ARTIC_SHIFT,
  link: {
    submission:
      "https://api.pullpush.io/reddit/search/submission/?test",
    commentsID: "https://api.pushshift.io/reddit/submission/comment_ids/",
    comments: "https://api.pushshift.io/reddit/search/comment?filter=id,author,parent_id,score,body,created_utc&ids=",
    commentSearch:
      "https://api.pullpush.io/reddit/search/comment/?test",
    commentsBackup:
      "https://api.pullpush.io/reddit/comment/search?sort=asc&limit=1000&link_id=",
  },
  template: {
    submissionCompiled: require("./templates/submission.pug"),
    postCompiled: require("./templates/post.pug"),
    profilePostCompiled: require("./templates/profilePost.pug"),
  },
  $el: (() => {
    const a = document.createElement("div");
    a.id = "submission";
    a.innerHTML = "Loading Submission/Comments or you haven't done a search yet.";
    return a;
  })(),
  requestCount: 0,
  /**
   * Change status (for legacy compatibility).
   * @param {string} status
   */
  changeStatus(status) {
    // No-op or could be improved for future use
  },
  last: null,
  useOld: false,
  /**
   * Create a query string from URLSearchParams, converting date fields to epoch.
   * @param {URLSearchParams} urlParams
   * @returns {string}
   */
  createRequest(urlParams) {
    let query = [];
    urlParams.forEach((p, k) => {
      if ((k === "since" || k === "until" || k === "before" || k === "after") && p !== "") {
        p = Math.floor(new Date(p).getTime() / 1000);
      }
      if (p !== "" && k !== "mode") query.push(k + "=" + p);
    });
    return query.join("&");
  },
  /**
   * Dispatch submission search to the correct backend.
   * @param {URLSearchParams} urlParams
   */
  grabSubmissions(urlParams) {
    switch (subreddit.backend) {
      case Backends.PUSHPULL:
        pushpull.get_submissions(urlParams, subreddit);
        break;
      case Backends.ARTIC_SHIFT:
        artic_shift.get_submissions(urlParams, subreddit);
        break;
    }
  },
  /**
   * Dispatch comment grab to the correct backend.
   * @param {string} id
   * @param {string} highlight
   */
  grabComments(id, highlight) {
    switch (subreddit.backend) {
      case Backends.PUSHPULL:
        pushpull.grab_comments(id, highlight, subreddit);
        break;
      case Backends.ARTIC_SHIFT:
        artic_shift.grab_comments(id, highlight, subreddit)
        break;
    }
  },
  /**
   * Sleep utility (async).
   * @param {number} ms
   * @returns {Promise<void>}
   */
  sleep(ms) {
    subreddit.changeStatus(`Waiting for: ${ms}ms`);
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
  /**
   * Dispatch comment search to the correct backend.
   * @param {URLSearchParams} urlParams
   */
  searchComments(urlParams) {
    switch (this.backend) {
      case Backends.PUSHPULL:
        pushpull.search_comments(urlParams, subreddit);
        break;
      case Backends.ARTIC_SHIFT:
        artic_shift.search_comments(urlParams, subreddit)
        break;
    }
  },
  /**
   * Set the Reddit link for a submission.
   * @param {string|null} id
   */
  set_reddit_link(id) {
    const redditLinkDiv = document.getElementById("reddit_link");
    if (!redditLinkDiv) return;
    if (id != null) {
      redditLinkDiv.innerHTML =
        `<a href='https://reddit.com/${id}'>Submission on reddit</a>`;
    } else {
      redditLinkDiv.innerHTML = "";
    }
  },
};

/**
 * Update the status log UI with a message and type.
 * @param {string} message
 * @param {"info"|"loading"|"success"|"error"} [type="info"]
 */
function updateStatusLog(message, type = "info") {
  const errorDiv = document.getElementById("error");
  if (!errorDiv) return;
  // Remove previous spinner if present
  if (type === "success" || type === "error") {
    const spinners = errorDiv.querySelectorAll('.status-icon.spinner');
    spinners.forEach(spinner => spinner.parentElement && spinner.parentElement.remove());
  }
  const line = document.createElement("div");
  let icon = "";
  if (type === "loading") {
    icon = `<span class='status-icon spinner'></span>`;
  } else if (type === "success") {
    icon = `<span class='status-icon success'>&#10003;</span>`;
  } else if (type === "error") {
    icon = `<span class='status-icon error'>&#10007;</span>`;
  }
  line.innerHTML = icon + message;
  errorDiv.appendChild(line);
}

export { updateStatusLog };

// Add spinner keyframes if not present
if (!document.getElementById('status-spinner-style')) {
  const style = document.createElement('style');
  style.id = 'status-spinner-style';
  style.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }`;
  document.head.appendChild(style);
}
