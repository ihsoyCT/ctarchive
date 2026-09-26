/**
 * Previous/next paging for result lists sorted by a numeric field
 * (created_utc, or score/num_comments on Pullpush).
 *
 * The page position lives in its own URL parameter, cursor=<N or cursor=>N,
 * so it never mixes with the before/after/score filters from the search form.
 *
 * The archive APIs filter exclusively (before=T returns items older than T),
 * so paging from the last item's value would drop other items with the same
 * value. The cursor therefore includes the boundary value, and the ids already
 * shown with it go into skip=, which withoutSkipped() removes.
 *
 * Previous pages (page=prev) are fetched in the opposite sort order from the
 * cursor and reversed for display; with a newest-first sort, after=T alone
 * would return the newest items overall rather than the ones right before T.
 */

function skipIds(urlParams) {
  return (urlParams.get("skip") || "").split(",").filter(Boolean);
}

/**
 * The query to send to the API for the page described by urlParams.
 * The cursor replaces the form filter on the same side: results already
 * respected that filter, so the cursor is always at least as tight.
 * @param {URLSearchParams} urlParams
 * @param {object} opts
 * @param {number} opts.maxLimit the API's maximum page size
 * @param {string} [opts.sortKey="created_utc"]
 * @returns {{sort: string, limit: ?string, before: ?string, after: ?string, sortFilter: ?string}}
 *   sortFilter is the "<N"/">N" filter for a non-time sortKey, if paging
 */
export function pageRequest(urlParams, { maxLimit, sortKey = "created_utc" }) {
  const sort = urlParams.get("sort") === "asc" ? "asc" : "desc";
  const reverse = urlParams.get("page") === "prev";
  const request = {
    sort: reverse ? (sort === "asc" ? "desc" : "asc") : sort,
    limit: urlParams.get("limit"),
    before: urlParams.get("before"),
    after: urlParams.get("after"),
    sortFilter: null,
  };
  // Skipped items still count against the limit; ask for that many more
  if (request.limit && /^\d+$/.test(request.limit)) {
    request.limit = String(Math.min(Number(request.limit) + skipIds(urlParams).length, maxLimit));
  }
  const cursor = urlParams.get("cursor");
  if (cursor && /^[<>]\d+$/.test(cursor)) {
    if (sortKey !== "created_utc") request.sortFilter = cursor;
    else if (cursor[0] === "<") request.before = cursor.slice(1);
    else request.after = cursor.slice(1);
  }
  return request;
}

/**
 * The API result in display order (reversed for page=prev).
 * @param {Array} items
 * @param {URLSearchParams} urlParams
 * @returns {Array}
 */
export function inDisplayOrder(items, urlParams) {
  return urlParams.get("page") === "prev" ? [...items].reverse() : items;
}

/**
 * Remove items whose id is listed in the skip= parameter.
 * @param {Array<{id: string}>} items
 * @param {URLSearchParams} urlParams
 * @returns {Array}
 */
export function withoutSkipped(items, urlParams) {
  const skip = new Set(skipIds(urlParams));
  return skip.size ? items.filter((item) => !skip.has(item.id)) : items;
}

// Ids of the items at the start (or end) of the page sharing the edge value
function edgeIds(data, sortKey, fromEnd) {
  const items = fromEnd ? [...data].reverse() : data;
  const value = items[0][sortKey];
  const ids = [];
  for (const item of items) {
    if (item[sortKey] !== value) break;
    ids.push(item.id);
  }
  return ids;
}

/**
 * URL of the neighbouring page.
 * @param {object} opts
 * @param {Array} opts.data the current page in display order
 * @param {string} opts.sortKey
 * @param {boolean} opts.previous previous page (from the first item) or next (from the last)
 * @param {boolean} opts.descending display order of the results
 */
function pageUrl({ data, sortKey, previous, descending }) {
  const params = new URLSearchParams(window.location.search);
  const edge = previous ? data[0] : data[data.length - 1];
  const value = Number(edge[sortKey]);
  const ids = edgeIds(data, sortKey, !previous);
  // Moving towards lower values: next page when descending, previous when ascending
  const lower = previous !== descending;
  // If the whole page shares one value, including it would return the same
  // page again, so fall back to the exclusive bound to guarantee progress.
  const inclusive = ids.length < data.length;
  const bound = inclusive ? (lower ? value + 1 : value - 1) : value;

  params.set("cursor", `${lower ? "<" : ">"}${bound}`);
  if (inclusive) params.set("skip", ids.join(","));
  else params.delete("skip");
  if (previous) params.set("page", "prev");
  else params.delete("page");
  return window.location.pathname + "?" + params.toString();
}

/**
 * Render << and >> links into `container`.
 * @param {object} opts
 * @param {Array} opts.data the items shown on this page, in display order
 * @param {HTMLElement} opts.container
 * @param {?string} [opts.sortOrder] "asc" or "desc" (default)
 * @param {string} [opts.sortKey="created_utc"]
 */
export function addPaginationLinks({ data, container, sortOrder, sortKey = "created_utc" }) {
  if (!container || !data || data.length === 0) return;
  const descending = sortOrder !== "asc";

  const prevLink = document.createElement("a");
  prevLink.className = "pagination-link";
  prevLink.textContent = "<<";
  prevLink.href = pageUrl({ data, sortKey, previous: true, descending });

  const nextLink = document.createElement("a");
  nextLink.className = "pagination-link";
  nextLink.textContent = ">>";
  nextLink.href = pageUrl({ data, sortKey, previous: false, descending });

  const wrapper = document.createElement("div");
  wrapper.className = "pagination-container";
  wrapper.append(prevLink, nextLink);
  container.replaceChildren(wrapper);
}
