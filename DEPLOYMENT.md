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

## Vercel deployment

Vercel can run the app using `api/index.js` and `vercel.json`.

1. Import the GitHub repository in Vercel.
2. Keep the project root as the repository root.
3. Add these Environment Variables in Vercel:

```text
NODE_ENV=production
JWT_SECRET=<random string at least 32 characters>
ADMIN_EMAIL=sparshkothari9@gmail.com
ADMIN_PASSWORD=<your admin password, at least 8 characters>
CLIENT_PASSWORD=<default client password, at least 8 characters>
SHOW_DEMO_OTP=false
```

4. For real OTP, add one provider.

MSG91:

```text
OTP_PROVIDER=msg91
MSG91_AUTH_KEY=<your MSG91 auth key>
MSG91_TEMPLATE_ID=<your MSG91 flow/template id>
MSG91_OTP_VAR=var1
```

Twilio:

```text
OTP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=<your Twilio account SID>
TWILIO_AUTH_TOKEN=<your Twilio auth token>
TWILIO_FROM_NUMBER=<your Twilio sender number>
```

For Twilio Messaging Service, use `TWILIO_MESSAGING_SERVICE_SID` instead of `TWILIO_FROM_NUMBER`.

5. Deploy.
6. Open the Vercel production domain.

Vercel functions use read-only project files and writable temporary storage, so this setup stores the SQLite database in `/tmp` and seeds products/prices when the function starts. Use Render/Railway/VPS with persistent storage for real production orders and visitor history.

## Important OTP note

In local development, checkout shows a demo OTP on the page. In production (`NODE_ENV=production`), demo OTP is hidden unless `SHOW_DEMO_OTP=true` is set. Use that only for testing. For real customers, set `OTP_PROVIDER` and the matching provider keys above.

## After deploy

- Admin URL: `https://your-domain/admin.html`
- Admin email comes from `ADMIN_EMAIL` in `render.yaml`.
- Products/prices are initialized on startup by `npm run deploy:init`.
- Database file is stored at `DB_PATH=/var/data/pavanart.db` on Render's persistent disk.
