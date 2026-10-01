# Zhiti Atlas

[中文](README.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Releases](https://github.com/zbyisredeemer/3D-person-part-cure-sys/releases)

An interactive, Chinese-language 3D human anatomy and health education application built with React, TypeScript, Three.js and a Node.js API. Explore anatomical structures, organ profiles, symptom illustrations, 64 disease topics and 7 medication summaries. A local educational assistant works without an API key; a server-side online AI adapter is optional.

**Educational demonstration only.** This is not a clinically validated product, diagnostic tool or substitute for professional medical care. Model registration and semantic groupings have limitations; professional anatomical and medical review is still needed.

## Quick start

Use Node.js 22.12+ (Node.js 22 recommended):

```bash
git clone https://github.com/zbyisredeemer/3D-person-part-cure-sys.git
cd 3D-person-part-cure-sys
npm ci
npm run dev
```

Open http://localhost:5173. No API key is required.

```bash
npm run check  # tests, type checking, production build and HTTP smoke checks
npm start      # after building; serves UI and API at http://127.0.0.1:8787
```

With Docker Engine/Desktop and Compose 2.24+:

```bash
bash scripts/docker.sh up
```

Open http://localhost:8080. The default published port is loopback-only. Optional configuration examples are `.env.example` (Node) and `.env.docker.example` (Docker).

## Optional online AI and privacy

Set `OPENAI_API_KEY` and `OPENAI_MODEL` on the server to enable a compatible Responses API. Never use `VITE_*` variables for secrets. Questions and context are sent to the configured provider only in online mode; locally detected urgent signals bypass that call. Online behavior is tested with a simulated provider; paid live calls are not part of CI.

There is no user authentication or billing quota system. Keep online AI disabled for an unauthenticated public demo, or add authentication, per-user quotas and a total spending limit at a gateway before exposing it. Origin checks are not authentication. Read [SECURITY.md](SECURITY.md).

Favorites are stored in browser localStorage. Questions are not persisted by the application. External providers and deployment infrastructure may have their own retention policies. Optional Google Fonts requests contact a third party. See [privacy and medical boundaries](docs/PRIVACY.md).

## Licenses

Original application code, scripts and documentation are [MIT licensed](LICENSE). **This does not apply to the complete anatomical asset bundle.**

| Component | License / scope |
| --- | --- |
| Human Atlas / BodyParts3D core | CC BY 4.0; Human Atlas reference application code is MIT |
| Retained skin models | CC BY-SA 2.1 Japan |
| Z-Anatomy supplements and historical models | CC BY-SA 4.0 with upstream component notices including CC BY-NC and CC BY-NC-SA |
| Draco decoder | Apache-2.0 |

Commercial clearance has not been established for every legacy mesh. Preserve applicable attribution, share-alike and noncommercial terms. See [NOTICE](NOTICE) and [full attribution](public/models/ATTRIBUTION.md). Production builds include third-party dependency license texts.

## Development

- `src/components/`: anatomy scene and knowledge UI.
- `src/data/medical.ts`: curated educational content and source links.
- `server/`: API, local/online mode and response validation.
- `public/models/`: bundled models, provenance and preprocessing scripts.
- `tests/`: content, geometry, catalog, API and deployment checks.

Contributions and source-backed corrections are welcome through Issues and Pull Requests. See [CONTRIBUTING.md](CONTRIBUTING.md). `private: true` prevents accidental npm publication; the repository is public and its original code is MIT licensed.
