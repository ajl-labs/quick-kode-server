# QuickKode Server Component

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/templates/tree/main/nodejs-http-server-template)


A Cloudflare server component designed to support the [QuickKode](https://github.com/ajl-labs/quick-kode) mobile app. It acts as a webhook endpoint to capture transaction messages, uses AI to analyze and extract transaction details, enables updating transactions, and provides APIs to fetch the latest transaction balance. This integration streamlines transaction management and analysis for QuickKode users.

## Quick Start

1. **Install dependencies:**

   ```bash
   yarn install
   ```

2. **Run locally:**

   ```bash
   yarn dev
   ```

3. **Deploy to Cloudflare Workers:**
   ```bash
   yarn wrangler deploy
   ```


## Scripts

- `npm start` - Start the server
- `npm run dev` - Start with hot reload
- `yarn migration --help` - See available database migration related commands
