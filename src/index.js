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
  urlParams.delete("backend");
  if (backend === "pushpull") {
    subreddit.backend = Backends.PUSHPULL;
  } else if (backend === "artic_shift") {
    subreddit.backend = Backends.ARTIC_SHIFT;
  }

  if (!urlParams.has("limit")) urlParams.set("limit", 100);
  console.log("URL Params: ", urlParams.toString());
  
  subreddit.onModeChange("submissions");
  const mode = urlParams.get("mode");
  if (mode === "comments") {
    populateForm(urlParams);
    urlParams.delete("mode");
    subreddit.searchComments(urlParams);
    subreddit.onModeChange("comments");
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
  window.showImages = (localStorage.getItem('showImages') === 'true');
  if (toggleCheckbox && toggleLabel) {
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

window.onModeChange = (e) => subreddit.onModeChange(e);

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
  // Collect current form values
  const form = document.getElementById('search_form');
  const values = {};
  if (form) {
    Array.from(form.elements).forEach(el => {
      if (el.name && (el.type !== 'submit' && el.type !== 'button')) {
        values[el.name] = el.value;
      }
    });
  }

  // Field mapping and conversion
  let mappedValues = { ...values };
  if (newBackend === "pushpull") {
    // Arctic Shift -> PushPull: query/body -> q, limit 'auto' -> 1000
    if (mappedValues.query !== undefined && mappedValues.query !== "") {
      mappedValues.q = mappedValues.query;
      delete mappedValues.query;
    } else if (mappedValues.body !== undefined && mappedValues.body !== "") {
      mappedValues.q = mappedValues.body;
      delete mappedValues.body;
    }
    if (mappedValues.limit === "auto") {
      mappedValues.limit = "1000";
    }
  } else if (newBackend === "artic_shift") {
    // PushPull -> Arctic Shift: q -> query and body
    if (mappedValues.q !== undefined) {
      mappedValues.query = mappedValues.q;
      mappedValues.body = mappedValues.q;
      delete mappedValues.q;
    }
  }

  renderSearchForm(newBackend);
  const backendSelector = document.getElementById("backend");
  if (backendSelector) backendSelector.value = newBackend;
  // Repopulate values for fields that exist in the new form
  const newForm = document.getElementById('search_form');
  if (newForm) {
    Object.entries(mappedValues).forEach(([name, value]) => {
      const el = newForm.elements.namedItem(name);
      if (el && typeof el.value !== 'undefined') el.value = value;
    });
    // Call onModeChange with the value of the mode select if it exists
    const modeSelect = newForm.elements.namedItem('mode');
    if (modeSelect) {
      window.onModeChange(modeSelect.value);
    }
  }
};

function updateArcticShiftFieldState() {
  // Find all fields with data-required
  const requiredFields = document.querySelectorAll('[data-required]');
  requiredFields.forEach(function (el) {
    const requiredList = (el.getAttribute('data-required') || '').split(',').map(s => s.trim()).filter(Boolean);
    let enable = false;
    for (const reqId of requiredList) {
      const reqEl = document.getElementById(reqId);
      if (reqEl && reqEl.value && reqEl.value.length > 0) {
        enable = true;
        break;
      }
    }
    el.disabled = !enable;
    if (!enable) {
      el.classList.add('disabled-field');
      el.setAttribute('title', 'Disabled: requires ' + requiredList.join(' or '));
      if (el.placeholder !== undefined) el.placeholder = 'Disabled: requires ' + requiredList.join(' or ');
    } else {
      el.classList.remove('disabled-field');
      el.removeAttribute('title');
      if (el.placeholder !== undefined) el.placeholder = '';
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
