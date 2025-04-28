const axios = require("axios").default;
const moment = require("moment");
const marked = require("marked");
import { updateStatusLog } from "./subreddit";

const add_to_url = (query, param_text, value) => {
    if (value !== undefined && value?.length > 0) {
        query.push(`${param_text}=${value}`)
    }
}

function addPaginationLinks({ data, urlParams, container }) {
    if (!data || data.length === 0) return;
    const sortOrder = urlParams.get('sort') || 'desc';
    const firstCreatedUtc = data[0].created_utc;
    const lastCreatedUtc = data[data.length - 1].created_utc;

    // Next Page (Older/Younger Posts)
    const nextLink = document.createElement('a');
    nextLink.className = 'pagination-link';
    nextLink.style.display = 'block';
    nextLink.style.margin = '20px auto 0 auto';
    nextLink.style.textAlign = 'center';
    nextLink.style.fontWeight = 'bold';

    // Previous Page (Newer/Older Posts)
    const prevLink = document.createElement('a');
    prevLink.className = 'pagination-link';
    prevLink.style.display = 'block';
    prevLink.style.margin = '10px auto 0 auto';
    prevLink.style.textAlign = 'center';
    prevLink.style.fontWeight = 'bold';

    if (sortOrder === 'desc') {
        // Next: before=lastCreatedUtc (older)
        nextLink.textContent = 'Next Page (Older Posts)';
        const urlParamsNext = new URLSearchParams(window.location.search);
        urlParamsNext.set('before', lastCreatedUtc);
        nextLink.href = window.location.pathname + '?' + urlParamsNext.toString();
        // Previous: after=firstCreatedUtc (newer)
        prevLink.textContent = 'Previous Page (Newer Posts)';
        const urlParamsPrev = new URLSearchParams(window.location.search);
        urlParamsPrev.set('after', firstCreatedUtc);
        urlParamsPrev.delete('before');
        prevLink.href = window.location.pathname + '?' + urlParamsPrev.toString();
    } else {
        // Next: after=lastCreatedUtc (newer)
        nextLink.textContent = 'Next Page (Newer Posts)';
        const urlParamsNext = new URLSearchParams(window.location.search);
        urlParamsNext.set('after', lastCreatedUtc);
        nextLink.href = window.location.pathname + '?' + urlParamsNext.toString();
        // Previous: before=firstCreatedUtc (older)
        prevLink.textContent = 'Previous Page (Older Posts)';
        const urlParamsPrev = new URLSearchParams(window.location.search);
        urlParamsPrev.set('before', firstCreatedUtc);
        urlParamsPrev.delete('after');
        prevLink.href = window.location.pathname + '?' + urlParamsPrev.toString();
    }
    container.appendChild(nextLink);
    container.appendChild(prevLink);
}

