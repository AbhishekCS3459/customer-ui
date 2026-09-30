# customer-ui

This is a [Next.js](https://nextjs.org) project bootstrapped with [v0](https://v0.app).

## Built with v0

This repository is linked to a [v0](https://v0.app) project. You can continue developing by visiting the link below -- start new chats to make changes, and v0 will push commits directly to this repo. Every merge to `main` will automatically deploy.

[Continue working on v0 →](https://v0.app/chat/projects/prj_IJOo8ndpzOTi9sujSkx057IJoYI7)

## Getting Started

This is the customer marketplace: search a product near a location, compare
nearby stores, open a store or a product at a store. It talks to the Find Me
backend's public `/api/marketplace` endpoints.

1. Start the backend (`make run` in `backend/`).
2. Optionally `cp .env.example .env.local` to point at another API or turn on debug quantities.

The browser calls `/api/*` on this app, and `next.config.mjs` proxies it to
`BACKEND_URL`: the local API in `.env.development`, the Azure API
(`https://find-me-api.azurewebsites.net`, same as retailer-ui) in `.env.production`.
3. Run the UI:

```bash
pnpm dev
```

Open [http://localhost:3002](http://localhost:3002). The default location is
Koramangala, Bengaluru (12.9352, 77.6245), the marketplace demo seed's test point.

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.
