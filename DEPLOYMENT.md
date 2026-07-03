# HemLabdhi jewells deployment

This project is a Node/Express app that serves the website and API from `server/server.js`.

## Recommended host

Use a Node host with persistent disk storage, such as Render, Railway, or a VPS. Pure static hosts are not enough because this app has login, admin, orders, OTP, and a SQLite database file.

## Render deployment

1. Push this `jewellery` folder to a GitHub repository.
2. In Render, create a new Blueprint from the repository.
3. Render will read `render.yaml`.
4. Add these secret environment variables when Render asks:

```text
JWT_SECRET=<random string at least 32 characters>
ADMIN_PASSWORD=<your admin password, at least 8 characters>
CLIENT_PASSWORD=<default client password, at least 8 characters>
CORS_ORIGINS=https://your-render-domain.onrender.com
```

5. Deploy.
6. Open the public Render URL.

## Important OTP note

In local development, checkout shows a demo OTP on the page. In production (`NODE_ENV=production`), demo OTP is hidden. Before real customers use checkout, connect an SMS or WhatsApp OTP provider. Without that provider, customers cannot receive the OTP.

## After deploy

- Admin URL: `https://your-domain/admin.html`
- Admin email comes from `ADMIN_EMAIL` in `render.yaml`.
- Products/prices are initialized on startup by `npm run deploy:init`.
- Database file is stored at `DB_PATH=/var/data/pavanart.db` on Render's persistent disk.