export const artic_shift = {
    base_url: "https://arctic-shift.photon-reddit.com",
    submission_end_point: `/api/posts/search`,
    singular_submission: `/api/posts/ids`,
    comments_tree_end_point: `/api/comments/tree`,
    comments_search: '/api/comments/search',

    get_submissions(urlParams, subreddit) {
        let query = []
        add_to_url(query, "sort", urlParams.get("sort"))
        add_to_url(query, "after", urlParams.get("after"))
        add_to_url(query, "before", urlParams.get("before"))
        add_to_url(query, "author", urlParams.get("author"))
        add_to_url(query, "subreddit", urlParams.get("subreddit"))
        add_to_url(query, "author_flair_text", urlParams.get("author_flair_text"))
        add_to_url(query, "limit", urlParams.get("limit"))
        add_to_url(query, "crosspost_parent_id", urlParams.get("crosspost_parent_id"))
        add_to_url(query, "over_18", urlParams.get("over_18"))
        add_to_url(query, "spoiler", urlParams.get("spoiler"))
        add_to_url(query, "title", urlParams.get("title"))
        // Backwards compatibility: if 'q' is present, use it as 'selftext'
        let selftextValue = urlParams.get("q") || urlParams.get("selftext");
        add_to_url(query, "selftext", selftextValue);
        add_to_url(query, "link_flair_text", urlParams.get("link_flair_text"))
        add_to_url(query, "query", urlParams.get("query"))
        add_to_url(query, "url", urlParams.get("url"))
        add_to_url(query, "url_exact", urlParams.get("url_exact"))

        // Only request fields actually used in the templates
        const filterFields = [
            "id", "author", "score", "created_utc", "title", "selftext", "subreddit", "url", "num_comments", "author_flair_text", "thumbnail"
        ];
        add_to_url(query, "filter", filterFields.join(","));

        const url = `${this.base_url}${this.submission_end_point}?${query.join('&')}`
        updateStatusLog(`Grabbing Submissions from Arctic_shift with params: ${urlParams.toString()}`, "loading");
        axios
            .get(url)
            .then((e) => {
                subreddit.$el.innerHTML = "";
                let lastCreatedUtc = null;
                e.data.data
                    .forEach((sub) => {
                        console.log(sub)
                        sub.time = moment.unix(sub.created_utc).format("llll");
                        const imagetypes = ["jpg", "png", "gif", "jpeg"];
                        if (imagetypes.includes(sub.url.split(".").pop())) sub.thumbnail = sub.url;
                        subreddit.$el.innerHTML += subreddit.template.submissionCompiled(sub);
                        subreddit.last = sub;
                        lastCreatedUtc = sub.created_utc;
                    })
                updateStatusLog(`Done grabbing submissions from Arctic_shift`, "success");
                addPaginationLinks({ data: e.data.data, urlParams, container: subreddit.$el });
            })
            .catch((error) => {
                let errorMsg = error?.response?.data?.error || error.message;
                updateStatusLog(`Error grabbing submissions from Arctic_shift: ${errorMsg}`, "error");
                if (error.response) {
                    console.log(error.response.data);
                    console.log(error.response.status);
                    console.log(error.response.headers);
                } else {
                    console.log(error)
                }
            });
    },
    search_comments(urlParams, subreddit) {
        let query = []
        add_to_url(query, "sort", urlParams.get("sort"))
        add_to_url(query, "after", urlParams.get("after"))
        add_to_url(query, "before", urlParams.get("before"))
        add_to_url(query, "author", urlParams.get("author"))
        add_to_url(query, "subreddit", urlParams.get("subreddit"))
        add_to_url(query, "author_flair_text", urlParams.get("author_flair_text"))
        add_to_url(query, "limit", urlParams.get("limit"))
        add_to_url(query, "crosspost_parent_id", urlParams.get("crosspost_parent_id"))
        add_to_url(query, "over_18", urlParams.get("over_18"))
        add_to_url(query, "spoiler", urlParams.get("spoiler"))
        add_to_url(query, "title", urlParams.get("title"))
        // Backwards compatibility: if 'q' is present, use it as 'selftext'
        let selftextValue = urlParams.get("q") || urlParams.get("selftext");
        add_to_url(query, "selftext", selftextValue);
        add_to_url(query, "link_flair_text", urlParams.get("link_flair_text"))
        add_to_url(query, "query", urlParams.get("query"))
        add_to_url(query, "url", urlParams.get("url"))
        add_to_url(query, "url_exact", urlParams.get("url_exact"))

        // Only request fields actually used in the templates
        const filterFields = [
            "id", "author", "score", "created_utc", "body", "subreddit", "link_id", "permalink", "author_flair_text"
        ];
        add_to_url(query, "filter", filterFields.join(","));

        const url = `${this.base_url}${this.comments_search}?${query.join('&')}`
        updateStatusLog(`Searching comments from Arctic_shift with params: ${urlParams.toString()}`, "loading");
        axios.get(url).then(response => {
            subreddit.$el.innerHTML = "";
            response.data.data.forEach((post) => {
                post.time = moment.unix(post.created_utc).format("llll");
                post.body = marked.parse(post.body);
                post.link_id = post.link_id.split("_").pop();
                subreddit.$el.innerHTML += subreddit.template.profilePostCompiled(post);
                subreddit.last = post;
            });
            updateStatusLog(`Done searching comments from Arctic_shift`, "success");
            addPaginationLinks({ data: response.data.data, urlParams, container: subreddit.$el });
        })
            .catch((error) => {
                let errorMsg = error?.response?.data?.error || error.message;
                updateStatusLog(`Error searching comments from Arctic_shift: ${errorMsg}`, "error");
                if (error.response) {
                    console.log(error.response.data);
                    console.log(error.response.status);
                    console.log(error.response.headers);
                } else {
                    console.log(error)
                }
            });
    },
    grab_comments(id, highlight, subreddit) {
        console.log(id);
        const submission_url = `${this.base_url}${this.singular_submission}?ids=${id}`
        updateStatusLog(`Grabbing Submission by ID from Arctic_shift: ${id}`, "loading");
        axios.get(submission_url).then((e) => {
            console.log(e)
            e.data.data[0].time = moment.unix(e.data.data[0].created_utc).format("llll");
            e.data.data[0].selftext = marked.parse(e.data.data[0].selftext);
            subreddit.$el.innerHTML = subreddit.template.submissionCompiled(e.data.data[0]);
            updateStatusLog(`Done grabbing submission by ID from Arctic_shift`, "success");
        }).catch((error) => {
            let errorMsg = error?.response?.data?.error || error.message;
            updateStatusLog(`Error grabbing submission by ID from Arctic_shift: ${errorMsg}`, "error");
        });

        const comment_tree = `${this.base_url}${this.comments_tree_end_point}?link_id=${id}&limit=9999`
        updateStatusLog(`Grabbing comment tree from Arctic_shift for submission ID: ${id}`, "loading");
        axios.get(comment_tree).then(e => {
            console.log(e)

            e.data.data.forEach(comment => {
                this.handle_comment(comment, subreddit, `t3_${id}`, highlight)
            })

            if (highlight !== null) document.getElementById(highlight).scrollIntoView();
            updateStatusLog(`Done grabbing comment tree from Arctic_shift for submission ID: ${id}`, "success");
        }).catch((error) => {
            let errorMsg = error?.response?.data?.error || error.message;
            updateStatusLog(`Error grabbing comment tree from Arctic_shift for submission ID: ${id}: ${errorMsg}`, "error");
        });
    },
    comments_count: 0,
    handle_comment(comment, subreddit, parent, highlight) {
        // Initialize a queue with the initial comment
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
            // Compile HTML and parse to node
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = subreddit.template.postCompiled(tpl_data);
            if (tempDiv.firstElementChild) {
                childrenMap[data.parent_id].push(tempDiv.firstElementChild);
            }

            if (data.replies?.data?.children?.length > 0) {
                data.replies.data.children.forEach(reply => queue.push(reply));
            }
        }

        console.log(`Total comments: ${this.comments_count}`);

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