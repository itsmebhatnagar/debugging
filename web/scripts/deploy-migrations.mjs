import { spawnSync } from "node:child_process"
import path from "node:path"

const migrationName = "20261027180000_admin_auth_state"
const migrationFile = path.join(
  "prisma",
  "migrations",
  migrationName,
  "migration.sql",
)

function runPrisma(args, options = {}) {
  const result = spawnSync("npx", ["prisma", ...args], {
    encoding: "utf8",
    shell: process.platform === "win32",
    ...options,
  })

  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  return result
}

const deploy = runPrisma(["migrate", "deploy"])
if (deploy.error) throw deploy.error
if (deploy.status === 0) process.exit(0)

const output = `${deploy.stdout || ""}\n${deploy.stderr || ""}`
if (!output.includes("P3005")) {
  process.exit(deploy.status || 1)
}

console.log(
  "Existing database has no Prisma migration baseline; applying the admin-auth migration and recording it as the baseline.",
)

const applyBaseline = runPrisma([
  "db",
  "execute",
  "--file",
  migrationFile,
  "--schema",
  "prisma/schema.prisma",
])
if (applyBaseline.error) throw applyBaseline.error
if (applyBaseline.status !== 0) process.exit(applyBaseline.status || 1)

const resolveBaseline = runPrisma([
  "migrate",
  "resolve",
  "--applied",
  migrationName,
])
if (resolveBaseline.error) throw resolveBaseline.error
if (resolveBaseline.status !== 0) process.exit(resolveBaseline.status || 1)

const verifyDeploy = runPrisma(["migrate", "deploy"])
if (verifyDeploy.error) throw verifyDeploy.error
if (verifyDeploy.status !== 0) process.exit(verifyDeploy.status || 1)
