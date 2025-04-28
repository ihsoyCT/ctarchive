import { subreddit, Backends } from "./subreddit";
import pushpullSearchTemplate from "./templates/pushpull_search.pug";
import arcticShiftSearchTemplate from "./templates/arctic_shift_search.pug";

function renderSearchForm(backend) {
  const searchformDiv = document.getElementById("searchform");
  if (backend === "pushpull") {
    searchformDiv.innerHTML = pushpullSearchTemplate();
  } else if (backend === "artic_shift") {
    searchformDiv.innerHTML = arcticShiftSearchTemplate();
    // Call disabling logic immediately after rendering
    setTimeout(() => {
      if (window.onArcticShiftFormChanged) window.onArcticShiftFormChanged();
    }, 0);
  } else {
    searchformDiv.innerHTML = "";
  }
}

function arcticShiftPaginate(urlParams) {
  // Re-run the search with updated urlParams
  const { artic_shift } = require('./artic_shift');
  artic_shift.get_submissions(urlParams, subreddit, arcticShiftPaginate);
}

window.onload = () => {
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);


  let backend = urlParams.get("backend");
  if (!backend) {
    backend = "artic_shift";
  }

  console.log("Backend: " + backend);
  renderSearchForm(backend);

  const backendSelector = document.getElementById("backend");
  console.log(backendSelector);
  backendSelector.addEventListener("change", (e) => {
    console.log("Backend changed to: " + e.target.value);
    renderSearchForm(e.target.value);
  });

  console.log(urlParams);
  const mode = urlParams.get("mode");
  // set the input value of the backend input to the backend value
  if (backend) {
    backendSelector.value = backend;
  }
  urlParams.delete("backend");


  if (backend == "pushpull") {
    subreddit.backend = Backends.PUSHPULL
  } else if (backend == "artic_shift") {
    subreddit.backend = Backends.ARTIC_SHIFT
    // Initial search with pagination support
    arcticShiftPaginate(urlParams);
    return;
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
    const el = document.getElementById(k);
    if (el) el.value = p;
  });
}

window.switchBackend = function (newBackend) {
  if(newBackend === "arctic_shift") {
    window.onArcticShiftFormChanged()
  }
  renderSearchForm(newBackend);
  const backendSelector = document.getElementById("backend");
  if (backendSelector) backendSelector.value = newBackend;
  // Optionally, update state or trigger other logic here
};

function updateArcticShiftFieldState() {
  console.log('[DEBUG] updateArcticShiftFieldState called');
  const author = document.getElementById('author');
  const subreddit = document.getElementById('subreddit');
  const disable = (!author || !subreddit || (!author.value && !subreddit.value));
  const reason = 'Disabled: requires author or subreddit';
  ['title', 'selftext', 'query', 'url'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = disable;
      if (disable) {
        el.classList.add('disabled-field');
        el.setAttribute('title', reason);
        el.placeholder = reason;
      } else {
        el.classList.remove('disabled-field');
        el.removeAttribute('title');
        el.placeholder = '';
      }
      console.log('[DEBUG] field', id, 'set disabled:', disable);
    } else {
      console.log('[DEBUG] field', id, 'not found');
    }
  });
}

function setupArcticShiftFieldState() {
  console.log('[DEBUG] setupArcticShiftFieldState called');
  const author = document.getElementById('author');
  const subreddit = document.getElementById('subreddit');
  if (author) author.addEventListener('input', updateArcticShiftFieldState);
  if (subreddit) subreddit.addEventListener('input', updateArcticShiftFieldState);
  updateArcticShiftFieldState();
}

window.onArcticShiftFormChanged = () => {
  console.log('[DEBUG] onArcticShiftFormChanged called');
  setupArcticShiftFieldState();
}
