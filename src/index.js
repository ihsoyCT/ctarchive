import { subreddit } from './subreddit';

window.onload = () => {
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);
  console.log(urlParams);
  if (urlParams.get('subreddit') !== null) {
    populateForm(urlParams);
    subreddit.grabSubmissions(urlParams);
  } else if (urlParams.get('comments') !== null) {
    subreddit.grabComments(urlParams.get('comments'));
  }
  document.getElementById('content').appendChild(subreddit.$el);
};

function populateForm(urlParams) {
  urlParams.forEach((p, k) => {
    console.log(k + ' => ' + p);
    document.getElementById(k).value = p;
  });
}
