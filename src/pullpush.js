import { updateStatusLog } from "./subreddit";
const axios = require("axios").default;
const moment = require("moment");
const marked = require("marked");

const backendUrl = "https://ihsoy.com";

/**
 * Pullpush backend logic for Reddit archive search.
 * @namespace pullpush
 */
// Cache for compiled templates
const templateCache = new Map();

// Get or create compiled template
const getCompiledTemplate = (template, data) => {
  const key = JSON.stringify(data);
  if (!templateCache.has(key)) {
    templateCache.set(key, template(data));
  }
  return templateCache.get(key);
};

// Batch rendering constants
const BATCH_SIZE = 100;

function renderInBatches(comments, processFunction) {
  let index = 0;
  
  function processBatch() {
    const batch = comments.slice(index, index + BATCH_SIZE);
    batch.forEach(processFunction);
    index += BATCH_SIZE;
    
    if (index < comments.length) {
      requestAnimationFrame(processBatch);
    }
  }
  
  requestAnimationFrame(processBatch);
}

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
    // Create a new URLSearchParams to modify without affecting the original
    const params = new URLSearchParams();
    
    const sortType = urlParams.get('sort_type') || 'created_utc';
    
    // Copy all parameters except those that need special handling
    urlParams.forEach((value, key) => {
      if (!['before', 'after', 'score'].includes(key)) {
        params.append(key, value);
      }
    });

    if (sortType === 'score') {
      // Handle score-based pagination
      const score = urlParams.get('score');
      if (score) {
        params.append('score', score);
      }
    } else {
      // Handle before/after timestamps
      const before = urlParams.get('before');
      const after = urlParams.get('after');
      
      if (before) {
        // If it's already a Unix timestamp, use it as is
        const beforeTimestamp = /^\d{10}$/.test(before) ? before : Math.floor(before / 1000);
        params.append('before', beforeTimestamp);
      }
      
      if (after) {
        // If it's already a Unix timestamp, use it as is
        const afterTimestamp = /^\d{10}$/.test(after) ? after : Math.floor(after / 1000);
        params.append('after', afterTimestamp);
      }
    }

    const url = this.link.submission + "&" + params.toString();
    updateStatusLog(`Grabbing Submissions from Pullpush with params: ${params.toString()}`, "loading");
    axios
      .get(url)
      .then((e) => {
        subreddit.$el.innerHTML = "";
        const frag = document.createDocumentFragment();
        e.data.data.forEach((sub) => {
          sub.time = moment.unix(sub.created_utc).format("llll");
          set_thumbmail(sub);
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = subreddit.template.submissionCompiled(sub);
          frag.appendChild(tempDiv.firstElementChild);
          subreddit.last = sub;
        });
        subreddit.$el.appendChild(frag);
        updateStatusLog(`Done grabbing submissions from Pullpush`, "success");
        addPaginationLinks({ data: e.data.data, urlParams, container: document.getElementById('paginate') });
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
    const submission_url = `${this.link.submission}&ids=${id}`;
    updateStatusLog(`Grabbing Submission by ID from PullPush: ${id}`, "loading");

    document.getElementById("comments").innerHTML = `<div id=t3_${id}></div>`;
    axios.get(submission_url).then((e) => {
      e.data.data[0].time = moment.unix(e.data.data[0].created_utc).format("llll");
      e.data.data[0].selftext = marked.parse(e.data.data[0].selftext);
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
      this.handle_comments_batch(allComments, subreddit, `t3_${id}`, highlight, []);

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
      // Only do the deleted check if there are less than 2000 comments
      if (true) {
        console.log(this.comments_count);
        updateStatusLog(`Loading reddit comments to highlight deleted comments.`, "loading");
        if (this.comments_count > 2000) {
          updateStatusLog(`Not loading deleted comments as there too many comments in this post.`, "error");
          return;
        }
        let deletedIdsPromise = axios.get(`${backendUrl}/reddit-comments?post=${id}`, { timeout: 5000 })
          .then(resp => resp.status === 200 ? resp.data["ids"] : [])
          .catch((err) => {
            let errorMsg = err?.response?.data || "unknown error";
            console.error(err);
            updateStatusLog(`Could not load reddit comments: error: ${errorMsg}.`, "error");
            return null;
          });

        deletedIdsPromise.then(deletedIds => {
          if (!deletedIds) return; // Only run if not failed
          const arcticIds = new Set(allComments.map(c => c.id));
          const deletedIdsSet = new Set(deletedIds);
          // Find IDs only in one list
          const onlyInArctic = [...arcticIds].filter(x => !deletedIdsSet.has(x));
          const onlyInDeleted = [...deletedIdsSet].filter(x => !arcticIds.has(x));
          // Mark comments only in one list as red
          onlyInArctic.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
              let postDiv = el.closest('.post');
              if (postDiv) postDiv.classList.add('comment-red');
            }
          });
          // Also mark deleted/removed bodies
          allComments.forEach(comment => {
            if (["[deleted]", "[removed]"].includes(comment.body)) {
              const el = document.getElementById(comment.id);
              if (el) {
                let postDiv = el.closest('.post');
                if (postDiv) postDiv.classList.add('comment-red');
              }
            }
          });
          updateStatusLog(`Done marking deleted comments.`, "success");
        });
      }
    } else {
      updateStatusLog(`Could not load comments from PullPush, skipping deleted check.`, "error");
    }
  },
  comments_count: 0,
  comments_map: {},
  /**
   * Handle and render a comment tree node (recursive, uses DocumentFragment for performance).
   * @param {object} comment
   * @param {object} subreddit
   * @param {string} parent
   * @param {string} highlight
   */
  handle_comments_batch(comments, subreddit, parentId, highlight, IDsOfRedditComments = []) {
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
      const colorClass = IDsOfRedditComments.length > 0 && 
        (!IDsOfRedditComments.includes(data.id) || ["[deleted]", "[removed]"].includes(data.body))
        ? "comment-red"
        : "";

      const tpl_data = {
        "id": data.id,
        "author": data.author,
        "score": data.score,
        "time": moment.unix(data.created_utc).format("llll"),
        "body": data.body,
        "postClass": data.id === highlight ? "post_highlight " + colorClass : "post " + colorClass
      };

      const commentDiv = document.createElement("div");
      commentDiv.innerHTML = getCompiledTemplate(subreddit.template.postCompiled, tpl_data);
      const commentElement = commentDiv.firstElementChild;
      
      // Render all children
      node.children.forEach(child => renderComment(child, commentElement));
      
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
    // Create a new URLSearchParams to modify without affecting the original
    const params = new URLSearchParams();
    
    // Copy all parameters except before/after which need special handling
    urlParams.forEach((value, key) => {
      if (key !== 'before' && key !== 'after') {
        params.append(key, value);
      }
    });

    // Handle before/after timestamps
    const before = urlParams.get('before');
    const after = urlParams.get('after');
    
    if (before) {
      // If it's already a Unix timestamp, use it as is
      const beforeTimestamp = /^\d{10}$/.test(before) ? before : Math.floor(before / 1000);
      params.append('before', beforeTimestamp);
    }
    
    if (after) {
      // If it's already a Unix timestamp, use it as is
      const afterTimestamp = /^\d{10}$/.test(after) ? after : Math.floor(after / 1000);
      params.append('after', afterTimestamp);
    }

    const url = this.link.commentSearch + "&" + params.toString();
    updateStatusLog(`Searching comments from Pullpush with params: ${params.toString()}`, "loading");
    axios
      .get(url)
      .then((e) => {
        subreddit.$el.innerHTML = "";
        const frag = document.createDocumentFragment();
        e.data.data.forEach((post) => {
          post.time = moment.unix(post.created_utc).format("llll");
          post.body = marked.parse(post.body);
          post.link_id = post.link_id.split("_").pop();
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = subreddit.template.profilePostCompiled(post);
          frag.appendChild(tempDiv.firstElementChild);
          subreddit.last = post;
        });
        subreddit.$el.appendChild(frag);
        updateStatusLog(`Done searching comments from Pullpush`, "success");
        addPaginationLinks({ data: e.data.data, urlParams, container: document.getElementById('paginate') });
      })
      .catch((e) => {
        updateStatusLog(`Error searching comments from Pullpush: ${e.message}`, "error");
      });
  },

  /**
   * Load comments backup from Pullpush API and render them.
   * @param {string} id
   * @param {string} highlight
   * @param {object} subreddit
   * @returns {Promise<void>}
   */
  async loadCommentsBackup(id, highlight, subreddit) {
    const url = this.link.commentSearch + "&link_id=" + id;
    updateStatusLog(`Grabbing comments backup from Pullpush for ID: ${id}`, "loading");
    try {
      const response = await axios.get(url);
      const comments = response.data.data;
      // Process comments in batches for better performance
      const processedComments = comments.map(comment => ({
        ...comment,
        time: moment.unix(comment.created_utc).format("llll"),
        body: marked.parse(comment.body)
      }));
      
      // Use batch processing
      const frag = document.createDocumentFragment();
      renderInBatches(processedComments, comment => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = getCompiledTemplate(subreddit.template.postCompiled, comment);
        frag.appendChild(tempDiv.firstElementChild);
      });
      subreddit.$el.appendChild(frag);
      if (highlight) {
        const highlighted = document.getElementById(highlight);
        if (highlighted) highlighted.scrollIntoView();
      }
      updateStatusLog(`Done grabbing comments backup from Pullpush for ID: ${id}`, "success");
    } catch (error) {
      updateStatusLog(`Error grabbing comments backup from Pullpush for ID: ${id}: ${error.message}`, "error");
    }
  },
};

