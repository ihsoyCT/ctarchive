const axios = require("axios").default;
const moment = require("moment");
const marked = require("marked");
import { updateStatusLog } from "./subreddit";

const add_to_url = (query, param_text, value) => {
    if (value !== undefined && value?.length > 0) {
        query.push(`${param_text}=${value}`)
    }
}

/**
 * Populate form fields from URLSearchParams.
 * @param {URLSearchParams} urlParams
 */
function populateForm(urlParams) {
    urlParams.forEach((a) => {
        let [k, p] = a.split('=');
        const el = document.getElementById(k);
        if (el && typeof el.value !== 'undefined') el.value = p;
    });
}


function addPaginationLinks({ data, urlParams, container }) {
    if (!data || data.length === 0) return;
    const sortOrder = urlParams.get('sort') || 'desc';
    const firstCreatedUtc = data[0].created_utc;
    const lastCreatedUtc = data[data.length - 1].created_utc;

    // Next Page (Older/Younger Posts)
    const nextLink = document.createElement('a');
    nextLink.className = 'pagination-link';

    // Previous Page (Newer/Older Posts)
    const prevLink = document.createElement('a');
    prevLink.className = 'pagination-link';
    if (sortOrder === 'desc') {
        // Next: before=lastCreatedUtc (older)
        nextLink.textContent = '>>';
        const urlParamsNext = new URLSearchParams(window.location.search);
        urlParamsNext.set('before', lastCreatedUtc);
        nextLink.href = window.location.pathname + '?' + urlParamsNext.toString();
        // Previous: after=firstCreatedUtc (newer)
        prevLink.textContent = '<<';
        const urlParamsPrev = new URLSearchParams(window.location.search);
        urlParamsPrev.set('after', firstCreatedUtc);
        urlParamsPrev.delete('before');
        prevLink.href = window.location.pathname + '?' + urlParamsPrev.toString();
    } else {
        // Next: after=lastCreatedUtc (newer)
        nextLink.textContent = '>>';
        const urlParamsNext = new URLSearchParams(window.location.search);
        urlParamsNext.set('after', lastCreatedUtc);
        nextLink.href = window.location.pathname + '?' + urlParamsNext.toString();
        // Previous: before=firstCreatedUtc (older)
        prevLink.textContent = '<<';
        const urlParamsPrev = new URLSearchParams(window.location.search);
        urlParamsPrev.set('before', firstCreatedUtc);
        urlParamsPrev.delete('after');
        prevLink.href = window.location.pathname + '?' + urlParamsPrev.toString();
    }    // Clear container and center links
    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'pagination-container';
    wrapper.appendChild(prevLink);
    wrapper.appendChild(nextLink);
    container.appendChild(wrapper);
}

/**
 * Arctic Shift backend logic for Reddit archive search.
 * @namespace artic_shift
 */
