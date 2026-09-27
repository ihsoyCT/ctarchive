import { updateStatusLog } from "./subreddit";
import { markCommentStatus } from "./comment_status";
import { renderMarkdown, isRedditId, safeUrl } from "./sanitize";
const axios = require("axios").default;
import { formatTime } from "./time";
import { addPaginationLinks, inDisplayOrder, pageRequest, withoutSkipped } from "./pagination";

// Pagination follows the sort field (created_utc, score or num_comments)
const paginationFor = (urlParams) => ({
  sortOrder: urlParams.get("sort"),
  sortKey: urlParams.get("sort_type") || "created_utc",
  container: document.getElementById("paginate"),
});

// Pullpush wants epoch seconds. Dates from the search form are datetime-local
// strings in the viewer's time zone; cursor values are already epoch seconds.
function toEpoch(value) {
  if (!value) return null;
  if (/^\d+$/.test(value)) return value;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : String(Math.floor(ms / 1000));
}

// API parameters for a submission or comment search
function apiParams(urlParams) {
  const sortKey = urlParams.get("sort_type") || "created_utc";
  const page = pageRequest(urlParams, { maxLimit: 1000, sortKey });
  const params = new URLSearchParams();
  urlParams.forEach((value, key) => {
    if (!["before", "after", "sort", "limit", "skip", "cursor", "page"].includes(key)) {
      params.append(key, value);
    }
  });
  params.set("sort", page.sort);
  if (page.limit) params.set("limit", page.limit);
  const before = toEpoch(page.before);
  const after = toEpoch(page.after);
  if (before) params.set("before", before);
  if (after) params.set("after", after);
  // While paging by score/num_comments the cursor replaces that form filter
  if (page.sortFilter) params.set(sortKey, page.sortFilter);
  return params;
}

/**
 * Pullpush backend logic for Reddit archive search.
 * @namespace pullpush
 */