function addPaginationLinks({ data, urlParams, container }) {
  if (!data || data.length === 0) return;
  const sortOrder = urlParams.get('sort') || 'desc';
  const sortType = urlParams.get('sort_type') || 'created_utc';
  
  // Next Page (Older/Younger Posts)
  const nextLink = document.createElement('a');
  nextLink.className = 'pagination-link';

  // Previous Page (Newer/Older Posts)
  const prevLink = document.createElement('a');
  prevLink.className = 'pagination-link';

  if (sortType === 'score') {
    // Score-based pagination
    const firstScore = data[0].score;
    const lastScore = data[data.length - 1].score;

    if (sortOrder === 'desc') {
      // Next: score<lastScore (lower scores)
      nextLink.textContent = '>>';
      const urlParamsNext = new URLSearchParams(window.location.search);
      urlParamsNext.set('score', `<${lastScore}`);
      nextLink.href = window.location.pathname + '?' + urlParamsNext.toString();
      // Previous: score>firstScore (higher scores)
      prevLink.textContent = '<<';
      const urlParamsPrev = new URLSearchParams(window.location.search);
      urlParamsPrev.set('score', `>${firstScore}`);
      prevLink.href = window.location.pathname + '?' + urlParamsPrev.toString();
    } else {
      // Next: score>lastScore (higher scores)
      nextLink.textContent = '>>';
      const urlParamsNext = new URLSearchParams(window.location.search);
      urlParamsNext.set('score', `>${lastScore}`);
      nextLink.href = window.location.pathname + '?' + urlParamsNext.toString();
      // Previous: score<firstScore (lower scores)
      prevLink.textContent = '<<';
      const urlParamsPrev = new URLSearchParams(window.location.search);
      urlParamsPrev.set('score', `<${firstScore}`);
      prevLink.href = window.location.pathname + '?' + urlParamsPrev.toString();
    }
  } else {
    // Time-based pagination
    const firstCreatedUtc = data[0].created_utc;
    const lastCreatedUtc = data[data.length - 1].created_utc;

    if (sortOrder === 'desc') {
      // Next: before=lastCreatedUtc (older)
      nextLink.textContent = '>>';
      const urlParamsNext = new URLSearchParams(window.location.search);
      urlParamsNext.set('before', lastCreatedUtc);
      nextLink.href = window.location.pathname + '?' + urlParamsNext.toString();
      // Previous: after=firstCreatedUtc (newer)
      prevLink.textContent = '<<';
      const urlParamsPrev = new URLSearchParams(window.location.search);
      urlParamsPrev.set('after', firstCreatedUtc);
      urlParamsPrev.delete('before');
      prevLink.href = window.location.pathname + '?' + urlParamsPrev.toString();
    } else {
      // Next: after=lastCreatedUtc (newer)
      nextLink.textContent = '>>';
      const urlParamsNext = new URLSearchParams(window.location.search);
      urlParamsNext.set('after', lastCreatedUtc);
      nextLink.href = window.location.pathname + '?' + urlParamsNext.toString();
      // Previous: before=firstCreatedUtc (older)
      prevLink.textContent = '<<';
      const urlParamsPrev = new URLSearchParams(window.location.search);
      urlParamsPrev.set('before', firstCreatedUtc);
      urlParamsPrev.delete('after');
      prevLink.href = window.location.pathname + '?' + urlParamsPrev.toString();
    }
  }
  // Clear container and center links
  container.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'pagination-container';
  wrapper.appendChild(prevLink);
  wrapper.appendChild(nextLink);
  container.appendChild(wrapper);
}

function normalize_url(url) {
  return url.replace(/&amp;/g, "&");
}

function set_thumbmail(sub) {
  const imagetypes = ["jpg", "png", "gif", "jpeg"];
  
  if (sub?.url && imagetypes.includes(sub.url.split(".").pop())) sub.thumbnail = normalize_url(sub.url);

  // If preview exists, collect all images[].source.url into sub.previews
  if (sub.preview && Array.isArray(sub.preview.images)) {
    sub.previews = sub.preview.images.map(img => img.source && normalize_url(img.source.url)).filter(Boolean);
  }
  // If media_metadata exists, add all s.u from each image to sub.previews
  if (sub.media_metadata && typeof sub.media_metadata === 'object') {
    if (!sub.previews) sub.previews = [];
    Object.values(sub.media_metadata).forEach(meta => {
      if (meta && meta.s && meta.s.u) {
        sub.previews.push(normalize_url(meta.s.u));
      }
    });
  }
}

export { pullpush };
