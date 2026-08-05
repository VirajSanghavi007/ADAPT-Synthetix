# Contributing

## Verifying a Docker rebuild actually landed

`docker compose build` exiting 0 does not prove the new code is running — a
cached layer, a stale tag, or a build that silently reused an old image can all
report success without the change actually being inside the container. This bit
us at least once (see `docs/MEMORY.md`, local-only).

Before treating any rebuild as done:

```bash
docker compose build <service>
docker compose up -d <service>
docker compose exec <service> grep -r "<some string unique to your change>" <path inside the container>
```

If the grep finds nothing, the rebuild didn't land — rebuild without cache
(`docker compose build --no-cache <service>`) and check again. This is cheap and
has already caught a false-positive "complete" rebuild once; do it every time,
not just when something looks wrong.
