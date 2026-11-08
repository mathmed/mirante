# The proxy in front of Immich

Mirante never talks to Immich directly. It talks to a reverse proxy that serves the app, sends the
API keys to Immich itself (so that no key lives in `config.json` or in a TV package) and lets
through **only the routes Mirante uses**. This page lists them exactly, for the owner to keep the
proxy's allow list in step with the app, and gives a Caddyfile that does it.

The proxy holds one key that reads, and, **only if the owner wants Mirante to manage the library**,
a second key for the changes (photos to the trash, albums created, renamed, deleted and filled),
sent to Immich on the routes of the changes alone, each with its method, its path and its whole
body. Without that second key, Mirante reads only, as before: its management actions are hidden,
and it says why when someone asks for them. See [The changes](#the-changes-optional).

## The routes Mirante uses

Every route is under `/api` of the address in `immichUrl`. Nothing else reaches Immich.

| Method | Route                        | What for                                                                                         | Immich permission |
| ------ | ---------------------------- | ------------------------------------------------------------------------------------------------ | ----------------- |
| `GET`  | `/api/server/version`        | the version shown on the start screen; proves the address is Immich                              | none (public)     |
| `POST` | `/api/auth/validateToken`    | proves the key works, at startup; no body, changes nothing                                       | none              |
| `GET`  | `/api/albums`                | the albums, their covers and counts                                                              | `album.read`      |
| `GET`  | `/api/timeline/buckets`      | the months of the timeline (with their counts, for the start screen), or of an album (`albumId`) | `asset.read`      |
| `GET`  | `/api/timeline/bucket`       | the photos of a month (`timeBucket`), of the timeline or of an album (`albumId`)                 | `asset.read`      |
| `POST` | `/api/search/random`         | **new**: a random draw of the library for its presentation, 200 photos a round (see below)       | `asset.read`      |
| `POST` | `/api/search/metadata`       | **new**: the photos of this day in past years, behind the start screen (see below)               | `asset.read`      |
| `GET`  | `/api/assets/{id}`           | **new**: the detail of one photo, for its caption (`exifInfo.description`)                       | `asset.read`      |
| `GET`  | `/api/assets/{id}/thumbnail` | the images: `?size=thumbnail` in the grids, `?size=preview` in the viewer; loaded by `<img src>` | `asset.view`      |
| `GET`  | `/api/api-keys/me`           | **new**: what the key of the changes may do, at startup; sent with **that** key (see below)      | none              |
| `GET`  | `/api/server/features`       | **new**: whether Immich keeps a trash, asked only when the key of the changes answered above     | none (public)     |

Details that matter for the allow list:

- **`POST /api/search/random` only reads.** Immich's searches take their filters as a JSON body,
  hence the `POST`. Mirante sends this body, with `Content-Type: application/json`, once when a
  presentation of the whole library starts and once more for each later round:
  `{"size": 200, "type": "IMAGE", "visibility": "timeline", "withExif": false}`.
- **`POST /api/search/metadata` only reads**, like the random draw: a search by date, once a visit
  of the start screen, one per past year that holds photos near this day (read from
  `/api/timeline/buckets`), and as many again for the days after it only when no year has a photo
  on this very day. Each body asks for at most 20 photos of the timeline, without videos or EXIF
  data, taken in a window of about a month:
  `{"filter": {"takenAt": {"gte": "2023-10-07T10:00:00.000Z", "lt": "2023-11-08T12:00:00.000Z"}, "type": {"eq": "IMAGE"}, "visibility": {"eq": "timeline"}}, "withExif": false, "size": 20, "orderBy": {"field": "localDateTime", "direction": "desc"}}`
  (the form Immich 3 takes with `orderBy`: it refuses the older flat filters `takenAfter`, `type`,
  `visibility` or `page` beside it). The window covers every time zone, so a full page may hold
  only photos of the early morning after the last day (a New Year's party): only then is the next
  page asked for, with the `cursor` of the previous answer, up to five.
  Refused, it goes to the log and the start screen shows the cover of the most recent album.
- **`GET /api/assets/{id}` is asked for two photos at a time**: the one on the screen and the next
  one, only while a viewer or a presentation shows captions, and each photo once while it is near
  the screen. It never lists the library. Immich answers `PUT` on the same route (it edits the
  photo): allow `GET` only.
- **`GET /api/timeline/bucket` is asked a month at a time** by **Todas**, every photo of the
  library: the most recent month first, then the next one each time the focus nears the end of
  what is read. It is the same route as the timeline's, so the proxy needs no change for it.
- **`/api/assets/{id}/thumbnail` takes a `size`**: Mirante only asks for `thumbnail` and `preview`.
  Immich also answers `size=fullsize` and `size=original` there, which serve the full image: allow
  the two small sizes only.
- An `OPTIONS` preflight comes before the calls of the packaged apps, which load from `file://`, so
  that every call crosses origins; for the two searches (`POST /api/search/random` and
  `POST /api/search/metadata`) it asks to send `Content-Type`.

The key the proxy sends on these routes needs `album.read`, `asset.read` and `asset.view`, and
nothing more. `GET /api/api-keys/me` is the one read that goes with the key of the changes: Immich
answers it with that key's name and permissions (never its secret), and Mirante offers only the
actions they allow. A proxy without the key of the changes refuses the route (`403`), or sends an
empty key that Immich refuses (`401`): either way, Mirante reads only.

## The changes (optional)

Mirante changes the library only through these seven routes, each with exactly this body (the
JSON Mirante sends, without spaces, the fields in this order; `src/immich/immich-editor.test.ts`
pins each one), and only with the key of the changes:

| Method   | Route                       | Body                                               | What for                                | Immich permission   |
| -------- | --------------------------- | -------------------------------------------------- | --------------------------------------- | ------------------- |
| `DELETE` | `/api/assets`               | `{"ids":["<uuid>",...],"force":false}`             | photos to the trash, **never for good** | `asset.delete`      |
| `POST`   | `/api/trash/restore/assets` | `{"ids":["<uuid>",...]}`                           | the undo: the same photos back          | `asset.delete`      |
| `POST`   | `/api/albums`               | `{"albumName":"<name>","assetIds":["<uuid>",...]}` | a new album, with its photos (or none)  | `album.create`      |
| `PATCH`  | `/api/albums/{id}`          | `{"albumName":"<name>"}`                           | a new name                              | `album.update`      |
| `DELETE` | `/api/albums/{id}`          | none                                               | the album alone; its photos stay        | `album.delete`      |
| `PUT`    | `/api/albums/{id}/assets`   | `{"ids":["<uuid>",...]}`                           | photos added to an album                | `albumAsset.create` |
| `DELETE` | `/api/albums/{id}/assets`   | `{"ids":["<uuid>",...]}`                           | photos taken out of an album            | `albumAsset.delete` |

Details that matter:

- **Nothing is deleted for good.** `"force": false` sends the photos to Immich's trash, where they
  stay for the days its settings say (30 by default) and can be restored from Immich or, for 30
  seconds, with **Desfazer** in Mirante. The proxy refuses `"force": true`, a body without
  `force`, `POST /api/trash/empty` and every other route. Immich deletes for good, whatever
  `force` says, when its trash is off (Administration → Settings → Trash): Mirante asks
  `GET /api/server/features` and offers no deletion then, but the proxy cannot tell, so **keep
  the trash on**.
- **Deleting an album** removes the album, not its photos; Immich keeps no trash of albums, so
  Mirante asks for a confirmation that says so. Sending photos to the trash asks for one too.
- **The bodies are matched whole**: an album shared with someone (`albumUsers`), a description, a
  cover or an order (`PATCH`), a favorite or an archive (`PUT /api/assets`), any extra field or
  another order of the fields is refused with a `403`. A body over 1 MB (about 25 000 photos at
  once) is refused with a `413`.
- An `OPTIONS` preflight comes before each change in the packaged apps: the proxy allows `PUT`,
  `PATCH` and `DELETE` in it (**new**), and `Content-Type`.

### Activating the changes

The key is created and kept by the owner, on the server, never in the repository, a TV package or
`config.json`, and never printed in a log:

1. **Create the key in Immich**: avatar → Account Settings → API Keys → New API Key, named, say,
   `Mirante (alterações)`, with these permissions and no other: `asset.delete`, `album.create`,
   `album.update`, `album.delete`, `albumAsset.create` and `albumAsset.delete`. Copy its secret
   once; Immich does not show it again.
2. **Keep it in a file of the server, outside the repository**, readable by its owner alone, next
   to the read key: for example `/home/<you>/mirante-proxy/.env.write` (`chmod 600`), holding one
   line, `IMMICH_WRITE_API_KEY=<the secret>`.
3. **Update the Caddyfile** of the proxy to the one below (keep a copy of the current one).
4. **Recreate the proxy** with the new variable: `caddy reload` reads the Caddyfile again but not
   the environment, so the container starts anew with both files, for example
   `docker run ... --env-file .env --env-file .env.write ...` with the options it had (the name,
   the network, the ports, the Caddyfile and the folder of the app), or `env_file:` in Docker
   Compose.
5. **Check it**, from the TV's network: `curl http://<proxy>/api/api-keys/me` shows the name of the
   key and its six permissions (no secret), and `curl -X DELETE http://<proxy>/api/assets -d
'{"ids":[],"force":true}'` answers `403`. Open Mirante again: the bar of actions shows above the
   photos of an album or a month.

To turn the changes off, remove the variable (or the routes of the changes) and recreate the
proxy: Mirante reads only again, and says so when asked for an action. Deleting the key in Immich
turns them off as well.

**Who can change what**: with the key active, anyone who opens Mirante on the network of the proxy
(or calls the proxy) can send photos to the trash and manage the albums, with no login or PIN, by
the owner's choice. Keep the proxy on the local network only.

## What stays forbidden

Everything else under `/api`, and in particular:

- `GET /api/assets/{id}/original` and `/api/download/...`: the original files;
- `GET /api/assets/{id}/video/playback`: the videos (Mirante leaves videos out);
- `/api/assets/{id}/thumbnail` with `size=fullsize` or `size=original`;
- any `PUT`, `PATCH` or `DELETE`, and any `POST`, but the changes above with their exact bodies
  (and the three `POST` that read): uploads, edits, favorites, archives, deletions for good
  (`"force": true`, `POST /api/trash/empty`), shared albums and links, keys, users;
- every change, when the proxy holds no key for them.

## CORS, for the packaged apps

The webOS and Tizen apps load from the TV's file system, another origin than the proxy, so the
proxy answers CORS for `/api`:

- `Access-Control-Allow-Origin: *` on every answer;
- a `204` to the preflight `OPTIONS`, with
  `Access-Control-Allow-Methods: GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS` (**new**: `PUT`,
  `PATCH` and `DELETE`, for the changes) and `Access-Control-Allow-Headers: Content-Type` (the
  searches and the changes send a JSON body).

Mirante sends no other header (never `x-api-key`: the proxy adds it) and no cookie. The images load
as plain `<img src>`, which needs no CORS. Served from the proxy itself (the browser install), the
app is on the same origin and needs none of this, but it does no harm.

## A Caddyfile

Mirante's `dist/` in `/srv/mirante`, Immich at `127.0.0.1:2283`, the read key in the environment
variable `IMMICH_API_KEY` of the Caddy process and, to manage the library, the key of the changes
in `IMMICH_WRITE_API_KEY` (never in the file if the file is shared). Adapt the port, the folder and
the address of Immich (in Docker, the name of its container: `immich_server:2283`). Without
`IMMICH_WRITE_API_KEY`, the routes of the changes send an empty key, which Immich refuses: Mirante
reads only. To leave them out entirely, delete the part between the two `---` comments (and
`PUT, PATCH, DELETE` from the preflight).

```caddyfile
# Immich with the key of the reads: defined first, imported by each route that reads.
(immich) {
	reverse_proxy 127.0.0.1:2283 {
		header_up x-api-key {$IMMICH_API_KEY}
	}
}

# Immich with the key of the changes: imported by the routes of the changes alone.
(immich_changes) {
	reverse_proxy 127.0.0.1:2283 {
		header_up x-api-key {$IMMICH_WRITE_API_KEY}
	}
}

:8085 {
	# The answers of /api cross origins for the packaged apps (file://).
	header /api/* Access-Control-Allow-Origin *

	@preflight {
		method OPTIONS
		path /api/*
	}
	handle @preflight {
		header Access-Control-Allow-Methods "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS"
		header Access-Control-Allow-Headers "Content-Type"
		respond 204
	}

	# The bodies Mirante sends are small; a larger one is refused before it is read.
	request_body /api/* {
		max_size 1MB
	}

	@reads {
		method GET
		path /api/server/version /api/server/features /api/albums /api/timeline/buckets /api/timeline/bucket
	}
	handle @reads {
		import immich
	}

	@key_check {
		method POST
		path /api/auth/validateToken
	}
	handle @key_check {
		import immich
	}

	# The two searches, which only read: the random draw and the search by date.
	@searches {
		method POST
		path /api/search/random /api/search/metadata
	}
	handle @searches {
		import immich
	}

	# The detail of one photo, for its caption: GET only (PUT edits it).
	@asset {
		method GET
		path_regexp ^/api/assets/[0-9a-fA-F-]+$
	}
	handle @asset {
		import immich
	}

	# The images, in the two small sizes only: never fullsize or the original.
	@images {
		method GET
		path_regexp ^/api/assets/[0-9a-fA-F-]+/thumbnail$
		query size=thumbnail size=preview
	}
	handle @images {
		import immich
	}

	# --- The changes: each with its method, its path and its whole body, nothing else. ---

	# What the key of the changes may do (Immich asks no permission to tell).
	@changes_key {
		method GET
		path /api/api-keys/me
	}
	handle @changes_key {
		import immich_changes
	}

	# Photos to the trash, never for good: the ids, and "force": false.
	@trash {
		method DELETE
		path /api/assets
		expression `{http.request.body}.matches(r'^\{"ids":\["[0-9a-fA-F-]{36}"(,"[0-9a-fA-F-]{36}")*\],"force":false\}$')`
	}
	handle @trash {
		import immich_changes
	}

	# Photos back from the trash: the ids.
	@restore {
		method POST
		path /api/trash/restore/assets
		expression `{http.request.body}.matches(r'^\{"ids":\["[0-9a-fA-F-]{36}"(,"[0-9a-fA-F-]{36}")*\]\}$')`
	}
	handle @restore {
		import immich_changes
	}

	# A new album: its name, and the photos it starts with (maybe none).
	@album_create {
		method POST
		path /api/albums
		expression `{http.request.body}.matches(r'^\{"albumName":"([^"\\]|\\.)*","assetIds":\[("[0-9a-fA-F-]{36}"(,"[0-9a-fA-F-]{36}")*)?\]\}$')`
	}
	handle @album_create {
		import immich_changes
	}

	# A new name for an album: the name alone.
	@album_rename {
		method PATCH
		path_regexp ^/api/albums/[0-9a-fA-F-]{36}$
		expression `{http.request.body}.matches(r'^\{"albumName":"([^"\\]|\\.)*"\}$')`
	}
	handle @album_rename {
		import immich_changes
	}

	# An album deleted, its photos kept: no body.
	@album_delete {
		method DELETE
		path_regexp ^/api/albums/[0-9a-fA-F-]{36}$
		expression `{http.request.body} == ''`
	}
	handle @album_delete {
		import immich_changes
	}

	# Photos added to an album, or taken out of it: the ids.
	@album_photos {
		method PUT DELETE
		path_regexp ^/api/albums/[0-9a-fA-F-]{36}/assets$
		expression `{http.request.body}.matches(r'^\{"ids":\["[0-9a-fA-F-]{36}"(,"[0-9a-fA-F-]{36}")*\]\}$')`
	}
	handle @album_photos {
		import immich_changes
	}

	# Every other route of Immich, and any other body: originals, videos, downloads, anything else
	# that writes, a deletion for good.
	handle /api/* {
		respond 403
	}

	# The app itself, for the browser of the TV.
	handle {
		root * /srv/mirante
		file_server
	}
}
```

The `handle` blocks are mutually exclusive: a route of `/api` that matches none of the allowed ones
(or matches one with another body) ends on the `403`, and the last block, without a matcher, serves
the app. Caddy reads the body for `{http.request.body}` and still sends it whole to Immich. The
reads of this file were checked with Caddy v2.11.8 against a fake Immich: every route of the table
answers with the key added, the forbidden ones above answer `403`, and the preflight answers `204`
with the CORS headers. The changes were checked with Caddy v2.11.9 against an upstream that echoes
what reaches it: each of the seven changes and `GET /api/api-keys/me` reach it with the key of the
changes and the body untouched, the reads with the read key, a `"force": true`, a missing `force`,
fields in another order, extra fields (`albumUsers`, `description`, `order`, a cover), an empty
list of ids, `POST /api/trash/empty`, `PUT /api/assets` and the routes of keys and users answer
`403`, a body over 1 MB `413`, and without `IMMICH_WRITE_API_KEY` the changes reach Immich with an
empty key.

When Mirante starts using a new route, or sends another body, this page and `CHANGELOG.md` say
so, and the proxy needs the same change before the new version reaches the TV.
