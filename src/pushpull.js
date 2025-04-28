import { updateStatusLog } from "./subreddit";
const axios = require("axios").default;
const moment = require("moment");
const marked = require("marked");

/**
 * PushPull backend logic for Reddit archive search.
 * @namespace pushpull
 */
const pushpull = {
  link: {
    submission: "https://api.pullpush.io/reddit/search/submission/?test",
    commentSearch: "https://api.pullpush.io/reddit/search/comment/?test",
  },

  /**
   * Fetch submissions from PushPull API and render them.
   * @param {URLSearchParams} urlParams
   * @param {object} subreddit
   */
  get_submissions(urlParams, subreddit) {
    const request = subreddit.createRequest(urlParams);
    const url = this.link.submission + "&" + request;
    updateStatusLog(`Grabbing Submissions from PushPull with params: ${urlParams.toString()}`, "loading");
    axios
      .get(url)
      .then((e) => {
        subreddit.$el.innerHTML = "";
        const frag = document.createDocumentFragment();
        e.data.data.forEach((sub) => {
          sub.time = moment.unix(sub.created_utc).format("llll");
          const imagetypes = ["jpg", "png", "gif"];
          if (imagetypes.includes(sub.url.split(".").pop())) sub.thumbnail = sub.url;
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = subreddit.template.submissionCompiled(sub);
          frag.appendChild(tempDiv.firstElementChild);
          subreddit.last = sub;
        });
        subreddit.$el.appendChild(frag);
        updateStatusLog(`Done grabbing submissions from PushPull`, "success");
      })
      .catch((e) => {
        updateStatusLog(`Error grabbing submissions from PushPull: ${e.message}`, "error");
      });
  },

  /**
   * Fetch a submission and its comments by ID from PushPull API.
   * @param {string} id
   * @param {string} highlight
   * @param {object} subreddit
   */
  grab_comments(id, highlight, subreddit) {
    subreddit.changeStatus("Loading Comments");
    subreddit.set_reddit_link(id);
    subreddit.$el.innerHTML = "";
    const url = this.link.submission + "&ids=" + id;
    updateStatusLog(`Grabbing Submission by ID from PushPull: ${id}`, "loading");
    axios
      .get(url)
      .then((s) => {
        s.data.data[0].time = moment.unix(s.data.data[0].created_utc).format("llll");
        s.data.data[0].selftext = marked.parse(s.data.data[0].selftext);
        subreddit.$el.innerHTML = subreddit.template.submissionCompiled(s.data.data[0]);
        updateStatusLog(`Done grabbing submission by ID from PushPull`, "success");
      })
      .then(() => {
        subreddit.changeStatus("Submission Loaded");
      })
      .catch((e) => {
        updateStatusLog(`Error grabbing submission by ID from PushPull: ${e.message}`, "error");
      });

    this.loadCommentsBackup(id, highlight, subreddit).then(() => {
      subreddit.changeStatus("Comments Loaded");
    });
  },

  /**
   * Search comments from PushPull API and render them.
   * @param {URLSearchParams} urlParams
   * @param {object} subreddit
   */
  search_comments(urlParams, subreddit) {
    const request = subreddit.createRequest(urlParams);
    const url = this.link.commentSearch + "&" + request;
    updateStatusLog(`Searching comments from PushPull with params: ${urlParams.toString()}`, "loading");
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
        updateStatusLog(`Done searching comments from PushPull`, "success");
      })
      .catch((e) => {
        updateStatusLog(`Error searching comments from PushPull: ${e.message}`, "error");
        subreddit.error && subreddit.error(e);
      });
  },

  /**
   * Load comments backup from PushPull API and render them.
   * @param {string} id
   * @param {string} highlight
   * @param {object} subreddit
   * @returns {Promise<void>}
   */
  async loadCommentsBackup(id, highlight, subreddit) {
    const url = this.link.commentSearch + "&ids=" + id;
    updateStatusLog(`Grabbing comments backup from PushPull for ID: ${id}`, "loading");
    try {
      const response = await axios.get(url);
      const comments = response.data.data;
      const frag = document.createDocumentFragment();
      comments.forEach((comment) => {
        comment.time = moment.unix(comment.created_utc).format("llll");
        comment.body = marked.parse(comment.body);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = subreddit.template.commentCompiled(comment);
        frag.appendChild(tempDiv.firstElementChild);
      });
      subreddit.$el.appendChild(frag);
      if (highlight) {
        const highlighted = document.getElementById(highlight);
        if (highlighted) highlighted.scrollIntoView();
      }
      updateStatusLog(`Done grabbing comments backup from PushPull for ID: ${id}`, "success");
    } catch (error) {
      updateStatusLog(`Error grabbing comments backup from PushPull for ID: ${id}: ${error.message}`, "error");
    }
  },
};

export { pushpull };