export const artic_shift = {
    base_url: "https://arctic-shift.photon-reddit.com",
    submission_end_point: `/api/posts/search`,
    singular_submission: `/api/posts/ids`,
    comments_tree_end_point: `/api/comments/tree`,
    comments_search: '/api/comments/search',

    /**
     * Fetch submissions from Arctic Shift API and render them.
     * @param {URLSearchParams} urlParams
     * @param {object} subreddit
     */
    get_submissions(urlParams, subreddit) {
        let query = [];
        // Legacy mode: if 'q' is present (even if empty), use it for 'query' and set limit to 'auto', only include relevant params
        if (urlParams.has("q")) {
            add_to_url(query, "subreddit", urlParams.get("subreddit"));
            add_to_url(query, "sort", urlParams.get("sort"));
            add_to_url(query, "after", urlParams.get("after"));
            add_to_url(query, "before", urlParams.get("before"));
            add_to_url(query, "author", urlParams.get("author"));
            add_to_url(query, "query", urlParams.get("q"));
            add_to_url(query, "limit", "auto");
            populateForm(query)
        } else {
            add_to_url(query, "sort", urlParams.get("sort"));
            add_to_url(query, "after", urlParams.get("after"));
            add_to_url(query, "before", urlParams.get("before"));
            add_to_url(query, "author", urlParams.get("author"));
            add_to_url(query, "subreddit", urlParams.get("subreddit"));
            add_to_url(query, "author_flair_text", urlParams.get("author_flair_text"));
            add_to_url(query, "limit", urlParams.get("limit"));
            add_to_url(query, "crosspost_parent_id", urlParams.get("crosspost_parent_id"));
            add_to_url(query, "over_18", urlParams.get("over_18"));
            add_to_url(query, "spoiler", urlParams.get("spoiler"));
            add_to_url(query, "title", urlParams.get("title"));
            add_to_url(query, "selftext", urlParams.get("selftext"));
            add_to_url(query, "link_flair_text", urlParams.get("link_flair_text"));
            add_to_url(query, "query", urlParams.get("query"));
            add_to_url(query, "url", urlParams.get("url"));
            add_to_url(query, "url_exact", urlParams.get("url_exact"));
        }

        const url = `${this.base_url}${this.submission_end_point}?${query.join('&')}`;
        updateStatusLog(`Grabbing Submissions from Arctic_shift with params: ${urlParams.toString()}`, "loading");
        axios
            .get(url)
            .then((e) => {
                subreddit.$el.innerHTML = "";
                const frag = document.createDocumentFragment();
                e.data.data.forEach((sub) => {
                    sub.time = moment.unix(sub.created_utc).format("llll");
                    const imagetypes = ["jpg", "png", "gif", "jpeg"];
                    if (imagetypes.includes(sub.url.split(".").pop())) sub.thumbnail = sub.url;

                    // If preview exists, collect all images[].source.url into sub.previews
                    if (sub.preview && Array.isArray(sub.preview.images)) {
                        sub.previews = sub.preview.images.map(img => img.source && img.source.url).filter(Boolean);
                    }
                    // If media_metadata exists, add all s.u from each image to sub.previews
                    if (sub.media_metadata && typeof sub.media_metadata === 'object') {
                        if (!sub.previews) sub.previews = [];
                        Object.values(sub.media_metadata).forEach(meta => {
                            if (meta && meta.s && meta.s.u) {
                                sub.previews.push(meta.s.u);
                            }
                        });
                    }
                    const tempDiv = document.createElement('div');

                    tempDiv.innerHTML = subreddit.template.submissionCompiled(sub);
                    frag.appendChild(tempDiv.firstElementChild);
                    subreddit.last = sub;
                });
                subreddit.$el.appendChild(frag);
                updateStatusLog(`Done grabbing submissions from Arctic_shift`, "success");
                addPaginationLinks({ data: e.data.data, urlParams, container: document.getElementById('paginate') });
            })
            .catch((error) => {
                let errorMsg = error?.response?.data?.error || error.message;
                updateStatusLog(`Error grabbing submissions from Arctic_shift: ${errorMsg}`, "error");
            });
    },
    /**
     * Search comments from Arctic Shift API and render them.
     * @param {URLSearchParams} urlParams
     * @param {object} subreddit
     */
    search_comments(urlParams, subreddit) {
        let query = [];
        if (urlParams.has("q")) {
            add_to_url(query, "subreddit", urlParams.get("subreddit"));
            add_to_url(query, "sort", urlParams.get("sort"));
            add_to_url(query, "after", urlParams.get("after"));
            add_to_url(query, "before", urlParams.get("before"));
            add_to_url(query, "author", urlParams.get("author"));
            add_to_url(query, "body", urlParams.get("q"));
            add_to_url(query, "limit", "100");
            populateForm(query)
        } else {
            add_to_url(query, "sort", urlParams.get("sort"));
            add_to_url(query, "after", urlParams.get("after"));
            add_to_url(query, "before", urlParams.get("before"));
            add_to_url(query, "author", urlParams.get("author"));
            add_to_url(query, "subreddit", urlParams.get("subreddit"));
            add_to_url(query, "author_flair_text", urlParams.get("author_flair_text"));
            add_to_url(query, "limit", urlParams.get("limit"));
            add_to_url(query, "crosspost_parent_id", urlParams.get("crosspost_parent_id"));
            add_to_url(query, "body", urlParams.get("body"));
            add_to_url(query, "link_id", urlParams.get("link_id"));
            add_to_url(query, "parent_id", urlParams.get("parent_id"));
        }

        const url = `${this.base_url}${this.comments_search}?${query.join('&')}`;
        updateStatusLog(`Searching comments from Arctic_shift with params: ${urlParams.toString()}`, "loading");
        axios.get(url).then(response => {
            console.log(response.data.data);
            subreddit.$el.innerHTML = "";
            const frag = document.createDocumentFragment();
            response.data.data.forEach((post) => {
                console.log(post);
                post.time = moment.unix(post.created_utc).format("llll");
                post.body = marked.parse(post.body);
                post.link_id = post.link_id.split("_").pop();
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = subreddit.template.profilePostCompiled(post);
                frag.appendChild(tempDiv.firstElementChild);
                subreddit.last = post;
            });
            subreddit.$el.appendChild(frag);
            updateStatusLog(`Done searching comments from Arctic_shift`, "success");
            addPaginationLinks({ data: response.data.data, urlParams, container: document.getElementById('paginate') });
        })
            .catch((error) => {
                let errorMsg = error?.response?.data?.error || error.message;
                updateStatusLog(`Error searching comments from Arctic_shift: ${errorMsg}`, "error");
            });
    },
    /**
     * Fetch a submission and its comment tree by ID from Arctic Shift API.
     * @param {string} id
     * @param {string} highlight
     * @param {object} subreddit
     */
    grab_comments(id, highlight, subreddit) {
        const submission_url = `${this.base_url}${this.singular_submission}?ids=${id}`;
        updateStatusLog(`Grabbing Submission by ID from Arctic_shift: ${id}`, "loading");
        axios.get(submission_url).then((e) => {
            e.data.data[0].time = moment.unix(e.data.data[0].created_utc).format("llll");
            e.data.data[0].selftext = marked.parse(e.data.data[0].selftext);
            subreddit.$el.innerHTML = subreddit.template.submissionCompiled(e.data.data[0]);
            updateStatusLog(`Done grabbing submission by ID from Arctic_shift`, "success");
        }).catch((error) => {
            let errorMsg = error?.response?.data?.error || error.message;
            updateStatusLog(`Error grabbing submission by ID from Arctic_shift: ${errorMsg}`, "error");
        });

        const comment_tree = `${this.base_url}${this.comments_tree_end_point}?link_id=${id}&limit=9999`;
        updateStatusLog(`Grabbing comment tree from Arctic_shift for submission ID: ${id}`, "loading");
        axios.get(comment_tree).then(e => {
            e.data.data.forEach(comment => {
                this.handle_comment(comment, subreddit, `t3_${id}`, highlight);
            });
            if (highlight !== null) {
                const el = document.getElementById(highlight);
                if (el) el.scrollIntoView();
            }
            updateStatusLog(`Done grabbing comment tree from Arctic_shift for submission ID: ${id}`, "success");
        }).catch((error) => {
            let errorMsg = error?.response?.data?.error || error.message;
            updateStatusLog(`Error grabbing comment tree from Arctic_shift for submission ID: ${id}: ${errorMsg}`, "error");
        });
    },
    comments_count: 0,
    /**
     * Handle and render a comment tree node (recursive, uses DocumentFragment for performance).
     * @param {object} comment
     * @param {object} subreddit
     * @param {string} parent
     * @param {string} highlight
     */
    handle_comment(comment, subreddit, parent, highlight) {
        let queue = [comment];
        const childrenMap = {};
        while (queue.length > 0) {
            this.comments_count++;
            let currentComment = queue.shift();
            const data = currentComment.data;
            let tpl_data = {
                "id": data.id,
                "author": data.author,
                "score": data.score,
                "time": data.created_utc,
                "body": data.body,
                "postClass": data.id === highlight ? "post_highlight" : "post"
            };
            if (!childrenMap[data.parent_id]) childrenMap[data.parent_id] = [];
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = subreddit.template.postCompiled(tpl_data);
            if (tempDiv.firstElementChild) {
                childrenMap[data.parent_id].push(tempDiv.firstElementChild);
            }
            if (data.replies?.data?.children?.length > 0) {
                data.replies.data.children.forEach(reply => queue.push(reply));
            }
        }
        // Batch update DOM using DocumentFragment
        Object.entries(childrenMap).forEach(([parentId, nodes]) => {
            const parentEl = document.getElementById(parentId);
            if (parentEl) {
                const frag = document.createDocumentFragment();
                nodes.forEach(node => frag.appendChild(node));
                parentEl.appendChild(frag);
            }
        });
    }
};

// https://arctic-shift.photon-reddit.com/api/posts/search?sort=asc&after=2019-12-30&subreddit=worldnews&title=wuhan&limit=10
// https://arctic-shift.photon-reddit.com/search/api/posts/search?sort=desc&after=&before=&author=&subreddit=&limit=100&title=