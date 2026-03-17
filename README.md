# Open Fireside

Open Fireside is a shell-first React/Vite workspace.

Current repo state:
- `Dashboard` is wired to live BCWS public wildfire and evacuation endpoints
- `Incidents` is wired to the live BCWS public incident list and internal detail route
- `Configure > Sources` preserves the factual BCWS perimeter widget
- `Weather`, `Maps`, and `Discourse` remain blank shell surfaces

## Run

```bash
npm install
npm run dev
```

Open:
- `http://127.0.0.1:5173/#/dashboard`
- `http://127.0.0.1:5173/#/incidents`

## Notes

- The app only keeps factual endpoint-backed dashboard and incident views.
- Stubbed dashboard panels are limited to `Discourse Signals` and `Incidents (pinned)`.
- No fabricated summaries or placeholder data panels should be added.
