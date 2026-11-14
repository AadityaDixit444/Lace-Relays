# Lace Relays

A shoe price comparison and discovery platform.

## Project Status

Approved Template A is implemented as a private web pilot. Live provider access,
persistent price history and community review still require configuration and
backend work; sample prices are clearly labelled.

## Development

Requires Node.js 20.9+ and pnpm. Run `pnpm install`, then `pnpm dev`.
Open http://localhost:3000.

The responsive Lavender Paper design uses Next.js, React, TypeScript and Tailwind.
Collection prices and history are labelled sample data. Saved pairs and community
drafts stay on the current device.

See [implementation notes](docs/IMPLEMENTATION.md) for live discovery setup,
current limitations, security checks and Vercel deployment.

## Verification

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:security`,
`pnpm audit --prod` and `pnpm build`.
