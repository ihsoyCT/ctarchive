import { subreddit, Backends } from "./subreddit";

window.onload = () => {
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);

  console.log(urlParams);
  const mode = urlParams.get("mode");
  const backend = urlParams.get("backend");
  urlParams.delete("backend");
  
  if(backend == "pushpull") {
    subreddit.backend = Backends.PUSHPULL
  } else if (backend == "artic_shift") {
    subreddit.backend = Backends.ARTIC_SHIFT

    const selectElement = document.getElementById('sort_type');
    for (let i = 0; i < selectElement.options.length; i++) {
      let option = selectElement.options[i];
      // Check if the option's value is not "Time"
      if (option.value !== 'Time') {
          // Disable the option
          option.disabled = true;
      }
  }
  } else {
    console.log("Invalid Backend")
  }

  if (!urlParams.has("limit")) urlParams.set("limit", 100);

  if (mode === "comments") {
    populateForm(urlParams);
    urlParams.delete("mode");
    subreddit.searchComments(urlParams);
  } else if (urlParams.get("comments") !== null) {
    subreddit.grabComments(urlParams.get("comments"), urlParams.get("id"));
  } else if (urlParams.has("subreddit")) {
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
