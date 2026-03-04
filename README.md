# BBO Screenshot Server

## Deploy Options (pick one):

### Option 1: Railway (easiest, free tier available)
1. Install Railway CLI: `npm install -g @railway/cli`
2. `railway login`
3. `railway init`
4. `railway up`
5. Get your URL: `railway domain`

### Option 2: Fly.io (generous free tier)
1. Install flyctl: `curl -L https://fly.io/install.sh | sh`
2. `fly auth signup` (or login)
3. `fly launch --name bbo-screenshot`
4. `fly deploy`

### Option 3: Any VPS (DigitalOcean, etc)
1. Install Docker on the VPS
2. `docker build -t bbo-screenshot .`
3. `docker run -p 3456:3456 bbo-screenshot`

### Option 4: Render.com
1. Push to GitHub
2. New Web Service → connect repo
3. Build Command: `npm install`
4. Start Command: `node server.js`

## Test it:
```bash
curl -X POST https://YOUR-URL/screenshot \
  -H "Content-Type: application/json" \
  -d '{"url":"https://contentboard.com.ar","viewports":[320,768]}'
```

## Environment Variables:
- `PORT` — server port (default 3456)

## Usage from BBO extension:
Set your server URL in the extension settings.
The extension will call POST /screenshot with the Bubble preview URL.
