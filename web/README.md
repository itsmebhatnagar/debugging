This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Code execution

Only C, C++, and Java are supported by the arena. Code is compiled and run by a hosted Judge0-compatible service using the [Judge0 CE API](https://ce.judge0.com/) submission and status contract. For each run, the backend reads `/languages`, resolves the latest matching C/GCC, C++/G++, and Java/OpenJDK IDs from that service's catalog, and submits through `POST /submissions?base64_encoded=false&wait=false`. It polls `GET /submissions/{token}?base64_encoded=false` until a terminal Judge0 status is returned. Language IDs are not hardcoded because they are assigned by each instance; real IDs cannot be verified until the deployment URL is configured.

Expected and actual output are compared in the backend after normalizing line endings and whitespace runs (leading/trailing whitespace is ignored; non-whitespace characters and token order must match). All configured public and hidden test cases run on the backend. Only public-case input, expected output, and diagnostics can be returned to participants; hidden test data and per-hidden-case output are not included in responses.

Judge0 status IDs are mapped to Accepted, Wrong Answer, Compilation Error, Runtime Error, Time Limit Exceeded, and Internal Error. A submission is Accepted only if every test case executes successfully and the normalized output matches; Internal Error awards no points. Each request sets 2 seconds CPU time, 1 second extra CPU time, 5 seconds wall time, 128,000 KB memory, 64,000 KB stack, 30 max processes/threads, 1,024 KB maximum file size, and disables network access. The hosted service itself must run Judge0's isolated sandbox (e.g., isolate) with its own worker, process, storage, and request quotas; these request limits do not make an unsandboxed service safe.

Set these exact variables in the **backend/server deployment environment**:

| Variable | Required | Value |
| --- | --- | --- |
| `JUDGE0_API_URL` | Yes | HTTPS base URL for the hosted Judge0-compatible API, including its API prefix if needed (for example, `/api/v1`). Do not include credentials or query-string secrets. |
| `JUDGE0_AUTHN_TOKEN` | No | Judge0 authentication token; sent as `X-Auth-Token`. |
| `JUDGE0_AUTHZ_TOKEN` | No | Judge0 authorization token; sent as `X-Auth-User`. |

Tokens must not use `NEXT_PUBLIC_` names or be placed in frontend settings. Configure the remote instance to provide C, C++, and Java runtimes through `/languages`, honor the documented Judge0 submission/status format and resource-limit fields, enforce network isolation, and allow backend egress to the API. Without `JUDGE0_API_URL`, requests fail with `Compiler service not configured`; network/protocol failures are returned as service errors, never successful or fabricated execution results. No Docker, WSL, or local execution fallback is used.

Run mocked protocol and judging tests with `npm run test:execution`. They validate request formats, catalog-based ID resolution, status handling, polling, output normalization, and resource limits. They do not verify an actual hosted compiler or live language IDs.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
