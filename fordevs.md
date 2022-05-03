# For devs...

The purpose of this file is to make Ake more understandable and to encourage you to contribute!

**Sommaire**

1. [Introduction to the project](#introduction-to-the-project)
2. [Documentation of the Api](#documentation-of-the-api)
3. [SDK](#sdk)
4. [Running Ake server locally](#installation-guide)
5. [Security](#security)
6. [Contributing Guide](#contributing-guide)

### Introduction to the project

Ake is an open source messenger. This repo is hosting the `api`, who is online at [https://api.ake-app.com](https://api.ake-app.com).
The front-end part of Ake has not yet been coded. So we strongly encourage you to create your own version of Ake using this `api`.

### Documentation of the Api

For documentating our Api, we are using two applications.

-   Notion : every informations is here, it's like a wiki. Home is [here](https://lead-harmony-d7b.notion.site/Ake-Public-5af866c71d63417684165348f3648ada), documentation about routes [here](https://lead-harmony-d7b.notion.site/Routes-29e68974864a4f178a587eac4d677854) and about authentication process [here](https://lead-harmony-d7b.notion.site/Authentication-342ef233a86f47b39984e44ef1386374).
-   Potsman is also useful for making requests directely, check [here](https://app.getpostman.com/run-collection/14271414-f3ccc73b-ed8b-473e-a253-0179d5705fcc?action=collection%2Ffork&collection-url=entityId%3D14271414-f3ccc73b-ed8b-473e-a253-0179d5705fcc%26entityType%3Dcollection%26workspaceId%3D88b58dc1-5d9a-4971-8088-89de8d2bd353) for the collection.

### SDK

We've also made an SDK to help clients to deal with the Api. It is still under development, but beta version is available [here](https://github.com/wshchocolatine/ake-sdk).

### Installation guide

If you want to use our `Api` locally, you need first to install `Postgresql`, `Redis` and `Node` on your machine.

When it's done, clone this repo on your laptop. Then run `npm install` and add a `.env` file that you will fill with these values :

```
PORT=3333
HOST=0.0.0.0
NODE_ENV=development
APP_KEY=<your_app_key>
DB_CONNECTION=pg
PG_HOST=localhost
PG_PORT=<your postgresql port>
PG_USER=<your postgresql user>
PG_PASSWORD=<your postgresql password>
PG_DB_NAME=<your postgresql db name>
SESSION_DRIVER=cookie
REDIS_CONNECTION=local
REDIS_HOST=<your redis host>
REDIS_PORT=<your redis port>
REDIS_PASSWORD=<your redis password>
```

If you want to run cookies with `Postman`, edit your `config/app.ts` file : set these values to false :

```typescript
cookie: {
	domain: '',
	path: '/',
	maxAge: '2h',
	httpOnly: true, // <-- here
	secure: true, // <-- here
	sameSite: 'none',
},
```

To get an app key, run on your terminal `node ace generate:key`.
When everything is done, you can run `node ace serve --watch` and... tadaaaa! your local Ake server is emitting on `http://localhost:3333` !

### Technologies 🛠

-   AdonisJS, v5 : an open-source typescript framework that we are using because it is efficient, complete and regularly updated. It manages routing, authentication, validation, file uploads, sessions and more. [[https://adonisjs.com/](https://adonisjs.com/)]
-   Lucid, v15 : an open-source SQL ORM made for AdonisJS. It manages connections with the PostgreSQL database (that includes a query builder, migrations...). [[https://github.com/adonisjs/lucid](https://github.com/adonisjs/lucid)]
-   PostgreSQL : an SQL database. [[https://www.postgresql.org/](https://www.postgresql.org/)]
-   Redis : caching database. [[https://redis.io/](https://redis.io/)]
-   Typescript : the language [[https://www.typescriptlang.org/](https://www.typescriptlang.org/)]
-   NodeJS : node.js is a JavaScript runtime built on Chrome's V8 JavaScript engine. [[https://nodejs.org](https://nodejs.org/)]
-   Socket.io : used for real-time communication. [[https://socket.io](https://socket.io)]
-   Luxon : typescript library for date time. [[https://moment.github.io/luxon/](https://moment.github.io/luxon/#/)]

The `api` is based on AdonisJS (who looks like Laravel on NodeJS env) and on TypeScript, so if you want to contribute to the `api`, you have to master these tools.

### Security

If you want to learn more about security considerations, check [here](https://github.com/wshchocolatine/ake-api#security-)

### Contributing guide

We have no contributing guide for the moment, just don't hesitate to open pull requests if you want to improve Ake !
