# Custom Umbrel Community App Store

This repository is a multi-app Community App Store for umbrelOS, based on the official [Umbrel Community App Store template](https://github.com/getumbrel/umbrel-community-app-store).

- Store ID: `custom-store`
- Display name: `Custom` (shown by Umbrel as **Custom App Store**)
- Current package: Reclip (`custom-store-reclip/`)

## Package convention

Each app lives in a top-level folder named exactly like its app ID. IDs must start with `custom-store-`; for example, a future Maigret package would use `custom-store-maigret/` and `id: custom-store-maigret`.

## Add this store to Umbrel

In the Umbrel App Store, open **Community App Stores** and add:

`https://github.com/dyo51/umbrel-reclip-store`

Then open **Custom App Store** to browse its packages. Apps are installed individually through Umbrel's app manager; running a container manually does not add a Home tile.
