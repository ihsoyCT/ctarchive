const axios = require("axios").default;
const moment = require("moment");
const marked = require("marked");

export const subreddit = {
  link: {
    submission:
      "https://api.pushshift.io/reddit/search/submission?fields=author,num_comments,id,subreddit,score,created_utc,title,url,thumbnail,selftext,id",
    commentsID: "https://api.pushshift.io/reddit/submission/comment_ids/",
    comments:
      "https://api.pushshift.io/reddit/search/comment/?fields=id,author,parent_id,score,body,created_utc&ids=",
    commentSearch:
      "https://api.pushshift.io/reddit/search/comment/?fields=id,author,parent_id,score,body,created_utc,link_id,permalink",
    commentsBackup:
      "https://api.pushshift.io/reddit/comment/search?fields=id,author,parent_id,score,body,created_utc,link_id,permalink&sort_type=created_utc&sort=asc&limit=1000&q=*&link_id=",
  },
  template: {
    submissionCompiled: require("./templates/submission.pug"),
    postCompiled: require("./templates/post.pug"),
    profilePostCompiled: require("./templates/profilePost.pug"),
  },
  $el: (() => {
    const a = document.createElement("div");
    a.id = "submission";
    a.innerHTML = "Loading Submission/Comments";
    return a;
  })(),
  changeStatus(status) {
    document.getElementById("status").innerHTML = status;
  },
  last: null,
  createRequest(urlParams) {
    let query = [];
    urlParams.forEach((p, k) => {
      if (p !== "" && k !== "mode") query.push(k + "=" + p);
    });
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
            if (imagetypes.includes(sub.url.split(".").pop()))
              sub.thumbnail = sub.url;
            subreddit.$el.innerHTML +=
              subreddit.template.submissionCompiled(sub);
            subreddit.last = sub;
          })
          .then(() => {
            subreddit.changeStatus("Submissions Loaded");
          });
      })
      .catch((e) => {
        subreddit.changeStatus("Error Loading Submissions");
      });
  },
  grabComments(id, highlight) {
    subreddit.changeStatus("Loading Comments");
    axios
      .get(subreddit.link.commentsID + id)
      .then((ids) => {
        ids = ids.data.data;
        console.log("ids", ids);
        if (ids.length !== 0) {
          let id_splice = [];
          let requests = [];
          console.log(Math.ceil(ids.length / 500));
          while (ids.length > 0) {
            id_splice.push(ids.splice(0, 500));
          }
          requests = [];
          id_splice.forEach((splice) => {
            requests.push(
              axios.get(subreddit.link.comments + splice.join(","))
            );
          });
          axios
            .get(subreddit.link.submission + "&ids=" + id)
            .then((s) => {
              console.log(s);
              s.data.data[0].time = moment
                .unix(s.data.data[0].created_utc)
                .format("llll");
              subreddit.$el.innerHTML = subreddit.template.submissionCompiled(
                s.data.data[0]
              );
              axios.all(requests).then((p) => {
                p.forEach((pS) => {
                  pS = pS.data.data;
                  pS.forEach((post) => {
                    post.time = moment.unix(post.created_utc).format("llll");
                    if (post.id === highlight) {
                      post.postClass = "post_highlight";
                    } else {
                      post.postClass = "post";
                    }
                    if (document.getElementById(post.parent_id)) {
                      document.getElementById(post.parent_id).innerHTML +=
                        subreddit.template.postCompiled(post);
                    } else {
                      document.getElementById("orphans").innerHTML +=
                        subreddit.template.postCompiled(post);
                    }
                  });

                  if (highlight !== null)
                    document.getElementById(highlight).scrollIntoView();
                });
              });
            })
            .catch((e) => {
              subreddit.changeStatus("Error Loading Comments");
            });
        } else {
          console.log(id);
          console.log("backup");
          subreddit.changeStatus("Loading Comments (Backup)");
          axios
            .get(subreddit.link.submission + "&ids=" + id)
            .then((s) => {
              console.log(s);
              s.data.data[0].time = moment
                .unix(s.data.data[0].created_utc)
                .format("llll");
              subreddit.$el.innerHTML = subreddit.template.submissionCompiled(
                s.data.data[0]
              );
            })
            .then(() => {
              subreddit.loadCommentsBackup(id, highlight);
            });
        }
      })
      .catch(subreddit.error);
  },
  searchComments(urlParams) {
    const request = subreddit.createRequest(urlParams);
    axios
      .get(subreddit.link.commentSearch + "&" + request)
      .then((e) => {
        subreddit.$el.innerHTML = "";
        e.data.data.forEach((post) => {
          post.time = moment.unix(post.created_utc).format("llll");
          post.body = marked(post.body);
          post.link_id = post.link_id.split("_").pop();
          subreddit.$el.innerHTML +=
            subreddit.template.profilePostCompiled(post);
          subreddit.last = post;
        });
      })
      .catch(subreddit.error);
  },
  async loadCommentsBackup(id, highlight, created_utc = null) {
    let url = subreddit.link.commentsBackup + id;
    if (created_utc !== null) {
      url += "&after=" + created_utc;
    }
    axios
      .get(url)
      .then((s) => {
        console.log(s.data.data);
        let last = null;
        s.data.data.forEach((post) => {
          post.time = moment.unix(post.created_utc).format("llll");
          if (post.id === highlight) {
            post.postClass = "post_highlight";
          } else {
            post.postClass = "post";
          }
          if (document.getElementById(post.parent_id)) {
            document.getElementById(post.parent_id).innerHTML +=
              subreddit.template.postCompiled(post);
          } else {
            document.getElementById("orphans").innerHTML +=
              subreddit.template.postCompiled(post);
          }
          last = post;
        });
        console.log("LAST", last);
        if (last !== null) {
          subreddit.loadCommentsBackup(id, highlight, last.created_utc);
        }
        if (highlight !== null)
          document.getElementById(highlight).scrollIntoView();
      })
      .catch(subreddit.error);
  },
};