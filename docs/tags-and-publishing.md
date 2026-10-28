# Tags and automatic publishing of the CITCOM Marketplace

This repo does not publish anything by itself. Its **git tags** are consumed by the
[Marketplace-business_ecosystem_logic_proxy](https://github.com/CitComAI-Hub/Marketplace-business_ecosystem_logic_proxy)
repo (the "proxy"), whose workflow
[`publish-citcom.yml`](https://github.com/CitComAI-Hub/Marketplace-business_ecosystem_logic_proxy/blob/feat/citcom/.github/workflows/publish-citcom.yml)
builds this frontend and ships it inside the Docker image
`ghcr.io/citcomai-hub/citcom-marketplace:<tag>`.

The full description of the publishing process lives in the proxy repo
([docker/README.md](https://github.com/CitComAI-Hub/Marketplace-business_ecosystem_logic_proxy/blob/feat/citcom/docker/README.md#custom-image-for-citcom-marketplace)).
This document explains the frontend's side of it.

## The contract: same tag in both repos

| Repo | Branch | Tag |
|------|--------|-----|
| `vrain_BAE-Frontend` (this one) | `feat/citcom` | `vX.Y.Z` |
| `Marketplace-business_ecosystem_logic_proxy` | `feat/citcom` | `vX.Y.Z` (**identical name**) |

The tag name is the version of the published image. The proxy workflow checks out this
repo at the tag **with the same name** as the one that triggered it, so the frontend
tag is what decides which frontend code ends up in the image.

## What happens when the proxy tag is pushed

```
push tag vX.Y.Z (proxy repo)
  1. Check the tagged commit belongs to proxy feat/citcom    -> fails otherwise
  2. Checkout vrain_BAE-Frontend at ref vX.Y.Z               -> fails if the tag doesn't exist here
  3. docker compose run --rm build-frontend                  -> dist/bae-frontend
  4. Replace proxy docker/proxy-themes/bae-frontend with that output
  5. Build docker/Dockerfile (linux/amd64 + linux/arm64)
  6. Push ghcr.io/citcomai-hub/citcom-marketplace:vX.Y.Z
```

Pushing a tag here does **not** trigger anything. Only the proxy tag starts the pipeline.

### What this repo must provide

- The `build-frontend` service in [docker-compose.yml](../docker-compose.yml): builds the
  `build` stage of the [Dockerfile](../Dockerfile) and runs
  `npm run build -- --configuration production`, writing the result to `./dist`
  (mounted volume).
- The output at `dist/bae-frontend/index.html`. The workflow fails if it is missing, so
  don't change the Angular `outputPath` or the service's volume/command without updating
  the proxy workflow.

If either changes, update `publish-citcom.yml` in the proxy repo too.

## Publishing a new version

1. Merge/push your changes to `feat/citcom` in **both** repos.
2. Tag **this** repo first and push the tag:
   ```bash
   git tag v1.2.0
   git push origin v1.2.0
   ```
3. Tag the proxy repo with the same name, on a commit of its `feat/citcom` that is already pushed:
   ```bash
   cd ../Marketplace-business_ecosystem_logic_proxy
   git tag v1.2.0
   git push origin v1.2.0
   ```
4. Follow the run in the *Actions* tab of the proxy repo. When it finishes, the image
   `citcom-marketplace:v1.2.0` is in the registry.

Rules:

- **Frontend tag before proxy tag.** If it doesn't exist when the workflow runs, the checkout step fails.
- **Never move or reuse a published tag.** If something goes wrong, create a new one (`v1.2.1`).
- A frontend change that is not tagged here is not published, even if the proxy is tagged.
- Only commits in the proxy's `feat/citcom` can be published; the frontend tag has no such
  check, so tag a commit that is on this repo's `feat/citcom`.

The current latest tag is `v1.0.1`. List them with `git tag -l`.

## Access requirements (configured once, in the proxy repo)

- **Package write access**: the proxy repo needs the *Write* role on the `citcom-marketplace`
  package (*Manage Actions access*), or the push fails with `permission_denied: write_package`.
- **Private frontend**: if this repo is private, the proxy repo needs a `FRONTEND_REPO_TOKEN`
  secret with read access to it, since the default `GITHUB_TOKEN` can't read other repos.

## Not to be confused with `notify-compatibility.yml`

[`.github/workflows/notify-compatibility.yml`](../.github/workflows/notify-compatibility.yml)
is a **different** automation, unrelated to the CITCOM image:

| | CITCOM image publishing | `notify-compatibility.yml` |
|---|---|---|
| Trigger | Tag pushed in the **proxy** repo | **GitHub Release published** in this repo (or manual dispatch) |
| Lives in | Proxy repo | This repo |
| Result | Docker image in `ghcr.io/citcomai-hub/citcom-marketplace` | PR in `FIWARE-TMForum/Business-API-Ecosystem` bumping `stacks[].front` in `stack.yml` |

Creating a plain git tag does not fire `notify-compatibility.yml`; it only runs when a
GitHub Release is published (it uses the release's `tag_name` as the version, stripping a
leading `v`). Don't publish a release for CITCOM-only versions unless you also want a
PR opened against the upstream FIWARE umbrella repo (it needs the `UMBRELLA_REPO_PAT`
or `COMPAT_REPO_PAT` secret).

## Manual build (without the workflow)

```bash
# In this repo
docker compose run --rm build-frontend

# In the proxy repo
rm -rf docker/proxy-themes/bae-frontend
cp -r ../vrain_BAE-Frontend/dist/bae-frontend docker/proxy-themes/bae-frontend
docker build -t test_citcom-marketplace:v0.3 -f docker/Dockerfile .
```
