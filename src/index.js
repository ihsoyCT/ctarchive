import { subreddit, Backends } from "./subreddit";
import pushpullSearchTemplate from "./templates/pushpull_search.pug";
import arcticShiftSearchTemplate from "./templates/arctic_shift_search.pug";

/**
 * Render the search form for the selected backend.
 * @param {string} backend
 */
function renderSearchForm(backend) {
  const searchformDiv = document.getElementById("searchform");
  if (backend === "pushpull") {
    searchformDiv.innerHTML = pushpullSearchTemplate();
  } else if (backend === "artic_shift") {
    searchformDiv.innerHTML = arcticShiftSearchTemplate();
    setTimeout(() => {
      if (window.onArcticShiftFormChanged) window.onArcticShiftFormChanged();
    }, 0);
  } else {
    searchformDiv.innerHTML = "";
  }
}

window.onload = () => {
  console.log("Page loaded");
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);
  let backend = urlParams.get("backend") || "artic_shift";
  renderSearchForm(backend);
  const backendSelector = document.getElementById("backend");
  if (backendSelector) {
    backendSelector.value = backend;
    backendSelector.addEventListener("change", (e) => {
      renderSearchForm(e.target.value);
    });
  }
  urlParams.delete("backend");
  const mode = urlParams.get("mode");
  if (backend === "pushpull") {
    subreddit.backend = Backends.PUSHPULL;
  } else if (backend === "artic_shift") {
    subreddit.backend = Backends.ARTIC_SHIFT;
  }

  if (!urlParams.has("limit")) urlParams.set("limit", 100);

  console.log("URL Params: ", urlParams.toString());
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

  // Show Images toggle logic (toggle switch)
  const toggleCheckbox = document.getElementById('toggle-images-checkbox');
  const toggleLabel = document.getElementById('toggle-images-label');
  if (toggleCheckbox && toggleLabel) {
    let showImages = localStorage.getItem('showImages');
    if (showImages === null) showImages = 'false';
    window.showImages = showImages === 'true';
    toggleCheckbox.checked = window.showImages;
    toggleLabel.textContent = window.showImages ? 'Hide Images' : 'Show Images';
    toggleCheckbox.onchange = function() {
      window.showImages = toggleCheckbox.checked;
      localStorage.setItem('showImages', window.showImages);
      toggleLabel.textContent = window.showImages ? 'Hide Images' : 'Show Images';
      window.location.reload();
    };
  } else {
    window.showImages = true;
  }
};

/**
 * Populate form fields from URLSearchParams.
 * @param {URLSearchParams} urlParams
 */
function populateForm(urlParams) {
  urlParams.forEach((p, k) => {
    const el = document.getElementById(k);
    if (el && typeof el.value !== 'undefined') el.value = p;
  });
}

window.switchBackend = function (newBackend) {
  if (newBackend === "arctic_shift" && window.onArcticShiftFormChanged) {
    window.onArcticShiftFormChanged();
  }
  renderSearchForm(newBackend);
  const backendSelector = document.getElementById("backend");
  if (backendSelector) backendSelector.value = newBackend;
};

function updateArcticShiftFieldState() {
  const author = document.getElementById('author');
  const subreddit = document.getElementById('subreddit');
  const disable = (!author || !subreddit || (!author.value && !subreddit.value));
  const reason = 'Disabled: requires author or subreddit';
  ['title', 'selftext', 'query', 'url', 'link_flair_text', 'author_flair_text'].forEach(function (id) {
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
    }
  });
}

function setupArcticShiftFieldState() {
  const author = document.getElementById('author');
  const subreddit = document.getElementById('subreddit');
  if (author) author.addEventListener('input', updateArcticShiftFieldState);
  if (subreddit) subreddit.addEventListener('input', updateArcticShiftFieldState);
  updateArcticShiftFieldState();
}

window.onArcticShiftFormChanged = () => {
  setupArcticShiftFieldState();
}