const pullpush = {
  link: {
    submission: "https://api.pullpush.io/reddit/search/submission/?test",
    commentSearch: "https://api.pullpush.io/reddit/search/comment/?test",
  },

  /**
   * Fetch submissions from Pullpush API and render them.
   * @param {URLSearchParams} urlParams
   * @param {object} subreddit
   */
  get_submissions(urlParams, subreddit) {
    const params = apiParams(urlParams);
    const url = this.link.submission + "&" + params.toString();
    updateStatusLog(`Grabbing Submissions from Pullpush with params: ${params.toString()}`, "loading");
    axios
      .get(url)
      .then((e) => {
        subreddit.$el.innerHTML = "";
        const frag = document.createDocumentFragment();
        const items = inDisplayOrder(e.data.data, urlParams);
        const shown = withoutSkipped(items, urlParams);
        shown.forEach((sub) => {
          sub.time = formatTime(sub.created_utc);
          set_thumbmail(sub);
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = subreddit.template.submissionCompiled(sub);
          frag.appendChild(tempDiv.firstElementChild);
        });
        subreddit.$el.appendChild(frag);
        updateStatusLog(`Done grabbing submissions from Pullpush`, "success");
        addPaginationLinks({ data: shown, ...paginationFor(urlParams) });
      })
      .catch((e) => {
        updateStatusLog(`Error grabbing submissions from Pullpush: ${e.message}`, "error");
      });
  },

  /**
   * Fetch a submission and its comment tree by ID from Arctic Shift API.
   * @param {string} id 
   * @param {string} highlight
   * @param {object} subreddit
   */
  async grab_comments(id, highlight, subreddit) {
    if (!isRedditId(id)) {
      updateStatusLog(`Invalid submission ID.`, "error");
      return;
    }
    const submission_url = `${this.link.submission}&ids=${id}`;
    updateStatusLog(`Grabbing Submission by ID from PullPush: ${id}`, "loading");

    const root = document.createElement("div");
    root.id = `t3_${id}`;
    document.getElementById("comments").replaceChildren(root);
    axios.get(submission_url).then((e) => {
      e.data.data[0].time = formatTime(e.data.data[0].created_utc);
      e.data.data[0].selftext = renderMarkdown(e.data.data[0].selftext);
      set_thumbmail(e.data.data[0]);
      subreddit.$el.innerHTML = subreddit.template.submissionCompiled(e.data.data[0]);
      updateStatusLog(`Done grabbing submission by ID from PullPush`, "success");
    }).catch((error) => {
      let errorMsg = error?.response?.data?.error || error.message;
      updateStatusLog(`Error grabbing submission by ID from PullPush: ${errorMsg}`, "error");
    });

    // Handle paginated comment loading
    let allComments = [];
    let beforeTime = null;
    let hasMore = true;

    while (hasMore) {
      const params = beforeTime ?
        `${this.link.commentSearch}&link_id=${id}&limit=100&before=${beforeTime}` :
        `${this.link.commentSearch}&link_id=${id}&limit=100`;

      try {
        const response = await axios.get(params);
        const comments = response.data.data;

        if (comments.length < 100) {
          hasMore = false;
        } else {
          // Get created_utc from last comment for next page
          beforeTime = comments[comments.length - 1].created_utc;
        }

        allComments = allComments.concat(comments);
        updateStatusLog(`Loading comments... (${allComments.length} loaded)`, "loading", true);  // true flag for updating in place
      } catch (err) {
        updateStatusLog(`Error loading comments page: ${err.message}`, "error");
        hasMore = false;
      }
    }

    // Process all collected comments
    if (allComments.length > 0) {
      // Use batch processing for better performance
      this.handle_comments_batch(allComments, subreddit, `t3_${id}`, highlight);

      if (highlight !== null) {
        const el = document.getElementById(highlight);
        if (el) el.scrollIntoView();
      }

      updateStatusLog(`Done loading ${allComments.length} comments from PullPush.`, "success");

      // Only run deleted check if comments were successfully loaded
      if (allComments.length === 0) {
        updateStatusLog(`Could not load comments from PullPush, skipping deleted check.`, "error");
        return;
      }
      markCommentStatus(allComments.map((c) => ({ id: c.id, body: c.body })));
    } else {
      updateStatusLog(`Could not load comments from PullPush, skipping deleted check.`, "error");
    }
  },
  /**
   * Handle and render a comment tree node (recursive, uses DocumentFragment for performance).
   * @param {object} comment
   * @param {object} subreddit
   * @param {string} parent
   * @param {string} highlight
   */
  handle_comments_batch(comments, subreddit, parentId, highlight) {
    // Build comment tree structure first
    const commentMap = new Map();
    const rootComments = [];
    
    // First pass - create map
    comments.forEach(comment => {
      commentMap.set(comment.id, {
        data: comment,
        children: []
      });
    });

    // Second pass - build tree
    comments.forEach(comment => {
      const node = commentMap.get(comment.id);
      const parentNode = commentMap.get(comment.parent_id?.split('_')[1]);
      if (parentNode) {
        parentNode.children.push(node);
      } else {
        rootComments.push(node);
      }
    });

    // Create fragment for batch DOM insertion
    const frag = document.createDocumentFragment();
    
    // Recursive render function
    const renderComment = (node, parentElement) => {
      const data = node.data;
      const tpl_data = {
        "id": data.id,
        "author": data.author,
        "score": data.score,
        "time": formatTime(data.created_utc),
        "body": renderMarkdown(data.body),
        "postClass": data.id === highlight ? "post_highlight" : "post"
      };

      const commentDiv = document.createElement("div");
      commentDiv.innerHTML = subreddit.template.postCompiled(tpl_data);
      const commentElement = commentDiv.firstElementChild;
      
      // Replies go into the .children container, which provides the indent
      const childrenContainer = commentElement.querySelector(".children") || commentElement;
      node.children.forEach(child => renderComment(child, childrenContainer));
      
      parentElement.appendChild(commentElement);
    };

    // Render the tree
    rootComments.forEach(root => renderComment(root, frag));

    // Single DOM insertion
    const container = document.getElementById(parentId) || document.getElementById("orphans");
    container.appendChild(frag);
  },

  /**
   * Search comments from Pullpush API and render them.
   * @param {URLSearchParams} urlParams
   * @param {object} subreddit
   */
  search_comments(urlParams, subreddit) {
    const params = apiParams(urlParams);

    const url = this.link.commentSearch + "&" + params.toString();
    updateStatusLog(`Searching comments from Pullpush with params: ${params.toString()}`, "loading");
    axios
      .get(url)
      .then((e) => {
        subreddit.$el.innerHTML = "";
        const frag = document.createDocumentFragment();
        const items = inDisplayOrder(e.data.data, urlParams);
        const shown = withoutSkipped(items, urlParams);
        shown.forEach((post) => {
          post.time = formatTime(post.created_utc);
          post.body = renderMarkdown(post.body);
          post.link_id = post.link_id.split("_").pop();
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = subreddit.template.profilePostCompiled(post);
          frag.appendChild(tempDiv.firstElementChild);
        });
        subreddit.$el.appendChild(frag);
        updateStatusLog(`Done searching comments from Pullpush`, "success");
        addPaginationLinks({ data: shown, ...paginationFor(urlParams) });
      })
      .catch((e) => {
        updateStatusLog(`Error searching comments from Pullpush: ${e.message}`, "error");
      });
  },
};


function normalize_url(url) {
  return safeUrl(url).replace(/&amp;/g, "&");
}

function set_thumbmail(sub) {
  const imagetypes = ["jpg", "png", "gif", "jpeg"];
  
  sub.url = safeUrl(sub?.url);
  if (sub.url && imagetypes.includes(sub.url.split(".").pop())) sub.thumbnail = normalize_url(sub.url);

  // If preview exists, collect all images[].source.url into sub.previews
  if (sub.preview && Array.isArray(sub.preview.images)) {
    sub.previews = sub.preview.images.map(img => img.source && img.source.url && normalize_url(img.source.url)).filter(Boolean);
  }
  // If media_metadata exists, add all s.u from each image to sub.previews
  if (sub.media_metadata && typeof sub.media_metadata === 'object') {
    if (!sub.previews) sub.previews = [];
    Object.values(sub.media_metadata).forEach(meta => {
      if (meta && meta.s && safeUrl(meta.s.u)) {
        sub.previews.push(normalize_url(meta.s.u));
      }
    });
  }
}

export { pullpush };
