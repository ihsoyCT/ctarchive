const axios = require("axios").default;
const moment = require("moment");
const marked = require("marked");

import { artic_shift } from "./artic_shift";
import { pushpull } from "./pushpull";

function base10to36(number) {
  return parseInt(number).toString(36);
}

export const Backends = Object.freeze({
  PUSHPULL: 0,
  ARTIC_SHIFT: 1
})

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
  changeStatus(status) {
    console.log(status);
  },
  last: null,
  useOld: false,
  createRequest(urlParams) {
    let query = [];
    urlParams.forEach((p, k) => {
      if ((k === "since" || k === "until" || k === "before" || k === "after") && p !== "") {
        p = Math.floor(new Date(p).getTime() / 1000);
      }
      if (p !== "" && k !== "mode") query.push(k + "=" + p);
    });
    console.log("AAAA", query);
    return query.join("&");
  },
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
  sleep(ms) {
    subreddit.changeStatus("Waiting for:" + ms + "ms");
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
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
  set_reddit_link(id) {
    if (id != null) {
      document.getElementById("reddit_link").innerHTML =
        "<a href='https://reddit.com/" + id + "'>Submission on reddit</a>";
    } else {
      document.getElementById("reddit_link").innerHTML = "";
    }
  },
};

function updateStatusLog(message, type = "info") {
  const errorDiv = document.getElementById("error");
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

if (!document.getElementById('status-spinner-style')) {
  const style = document.createElement('style');
  style.id = 'status-spinner-style';
  style.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }`;
  document.head.appendChild(style);
}
