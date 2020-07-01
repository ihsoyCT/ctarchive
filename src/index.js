const axios = require('axios').default;

const submission_link =
  'https://api.pushshift.io/reddit/search/submission?subreddit=cumtown&size=500&sort_type=created_utc&fields=author,num_comments,id,score,created_utc,title,url&before=';

const comment_id_link = 'https://api.pushshift.io/reddit/submission/comment_ids/';
const comments_by_ids =
  'https://api.pushshift.io/reddit/search/comment/?fields=id,author,parent_id,score,body&ids=';

const submissionCompiled = require('./templates/submission.pug');
const postCompiled = require('./templates/post.pug');

let timestamp = Math.floor(Date.now() / 1000);

function grabSubmissions(before) {
  axios.get(submission_link + before).then((e) => {
    document.getElementById('submissions').innerHTML = '';
    e.data.data.forEach((sub) => {
      document.getElementById('submissions').innerHTML += submissionCompiled(sub);
      timestamp = sub.created_utc;
    });
  });

  document.body.onclick = function (e) {
    e = e.target;
    if (e.className === 'submissionclass') {
      document.getElementById('submissions').style.display = 'none';
      console.log(e);
      const id = e.dataset.id;
      document.getElementById('posts').innerHTML = 'Loading Comments - Please Wait';
      console.log('loading comments for: ' + e.dataset.id);
      console.log(comment_id_link + id);
      axios.get(comment_id_link + id).then((ids) => {
        ids = ids.data.data;
        id_splice = [];
        console.log(Math.ceil(ids.length / 500));
        while (ids.length > 0) {
          id_splice.push(ids.splice(0, 500));
        }
        requests = [];
        id_splice.forEach((splice) => {
          console.log(comments_by_ids + splice.join(','));
          requests.push(axios.get(comments_by_ids + splice.join(',')));
        });
        axios.all(requests).then((p) => {
          document.getElementById('posts').innerHTML = '<div id="t3_' + id + '"></div>';
          p.forEach((pS) => {
            pS = pS.data.data;
            pS.forEach((post) => {
              document.getElementById(post.parent_id).innerHTML += postCompiled(post);
            });
          });
        });
      });
    }
  };
}

window.onload = () => {
  grabSubmissions(timestamp);
};

document.getElementById('back').onclick = () => {
  document.getElementById('submissions').style.display = 'block';
  document.getElementById('posts').innerHTML = '';
};

document.getElementById('next').onclick = () => {
  document.getElementById('submissions').style.display = 'block';
  document.getElementById('submissions').innerHTML = 'Loading more submissions - Please Wait';
  document.getElementById('posts').innerHTML = '';
  grabSubmissions(timestamp);
};
