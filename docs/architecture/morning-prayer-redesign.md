# Morning Prayer Publishing Architecture

Morning Prayer is generated and published through the repository-owned publish contracts. Its text and audio settings live in `config/publish/contracts/`, audio artifacts and sidecars are written locally, and the shared pipeline rebuilds the podcast feed from those artifacts.

The publish workflow handles rendering, state persistence, audio storage, and RSS generation. GitHub Pages stages the daily prayer home, podcast feed assets, and today's phone wallpaper from OneDrive when available. See [Local Episode Contracts](local-episode-contracts.md) for the state schema and [the publish workflow](../../.github/workflows/publish_audio.yml) for scheduled execution.

Daily prayer text and audio are not sourced from a remote database. Local contracts and generated artifacts are the operational source of truth.
