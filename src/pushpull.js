import { updateStatusLog } from "./subreddit";
const axios = require("axios").default;
const moment = require("moment");
const marked = require("marked");

const pushpull = {
  link: {
    submission: "https://api.pullpush.io/reddit/search/submission/?test",
    commentSearch: "https://api.pullpush.io/reddit/search/comment/?test",
  },

  get_submissions(urlParams, subreddit) {
    const request = subreddit.createRequest(urlParams);
    const url = this.link.submission + "&" + request;
    updateStatusLog(`Grabbing Submissions from PushPull with params: ${urlParams.toString()}`, "loading");
    axios
      .get(url)
      .then((e) => {
        subreddit.$el.innerHTML = "";
        e.data.data.forEach((sub) => {
          sub.time = moment.unix(sub.created_utc).format("llll");
          const imagetypes = ["jpg", "png", "gif"];
          if (imagetypes.includes(sub.url.split(".").pop())) sub.thumbnail = sub.url;
          subreddit.$el.innerHTML += subreddit.template.submissionCompiled(sub);
          subreddit.last = sub;
        });
        updateStatusLog(`Done grabbing submissions from PushPull`, "success");
      })
      .catch((e) => {
        updateStatusLog(`Error grabbing submissions from PushPull: ${e.message}`, "error");
        console.log(e);
      });
  },

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

  search_comments(urlParams, subreddit) {
    const request = subreddit.createRequest(urlParams);
    const url = this.link.commentSearch + "&" + request;
    updateStatusLog(`Searching comments from PushPull with params: ${urlParams.toString()}`, "loading");
    axios
      .get(url)
      .then((e) => {
        subreddit.$el.innerHTML = "";
        e.data.data.forEach((post) => {
          post.time = moment.unix(post.created_utc).format("llll");
          post.body = marked.parse(post.body);
          post.link_id = post.link_id.split("_").pop();
          subreddit.$el.innerHTML += subreddit.template.profilePostCompiled(post);
          subreddit.last = post;
        });
        updateStatusLog(`Done searching comments from PushPull`, "success");
      })
      .catch((e) => {
        updateStatusLog(`Error searching comments from PushPull: ${e.message}`, "error");
        subreddit.error && subreddit.error(e);
      });
  },

  loadCommentsBackup(id, highlight, subreddit) {
    const url = this.link.commentSearch + "&ids=" + id;
    updateStatusLog(`Grabbing comments backup from PushPull for ID: ${id}`, "loading");
    return axios
      .get(url)
      .then((response) => {
        const comments = response.data.data;
        comments.forEach((comment) => {
          comment.time = moment.unix(comment.created_utc).format("llll");
          comment.body = marked.parse(comment.body);
          subreddit.$el.innerHTML += subreddit.template.commentCompiled(comment);
        });
        if (highlight) {
          const highlighted = document.getElementById(highlight);
          if (highlighted) highlighted.scrollIntoView();
        }
        updateStatusLog(`Done grabbing comments backup from PushPull for ID: ${id}`, "success");
      })
      .catch((error) => {
        updateStatusLog(`Error grabbing comments backup from PushPull for ID: ${id}: ${error.message}`, "error");
        console.error("Error loading comments backup:", error);
      });
  },
};

export { pushpull };
