const axios = require("axios").default;
const moment = require("moment");
const marked = require("marked");

function base10to36(number) {
  return parseInt(number).toString(36);
}

export const subreddit = {
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
    document.getElementById("status").innerHTML = status;
  },
  last: null,
  useOld: false,
  createRequest(urlParams) {
    let query = [];
    urlParams.forEach((p, k) => {
      if ((k === "since" || k === "until"|| k === "before" || k === "after") && p !== "") {
        p = Math.floor(new Date(p).getTime() / 1000);
      }
      if (p !== "" && k !== "mode") query.push(k + "=" + p);
    });
    console.log("AAAA", query);
    return query.join("&");
  },
  grabSubmissions(urlParams) {
    const request = subreddit.createRequest(urlParams);
    subreddit.changeStatus("Loading Submissions");
    axios
      .get(subreddit.link.submission + "&" + request)
      .then((e) => {
        subreddit.$el.innerHTML = "";
        e.data.data
          .forEach((sub) => {
            sub.time = moment.unix(sub.created_utc).format("llll");
            const imagetypes = ["jpg", "png", "gif"];
            if (imagetypes.includes(sub.url.split(".").pop())) sub.thumbnail = sub.url;
            subreddit.$el.innerHTML += subreddit.template.submissionCompiled(sub);
            subreddit.last = sub;
          })
          .then(() => {
            subreddit.changeStatus("Submissions Loaded");
          });
      })
      .catch((e) => {
        console.log(e);
        subreddit.changeStatus("Error Loading Submissions");
      });
  },
  grabComments(id, highlight) {
    subreddit.changeStatus("Loading Comments");
    console.log(id);
    console.log("backup");
    subreddit.changeStatus("Loading Comments (Backup)");
    subreddit.set_reddit_link(id);
    subreddit.$el.innerHTML = "";
    axios
      .get(subreddit.link.submission + "&ids=" + id)
      .then((s) => {
        console.log(s);
        s.data.data[0].time = moment.unix(s.data.data[0].created_utc).format("llll");
        s.data.data[0].selftext = marked.parse(s.data.data[0].selftext);
        subreddit.$el.innerHTML = subreddit.template.submissionCompiled(s.data.data[0]);
      })
      .then(() => {
        subreddit.changeStatus("Submission Loaded");
      });

    subreddit.loadCommentsBackup(id, highlight).then(() => {
      subreddit.changeStatus("Comments Loaded");
    });
  },
  sleep(ms) {
    subreddit.changeStatus("Waiting for:" + ms + "ms");
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
  searchComments(urlParams) {
    const request = subreddit.createRequest(urlParams);
    axios
      .get(subreddit.link.commentSearch + "&" + request)
      .then((e) => {
        subreddit.$el.innerHTML = "";
        e.data.data.forEach((post) => {
          post.time = moment.unix(post.created_utc).format("llll");
          post.body = marked.parse(post.body);
          post.link_id = post.link_id.split("_").pop();
          subreddit.$el.innerHTML += subreddit.template.profilePostCompiled(post);
          subreddit.last = post;
        });
      })
      .catch(subreddit.error);
  },
  async loadCommentsBackup(id, highlight, created_utc = null) {
    subreddit.changeStatus("Loading Comments (Backup)");
    let url = subreddit.link.commentsBackup + id;
    if (created_utc !== null) {
      url += "&after=" + (created_utc + 1);
    }
    if (subreddit.requestCount > 10) {
      subreddit.requestCount = 0;
      console.log("Waiting");
      await subreddit.sleep(10000);
    }
    axios
      .get(url)
      .then((s) => {
        subreddit.requestCount++;
        console.log(s.data.data);
        let last = null;
        s.data.data.forEach((post) => {
          post.time = moment.unix(post.created_utc).format("llll");
          if (post.id === highlight) {
            post.postClass = "post_highlight";
          } else {
            post.postClass = "post";
          }
          post.body = marked.parse(post.body);
          switch (typeof post.parent_id) {
            case "undefined":
              post.parent_id = "t3_" + id;
              break;
            case "number":
              post.parent_id = "t1_" + base10to36(post.parent_id);
          }
          if (document.getElementById(post.parent_id)) {
            document.getElementById(post.parent_id).innerHTML += subreddit.template.postCompiled(post);
          } else if (post.parent_id == null) {
            document.getElementById("comments_fix").innerHTML += subreddit.template.postCompiled(post);
          } else {
            post.postClass = "orphan";
            document.getElementById("orphans").innerHTML += subreddit.template.postCompiled(post);
          }
          last = post;
        });
        console.log("LAST", last);
        if (last !== null && last.created_utc != created_utc) {
          subreddit.loadCommentsBackup(id, highlight, last.created_utc);
        } else {
          subreddit.changeStatus("Comments Loaded");
        }
        if (highlight !== null) document.getElementById(highlight).scrollIntoView();
      })
      .catch(() => {
        subreddit.changeStatus("Error, most likely too many requests. Try again later");
      });
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
