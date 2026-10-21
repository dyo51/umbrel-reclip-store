# Custom Umbrel Community App Store

This repository is a multi-app Community App Store for umbrelOS, based on the official [Umbrel Community App Store template](https://github.com/getumbrel/umbrel-community-app-store).

- Store ID: `custom-store`
- Display name: `Custom` (shown by Umbrel as **Custom App Store**)
- Packages: Reclip (`custom-store-reclip/`) and Maigret (`custom-store-maigret/`).
- Reclip image: `ghcr.io/dyo51/custom-store-reclip:upstream-1d161d15a4fe93d9b3371377f0a421dc3e965b10`, built from a pinned upstream commit by GitHub Actions.
- Maigret image: official `soxoj/maigret:web`, pinned to the verified multi-architecture digest for upstream commit `eaf820666d15bfd545129f3223e2261c27191e74`.

## Package convention

Each app lives in a top-level folder named exactly like its app ID. IDs must start with `custom-store-`; for example, Maigret uses `custom-store-maigret/` and `id: custom-store-maigret`.

## Add this store to Umbrel

In the Umbrel App Store, open **Community App Stores** and add:

`https://github.com/dyo51/umbrel-reclip-store`

Then open **Custom App Store** to browse its packages. Apps are installed individually through Umbrel's app manager; running a container manually does not add a Home tile.
