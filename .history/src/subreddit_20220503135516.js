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
      "https://api.pushshift.io/reddit/comment/search?fields=id,author,parent_id,score,body,created_utc,link_id,permalink&limit=1000&q=*&link_id=",
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
    axios
      .get(subreddit.link.submission + "&" + request)
      .then((e) => {
        subreddit.$el.innerHTML = "";
        e.data.data.forEach((sub) => {
          sub.time = moment.unix(sub.created_utc).format("llll");
          const imagetypes = ["jpg", "png", "gif"];
          if (imagetypes.includes(sub.url.split(".").pop()))
            sub.thumbnail = sub.url;
          subreddit.$el.innerHTML += subreddit.template.submissionCompiled(sub);
          subreddit.last = sub;
        });
      })
      .catch(subreddit.error);
  },
  grabComments(id, highlight) {
    axios
      .get(subreddit.link.commentsID + id)
      .then((ids) => {
        ids = ids.data.data;
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

                  document.getElementById(highlight).scrollIntoView();
                });
              });
            })
            .catch(subreddit.error);
        } else {
          console.log(id);
          console.log("backup");
          let done = false;
            axios
              .get(subreddit.link.commentsBackup + id + "&limit=1000")
              .then((s) => {
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
                });
                document.getElementById(highlight).scrollIntoView();
              })
              .catch(subreddit.error);
          }
          done = true;
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
};
