# Portfolio

A dependency-free portfolio website and Node.js backend. Portfolio content is
read from `data/portfolio.json`; contact-form submissions are validated and
appended to `data/messages.jsonl`.

## Run locally

Install Node.js 18 or newer, then run:

```sh
npm start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Do not open `index.html`
directly as a file: the page loads content from the backend API.

## Update your portfolio

Edit `data/portfolio.json` to change your profile, about text, principles,
projects, skills, work history, and education. The browser reads the JSON file
from `/api/portfolio` when the page loads. Project `url` fields are optional.

## Contact submissions

Valid submissions are stored one JSON object per line in
`data/messages.jsonl`. The file is created when the first contact message is
received and is excluded from Git. The contact endpoint validates fields,
limits request sizes, includes a honeypot field, and limits each client address
to five accepted messages per 15-minute window.

The default data directory is `data/`. Set `DATA_DIR` to use a different
directory, `PORT` to change the port, or `HOST` to change the listen address.
For example, set `DATA_DIR` to a persistent volume when deploying.

## Tests

Run the API and contact-storage tests with:

```sh
npm test
```
