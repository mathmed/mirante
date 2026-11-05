# The proxy in front of Immich

Mirante never talks to Immich directly. It talks to a reverse proxy that serves the app, sends the
API key to Immich itself (so that no key lives in `config.json` or in a TV package) and lets through
**only the routes Mirante uses**. This page lists them exactly, for the owner to keep the proxy's
allow list in step with the app, and gives a Caddyfile that does it.

## The routes Mirante uses

Every route is under `/api` of the address in `immichUrl`. Nothing else reaches Immich.

| Method | Route                        | What for                                                                                         | Immich permission |
| ------ | ---------------------------- | ------------------------------------------------------------------------------------------------ | ----------------- |
| `GET`  | `/api/server/version`        | the version shown on the start screen; proves the address is Immich                              | none (public)     |
| `POST` | `/api/auth/validateToken`    | proves the key works, at startup; no body, changes nothing                                       | none              |
| `GET`  | `/api/albums`                | the albums, their covers and counts                                                              | `album.read`      |
| `GET`  | `/api/timeline/buckets`      | the months of the timeline, or of an album (`albumId`)                                           | `asset.read`      |
| `GET`  | `/api/timeline/bucket`       | the photos of a month (`timeBucket`), of the timeline or of an album (`albumId`)                 | `asset.read`      |
| `POST` | `/api/search/random`         | **new**: a random draw of the library for its presentation, 200 photos a round (see below)       | `asset.read`      |
| `GET`  | `/api/assets/{id}`           | **new**: the detail of one photo, for its caption (`exifInfo.description`)                       | `asset.read`      |
| `GET`  | `/api/assets/{id}/thumbnail` | the images: `?size=thumbnail` in the grids, `?size=preview` in the viewer; loaded by `<img src>` | `asset.view`      |

Details that matter for the allow list:

- **`POST /api/search/random` only reads.** Immich's searches take their filters as a JSON body,
  hence the `POST`. Mirante sends this body, with `Content-Type: application/json`, once when a
  presentation of the whole library starts and once more for each later round:
  `{"size": 200, "type": "IMAGE", "visibility": "timeline", "withExif": false}`.
- **`GET /api/assets/{id}` is asked for two photos at a time**: the one on the screen and the next
  one, only while a viewer or a presentation shows captions, and each photo once while it is near
  the screen. It never lists the library. Immich answers `PUT` on the same route (it edits the
  photo): allow `GET` only.
- **`/api/assets/{id}/thumbnail` takes a `size`**: Mirante only asks for `thumbnail` and `preview`.
  Immich also answers `size=fullsize` and `size=original` there, which serve the full image: allow
  the two small sizes only.
- An `OPTIONS` preflight comes before the calls of the packaged apps, which load from `file://`, so
  that every call crosses origins; for `POST /api/search/random` it asks to send `Content-Type`.

The key the proxy sends needs `album.read`, `asset.read` and `asset.view`, and nothing more.

## What stays forbidden

Everything else under `/api`, and in particular:

- `GET /api/assets/{id}/original` and `/api/download/...`: the original files;
- `GET /api/assets/{id}/video/playback`: the videos (Mirante leaves videos out);
- `/api/assets/{id}/thumbnail` with `size=fullsize` or `size=original`;
- any `PUT`, `PATCH` or `DELETE`, and any `POST` but the two above: they upload, edit, favorite,
  archive or delete.

## CORS, for the packaged apps

The webOS and Tizen apps load from the TV's file system, another origin than the proxy, so the
proxy answers CORS for `/api`:

- `Access-Control-Allow-Origin: *` on every answer;
- a `204` to the preflight `OPTIONS`, with `Access-Control-Allow-Methods: GET, HEAD, POST, OPTIONS`
  and `Access-Control-Allow-Headers: Content-Type` (**new**: the random draw sends a JSON body).

Mirante sends no other header (never `x-api-key`: the proxy adds it) and no cookie. The images load
as plain `<img src>`, which needs no CORS. Served from the proxy itself (the browser install), the
app is on the same origin and needs none of this, but it does no harm.

## A Caddyfile

Mirante's `dist/` in `/srv/mirante`, Immich at `127.0.0.1:2283`, and the key in the environment
variable `IMMICH_API_KEY` of the Caddy process (never in the file if the file is shared). Adapt the
port, the folder and the address of Immich.

```caddyfile
# Immich with the key: defined first, imported by each allowed route below.
(immich) {
	reverse_proxy 127.0.0.1:2283 {
		header_up x-api-key {$IMMICH_API_KEY}
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
		header Access-Control-Allow-Methods "GET, HEAD, POST, OPTIONS"
		header Access-Control-Allow-Headers "Content-Type"
		respond 204
	}

	@reads {
		method GET
		path /api/server/version /api/albums /api/timeline/buckets /api/timeline/bucket
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

	@random_draw {
		method POST
		path /api/search/random
	}
	handle @random_draw {
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

	# Every other route of Immich: originals, videos, downloads, and anything that writes.
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
ends on the `403`, and the last block, without a matcher, serves the app. This file was checked with
Caddy v2.11.8 against a fake Immich: every route of the table answers with the key added, the
forbidden ones above answer `403`, and the preflight answers `204` with the CORS headers.

When Mirante starts using a new route, this page and `CHANGELOG.md` say so, and the proxy needs the
same change before the new version reaches the TV.
