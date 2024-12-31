
# cppbrowser

A Node.js server for browsing C++ snapshots produced by [cppscanner](https://github.com/strandfield/cppscanner).

[Demo](https://code.strandfield.dev)

## Project architecture

The `server` folder contains an [Express](https://expressjs.com/)-based Node.js server which serves a "static" website (HTML pages generated with [pug](https://pugjs.org/api/getting-started.html)) 
as well as a REST API.

The `client` folder contains a dynamic frontend to the server written using [Vue.js](https://vuejs.org/) and [Vite](https://vitejs.dev/).

This setup was inspired by [Setting up an Express + Typescript Server with Vue + Vite](https://medium.com/@ctrlaltmonique/setting-up-an-express-typescript-server-with-vue-vite-9d415a51facc).

Finally, the `codebrowser` folder contains code that is common between `server` and `client`. 
`codebrowser` uses [Lezer](https://lezer.codemirror.net/) to parse C++ code in the user's web browser.

## Getting started

### Working on the project

With Visual Studio: 
- run the `code` command in this folder
- select the "server" configuration and run if (F5)
- open a terminal, move to the "client" folder and run `npm run dev`
- the server should now be reachable at "http://localhost:5173"

### Deploying

Move to the `client` folder and run the `npm run build` command.
This will run `vite build` internally, which will: bundle the whole
frontend as a single javascript file, create a `index.html` file 
for the application and copy other resources into the `dist` folder.

Copy the whole content of `client/dist` into `server/dist`.

In `server`, start the server with:

```
export NODE_ENV=production
node ./bin/www
```

By default, the server runs on port 3000.
You may change the port number using the `PORT` environment variable.
