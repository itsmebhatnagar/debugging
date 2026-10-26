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

Only C, C++, and Java are supported. The backend uses the Docker Engine through the `docker` CLI and fixed compiler images (`gcc:16.2` for C/C++, `eclipse-temurin:25-jdk` for Java). Images are pulled on first use when absent. Every test case gets a fresh container; Java public class names are used as source filenames and launch classes.

Containers have no network, run as UID/GID 10001, use a read-only root filesystem, drop all Linux capabilities, enable `no-new-privileges`, and receive only a size-limited executable tmpfs at `/work`. They have 256 MiB memory, one CPU, 64 processes, CPU/file/open-file limits, a 5-second execution wall timeout, and a 64 KiB combined program-output cap. Source code and test data are sent over Docker CLI stdin; no host directories, Docker socket, app secrets, or host files are mounted into contestant containers. Judge concurrency is limited to four active and twenty queued executions per Node process. Results distinguish accepted, wrong answer, compilation/runtime errors, timeouts, detected memory-limit failures, output-limit failures, and infrastructure errors.

The default line comparator normalizes CR/LF, trims horizontal whitespace per line, and ignores trailing blank lines while preserving meaningful line boundaries. The existing `exact` and `token` modes remain available to configured callers. Problems require at least one server-side test case; hidden cases are evaluated on the backend and are excluded from participant-facing test details. A submission receives the problem's configured points only when all test cases are accepted; the current schema has no explicit partial-credit or per-case weight policy, so failed solutions receive zero.

### Windows / Docker Desktop setup

1. Install Docker Desktop for Windows (for example, `winget install --id Docker.DockerDesktop -e`) and launch it.
2. In Docker Desktop, enable the WSL 2 based engine under **Settings → General** if prompted, then wait until Docker Desktop reports that its engine is running. If Windows asks to enable virtualization or WSL, complete that setup and restart Windows.
3. In PowerShell, verify `docker version` shows both Client and Server and `docker info --format '{{.OSType}}/{{.Architecture}}'` reports a Linux engine. This backend expects Linux containers.
4. From PowerShell, pull/verify compiler images: `docker pull gcc:16.2` and `docker pull eclipse-temurin:25-jdk`.
5. Run the Next.js backend on the Windows host with Docker CLI access (`npm run dev`). If the backend process cannot discover Docker through its inherited `PATH`, set `DOCKER_PATH` to the absolute executable path before starting it: `$env:DOCKER_PATH = (Get-Command docker.exe).Source`. The same setting can be placed in `.env.local`. The backend validates the configured path and performs an Engine health check for each execution; Docker Desktop must remain running.

The application does not claim Docker is ready until its live integration tests have compiled and run the supported toolchains. In PowerShell, run:

```powershell
$env:RUN_DOCKER_TESTS = "1"
npm run test:docker
```

This verifies actual containers, compiler/runtime/wrong-answer handling, cgroup resource limits, time/output limits, and concurrent execution. `npm run test:execution` runs the judging and Judge0 protocol unit tests; the Judge0 tests preserve the unused legacy provider and are mocked, not proof of Docker execution.

Docker containers share the host kernel. The controls above reduce exposure but do not eliminate kernel/container-runtime vulnerabilities; run the backend and Docker daemon on a dedicated, patched host, do not expose the daemon to untrusted users, and consider a stronger isolation runtime (for example, gVisor or a microVM) for a public multi-tenant judge. If the backend itself is containerized, access to the Docker Engine is a privileged host capability and must be isolated from contestant containers.

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
