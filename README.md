
# cppbrowser

A Node.js server for browsing C++ snapshots produced by [cppscanner](https://github.com/strandfield/cppscanner).

## Project architecture

The `server` folder contains an [Express](https://expressjs.com/)-based Node.js server which serves a "static" website (HTML pages generated with [pug](https://pugjs.org/api/getting-started.html)) 
as well as a REST API.

The `client` folder contains a dynamic frontend to the server written using [Vue.js](https://vuejs.org/) and [Vite](https://vitejs.dev/).

This setup was inspired by [Setting up an Express + Typescript Server with Vue + Vite](https://medium.com/@ctrlaltmonique/setting-up-an-express-typescript-server-with-vue-vite-9d415a51facc).

Finally, the `codebrowser` folder contains code that is common between `server` and `client`. 
`codebrowser` uses [Lezer](https://lezer.codemirror.net/) to parse C++ code in the user's web browser.

## Getting started

TODO
