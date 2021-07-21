import { subreddit } from "./subreddit";

window.onload = () => {
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);

  console.log(urlParams);
  const mode = urlParams.get("mode");
  
  if(!urlParams.has(size)) urlParams.set("size", 100);

  if (mode === "comments") {
    populateForm(urlParams);
    urlParams.delete("mode");
    subreddit.searchComments(urlParams);
  } else if (urlParams.get("comments") !== null) {
    subreddit.grabComments(urlParams.get("comments"), urlParams.get("id"));
  } else if (urlParams.has(subreddit)) {
    populateForm(urlParams);
    urlParams.delete("mode");
    subreddit.grabSubmissions(urlParams);
  }  

  document.getElementById("content").appendChild(subreddit.$el);
};

function populateForm(urlParams) {
  urlParams.forEach((p, k) => {
    console.log(k + " => " + p);
    document.getElementById(k).value = p;
  });
}
