# MeetFlow Studio

MeetFlow Studio turns pasted meeting notes into explicit action items and a follow-up email. It is a single-page Next.js App Router app built with TypeScript, Tailwind CSS and shadcn/ui.

## Run locally

Install dependencies with `pnpm install`, then start the dev server with `pnpm dev`. Set `ADAPTION_API_KEY` for the server through a secret manager or a local `.env.local`; never place it in client code or commit it. `.env.local` is ignored by Git.

The server calls Adaption’s Responses API at `https://api.prod.adaptionlabs.ai/api/v1/responses` with model `qwen3.5-397b`. Each request is non-persistent (`store: false`). The server runs three sequential model requests and streams newline-delimited JSON progress events to the browser. See Adaption’s [quickstart](https://docs.adaptionlabs.ai/inference-stacks/quickstart/) and [Responses API reference](https://docs.adaptionlabs.ai/api/resources/responses/methods/create/).

**Hackathon note:** the BharatCode Build League page says BharatCode powers app model calls and describes Adaption credits as training credits. This Adaption-backed version may not satisfy that requirement. Confirm with the organizers or use a BharatCode model key before submission: [Build League details](https://bharatcode.ai/hackathon).

No conversation history is stored across reloads. The app does not include accounts, a dark-mode toggle, or copy-to-clipboard controls.
