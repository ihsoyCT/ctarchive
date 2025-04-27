const axios = require("axios").default;
const moment = require("moment");
const marked = require("marked");

const add_to_url = (query, param_text, value) => {
    if (value !== undefined && value?.length > 0) {
        query.push(`${param_text}=${value}`)
    }
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
        add_to_url(query, "limit", urlParams.get("limit"))
        add_to_url(query, "query", urlParams.get("q"))

        const url = `${this.base_url}${this.submission_end_point}?${query.join('&')}`
        axios
            .get(url)
            .then((e) => {
                subreddit.$el.innerHTML = "";
                e.data.data
                    .forEach((sub) => {
                        console.log(sub)
                        sub.time = moment.unix(sub.created_utc).format("llll");
                        const imagetypes = ["jpg", "png", "gif", "jpeg"];
                        if (imagetypes.includes(sub.url.split(".").pop())) sub.thumbnail = sub.url;
                        subreddit.$el.innerHTML += subreddit.template.submissionCompiled(sub);
                        subreddit.last = sub;
                    })
                subreddit.changeStatus("Submissions Loaded")
            })
            .catch((error) => {
                if (error.response) {
                    console.log(error.response.data);
                    console.log(error.response.status);
                    console.log(error.response.headers);
                    subreddit.changeStatus(error.response.data.error);
                } else {
                    console.log(error)
                    subreddit.changeStatus("Unkown error");
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
        add_to_url(query, "limit", urlParams.get("limit"))
        add_to_url(query, "query", urlParams.get("q"))

        const url = `${this.base_url}${this.comments_search}?${query.join('&')}`

        console.log(url)

        axios.get(url).then(response => {
            subreddit.$el.innerHTML = "";
            response.data.data.forEach((post) => {
                post.time = moment.unix(post.created_utc).format("llll");
                post.body = marked.parse(post.body);
                post.link_id = post.link_id.split("_").pop();
                subreddit.$el.innerHTML += subreddit.template.profilePostCompiled(post);
                subreddit.last = post;
            });
        })
            .catch((error) => {
                if (error.response) {
                    console.log(error.response.data);
                    console.log(error.response.status);
                    console.log(error.response.headers);
                    subreddit.changeStatus(error.response.data.error);
                } else {
                    console.log(error)
                    subreddit.changeStatus("Unkown error");
                }

            });
    },
    grab_comments(id, highlight, subreddit) {
        subreddit.changeStatus("Loading Comments");
        console.log(id);
        const submission_url = `${this.base_url}${this.singular_submission}?ids=${id}`

        console.log(submission_url)
        axios.get(submission_url).then((e) => {
            console.log(e)
            e.data.data[0].time = moment.unix(e.data.data[0].created_utc).format("llll");
            e.data.data[0].selftext = marked.parse(e.data.data[0].selftext);
            subreddit.$el.innerHTML = subreddit.template.submissionCompiled(e.data.data[0]);
        })

        const comment_tree = `${this.base_url}${this.comments_tree_end_point}?link_id=${id}&limit=9999`
        axios.get(comment_tree).then(e => {
            console.log(e)

            e.data.data.forEach(comment => {
                this.handle_comment(comment, subreddit, `t3_${id}`, highlight)
            })

            if (highlight !== null) document.getElementById(highlight).scrollIntoView();
        })
    },
    handle_comment(comment, subreddit, parent, highlight) {
        // Initialize a queue with the initial comment
        let queue = [comment];
    
        while (queue.length > 0) {
            // Dequeue a comment from the queue
            let currentComment = queue.shift();
    
            const data = currentComment.data;
            let tpl_data = {
                "id": data.id,
                "author": data.author,
                "score": data.score,
                "time": data.created_utc,
                "body": data.body,
                "postClass": "post"
            };
    
            if (data.id === highlight) {
                tpl_data.postClass = "post_highlight";
            } else {
                tpl_data.postClass = "post";
            }
    
            document.getElementById(data.parent_id).innerHTML += subreddit.template.postCompiled(tpl_data);
    
            // Enqueue all replies of the current comment
            if (data.replies?.data?.children?.length > 0) {
                data.replies.data.children.forEach(reply => {
                    queue.push(reply);
                });
            }
        }
    }
};

// https://arctic-shift.photon-reddit.com/api/posts/search?sort=asc&after=2019-12-30&subreddit=worldnews&title=wuhan&limit=10
// https://arctic-shift.photon-reddit.com/search/api/posts/search?sort=desc&after=&before=&author=&subreddit=&limit=100&title=