import { artic_shift } from "./artic_shift";
import { pullpush } from "./pullpush";

/**
 * Enum for supported backends.
 * @readonly
 * @enum {number}
 */
export const Backends = Object.freeze({
  PULLPUSH: 0,
  ARTIC_SHIFT: 1
});

/**
 * Main subreddit logic and backend dispatcher.
 * @namespace subreddit
 */
export const subreddit = {
  backend: Backends.ARTIC_SHIFT,
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
  /**
   * Dispatch submission search to the correct backend.
   * @param {URLSearchParams} urlParams
   */
  grabSubmissions(urlParams) {
    switch (subreddit.backend) {
      case Backends.PULLPUSH:
        pullpush.get_submissions(urlParams, subreddit);
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
      case Backends.PULLPUSH:
        pullpush.grab_comments(id, highlight, subreddit);
        break;
      case Backends.ARTIC_SHIFT:
        artic_shift.grab_comments(id, highlight, subreddit)
        break;
    }
  },
  /**
   * Dispatch comment search to the correct backend.
   * @param {URLSearchParams} urlParams
   */
  searchComments(urlParams) {
    switch (this.backend) {
      case Backends.PULLPUSH:
        pullpush.search_comments(urlParams, subreddit);
        break;
      case Backends.ARTIC_SHIFT:
        artic_shift.search_comments(urlParams, subreddit)
        break;
    }
  },
  onModeChange(select) {
    if (select === "submissions") {
      Array.from(document.getElementsByClassName("submission_only")).forEach(e => {
        e.style.display = "";
        e.querySelectorAll('input, select, textarea, button').forEach(ctrl => ctrl.removeAttribute('disabled'));
      })
      Array.from(document.getElementsByClassName("comments_only")).forEach(e => {
        e.style.display = "none";
        e.querySelectorAll('input, select, textarea, button').forEach(ctrl =>  ctrl.setAttribute('disabled', 'disabled'));
      })
    } else {
      Array.from(document.getElementsByClassName("submission_only")).forEach(e => {
        e.style.display = "none";
        e.querySelectorAll('input, select, textarea, button').forEach(ctrl => ctrl.setAttribute('disabled', 'disabled'));
      })
      Array.from(document.getElementsByClassName("comments_only")).forEach(e => {
        e.style.display = "";
        e.querySelectorAll('input, select, textarea, button').forEach(ctrl => ctrl.removeAttribute('disabled'));
      })
    }
  }
};


/**
 * Update the status log UI with a message and type.
 * @param {string} message
 * @param {"info"|"loading"|"success"|"error"} [type="info"]
 * @param {boolean} [inPlace=false] Whether to update the last message instead of adding a new one
 */
function updateStatusLog(message, type = "info", inPlace = false) {
  const errorDiv = document.getElementById("error");
  if (!errorDiv) return;

  // If updating in place and there's a previous loading message, update it
  if (inPlace && type === "loading") {
    const lastMessage = errorDiv.lastElementChild;
    if (lastMessage && lastMessage.querySelector('.status-icon.spinner')) {
      const icon = lastMessage.querySelector('.status-icon.spinner');
      lastMessage.replaceChildren(icon, document.createTextNode(message));
      return;
    }
  }

  // Remove previous spinner if present
  if (type === "success" || type === "error") {
    const spinners = errorDiv.querySelectorAll('.status-icon.spinner');
    spinners.forEach(spinner => spinner.parentElement && spinner.parentElement.remove());
  }

  // Toggle red background for error only if error, remove otherwise
  if (type === "error") {
    errorDiv.classList.add("error-active");
  } else {
    errorDiv.classList.remove("error-active");
  }
  const line = document.createElement("div");
  let icon = "";
  if (type === "loading") {
    icon = `<span class='status-icon spinner'></span>`;
  } else if (type === "success") {
    icon = `<span class='status-icon success'>&#10003;</span>`;
  } else if (type === "error") {
    // Use a more normal, straight cross (multiplication sign)
    icon = `<span class='status-icon error' style="font-family:monospace;font-weight:bold;">&#215;</span>`;
  }
  line.innerHTML = icon;
  line.appendChild(document.createTextNode(message));
  errorDiv.appendChild(line);

  // Hide error div if empty (no children)
  if (errorDiv.childElementCount === 0) {
    errorDiv.style.display = 'none';
  } else {
    errorDiv.style.display = '';
  }
}

export { updateStatusLog };

// Add spinner keyframes if not present
if (!document.getElementById('status-spinner-style')) {
  const style = document.createElement('style');
  style.id = 'status-spinner-style';
  style.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }`;
  document.head.appendChild(style);
}
