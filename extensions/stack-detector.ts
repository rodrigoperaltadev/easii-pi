import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import type {
	ProjectProfile,
	DetectedStack,
	InferredProjectCommands,
	PackageManager,
	ProfileName,
	PackageJson,
	MarketplaceSkill,
	LocalSkill,
	SkillSuggestion,
	MarketplaceResult,
	McpServerConfig,
	McpSuggestion,
	CapabilityStatus,
	ProjectCapability,
	ProjectCapabilities,
	SetupPreferences,
	SetupUi,
} from "./types/index.js";

// ─── Tipos ───────────────────────────────────────────────────────────────────

// Types now live in extensions/types/ — see extensions/types/index.ts

// ─── Stack Detection ───────────────────────────────────────────────────────

function readPackageJson(cwd: string): PackageJson | null {
	try {
		const pkgPath = path.join(cwd, "package.json");
		if (!fs.existsSync(pkgPath)) return null;
		const raw = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
		return raw as PackageJson;
	} catch {
		return null;
	}
}

function getDeps(pkg: PackageJson): string[] {
	return [
		...Object.keys(pkg.dependencies ?? {}),
		...Object.keys(pkg.devDependencies ?? {}),
	];
}

function getPackageScripts(cwd: string): Record<string, string> {
	const pkg = readPackageJson(cwd);
	const scripts = pkg?.scripts;
	if (!scripts) return {};
	return scripts;
}

function detectPackageManager(cwd: string): PackageManager {
	if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm";
	if (fs.existsSync(path.join(cwd, "yarn.lock"))) return "yarn";
	if (
		fs.existsSync(path.join(cwd, "bun.lockb")) ||
		fs.existsSync(path.join(cwd, "bun.lock"))
	)
		return "bun";
	return "npm";
}

function commandForScript(opts: {
	packageManager: PackageManager;
	scriptName: string;
}): string {
	switch (opts.packageManager) {
		case "pnpm":
			return `pnpm ${opts.scriptName}`;
		case "yarn":
			return `yarn ${opts.scriptName}`;
		case "bun":
			return `bun run ${opts.scriptName}`;
		case "npm":
		default:
			return `npm run ${opts.scriptName}`;
	}
}

function commandForBinary(opts: {
	packageManager: PackageManager;
	binary: string;
}): string {
	switch (opts.packageManager) {
		case "pnpm":
			return `pnpm exec ${opts.binary}`;
		case "yarn":
			return `yarn ${opts.binary}`;
		case "bun":
			return `bunx ${opts.binary}`;
		case "npm":
		default:
			return `npx ${opts.binary}`;
	}
}

function findScript(
	scripts: Record<string, string>,
	candidates: string[],
): string | null {
	return (
		candidates.find((candidate) => typeof scripts[candidate] === "string") ??
		null
	);
}

function inferProjectCommands(
	cwd: string,
	stack: DetectedStack,
): InferredProjectCommands {
	const packageManager = detectPackageManager(cwd);
	const scripts = getPackageScripts(cwd);

	const unitScript = findScript(scripts, [
		"test",
		"test:unit",
		"unit",
		"jest",
		"vitest",
	]);
	const e2eScript = findScript(scripts, [
		"test:e2e",
		"e2e",
		"maestro",
		"detox",
		"playwright",
	]);
	const typecheckScript = findScript(scripts, [
		"typecheck",
		"type-check",
		"tsc",
		"check-types",
	]);
	const lintScript = findScript(scripts, ["lint", "eslint"]);
	const formatScript = findScript(scripts, ["format", "prettier"]);

	let unitCommand = unitScript
		? commandForScript({ packageManager, scriptName: unitScript })
		: "";
	if (!unitCommand && stack.testFramework === "jest")
		unitCommand = commandForBinary({ packageManager, binary: "jest" });
	if (!unitCommand && stack.testFramework === "vitest")
		unitCommand = commandForBinary({ packageManager, binary: "vitest run" });

	let e2eCommand = e2eScript
		? commandForScript({ packageManager, scriptName: e2eScript })
		: "";
	if (!e2eCommand && stack.e2eFramework === "maestro")
		e2eCommand = "maestro test .maestro";
	if (!e2eCommand && stack.e2eFramework === "playwright")
		e2eCommand = commandForBinary({
			packageManager,
			binary: "playwright test",
		});
	if (!e2eCommand && stack.e2eFramework === "detox")
		e2eCommand = commandForBinary({ packageManager, binary: "detox test" });

	const typecheckCommand = typecheckScript
		? commandForScript({ packageManager, scriptName: typecheckScript })
		: stack.hasTypeScript
			? commandForBinary({ packageManager, binary: "tsc --noEmit" })
			: "";

	return {
		packageManager,
		testCommand: unitCommand,
		unitCommand,
		e2eCommand,
		typecheckCommand,
		lintCommand: lintScript
			? commandForScript({ packageManager, scriptName: lintScript })
			: "",
		formatCommand: formatScript
			? commandForScript({ packageManager, scriptName: formatScript })
			: "",
	};
}

function detectStack(cwd: string): DetectedStack | null {
	const pkg = readPackageJson(cwd);
	if (!pkg) return null;

	const deps = getDeps(pkg);
	const has = (name: string) => deps.includes(name);

	let profile: ProjectProfile = "unknown";
	if (has("expo")) profile = "react-native-expo";
	else if (has("react-native")) profile = "react-native-bare";
	else if (has("next")) profile = "nextjs";
	else if (has("react") && !has("react-native")) profile = "react-web";
	else if (has("phaser")) profile = "gamedev-phaser";
	else if (has("pixi.js") || has("@pixi/app")) profile = "gamedev-pixi";
	else if (pkg["main"] && !has("react")) profile = "node-backend";
	else if ((pkg["types"] || Array.isArray(pkg["files"])) && !has("react"))
		profile = "npm-library";

	const hasTypeScript =
		has("typescript") || fs.existsSync(path.join(cwd, "tsconfig.json"));
	const hasExpoRouter = has("expo-router");
	const hasEAS = fs.existsSync(path.join(cwd, "eas.json"));

	let testFramework: DetectedStack["testFramework"] = "none";
	if (has("jest") || has("jest-expo")) testFramework = "jest";
	else if (has("vitest")) testFramework = "vitest";

	let e2eFramework: DetectedStack["e2eFramework"] = "none";
	if (has("@maestro/cli") || fs.existsSync(path.join(cwd, ".maestro")))
		e2eFramework = "maestro";
	else if (has("detox")) e2eFramework = "detox";
	else if (has("@playwright/test") || has("playwright"))
		e2eFramework = "playwright";

	const stateManagement: string[] = [];
	if (has("zustand")) stateManagement.push("zustand");
	if (has("@reduxjs/toolkit") || has("redux")) stateManagement.push("redux");
	if (has("jotai")) stateManagement.push("jotai");
	if (has("mobx")) stateManagement.push("mobx");
	if (has("@tanstack/react-query") || has("react-query"))
		stateManagement.push("react-query");

	return {
		profile,
		deps,
		hasTypeScript,
		hasExpoRouter,
		hasEAS,
		testFramework,
		e2eFramework,
		stateManagement,
	};
}

// ─── Marketplace Search ─────────────────────────────────────────────────────

const MARKETPLACE_API = "https://openagentskill.com/api/agent";

// Minimum downloads to consider a marketplace skill trustworthy
const MIN_DOWNLOADS = 500;
// Minimum rating (out of 5)
const MIN_RATING = 3.5;

async function searchMarketplace(query: string): Promise<MarketplaceSkill[]> {
	try {
		const url = `${MARKETPLACE_API}/skills?q=${encodeURIComponent(query)}&sort=quality&format=json`;
		const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
		if (!res.ok) return [];

		const data = (await res.json()) as { skills?: MarketplaceResult[] };
		const skills: MarketplaceResult[] = data.skills ?? [];

		return skills
			.filter((s) => {
				const dl = s.downloads ?? 0;
				const rt = s.rating ?? 0;
				return dl >= MIN_DOWNLOADS && rt >= MIN_RATING;
			})
			.slice(0, 3)
			.map((s) => ({
				name: s.name,
				slug: s.slug,
				installCmd:
					s.install_command ?? s.installCommand ?? `npx skills add ${s.slug}`,
				downloads: s.downloads ?? 0,
				rating: s.rating ?? 0,
				description: s.description ?? "",
				source: "marketplace" as const,
			}));
	} catch {
		// timeout o error de red — silencioso, se usa fallback local
		return [];
	}
}

// ─── Profile Queries ───────────────────────────────────────────────────────

function getMarketplaceQueries(stack: DetectedStack): string[] {
	switch (stack.profile) {
		case "react-native-expo":
			return ["expo react native", "react native mobile", "expo router"];
		case "react-native-bare":
			return ["react native mobile", "react native testing"];
		case "nextjs":
			return ["nextjs", "next.js react"];
		case "react-web":
			return ["react frontend", "react best practices"];
		case "gamedev-phaser":
			return ["phaser game development", "javascript game dev"];
		case "gamedev-pixi":
			return ["pixi.js game", "javascript canvas game"];
		case "node-backend":
			return ["node.js backend", "nodejs api"];
		default:
			return [];
	}
}

// Skills locales de fallback (las que creamos en @easii/pi)
function getLocalFallbacks(stack: DetectedStack): LocalSkill[] {
	const local: LocalSkill[] = [];

	if (stack.profile === "react-native-expo") {
		local.push(
			{
				skillName: "expo",
				reason: "Expo SDK, EAS Build, Expo Router, managed/bare workflow",
				source: "local",
			},
			{
				skillName: "react-native",
				reason: "Testing RN, componentes, performance, diferencias iOS/Android",
				source: "local",
			},
		);
		if (stack.e2eFramework === "maestro") {
			local.push({
				skillName: "rn-e2e-maestro",
				reason: "Flujos E2E con Maestro detectado en el proyecto",
				source: "local",
			});
		}
	} else if (stack.profile === "react-native-bare") {
		local.push({
			skillName: "react-native",
			reason: "Native modules, linking, diferencias de plataforma",
			source: "local",
		});
		if (stack.e2eFramework === "maestro") {
			local.push({
				skillName: "rn-e2e-maestro",
				reason: "Flujos E2E con Maestro detectado en el proyecto",
				source: "local",
			});
		}
	}

	return local;
}

// ─── Combined Search ───────────────────────────────────────────────────────

async function buildSuggestions(
	stack: DetectedStack,
): Promise<SkillSuggestion[]> {
	const queries = getMarketplaceQueries(stack);
	const localFallbacks = getLocalFallbacks(stack);

	if (queries.length === 0) return localFallbacks;

	// Search marketplace (first query for the profile)
	const marketplaceResults = await searchMarketplace(queries[0]);

	if (marketplaceResults.length > 0) {
		// Hay resultados del marketplace con calidad suficiente
		// Agregamos skills locales si no hay overlap de tema
		const combined: SkillSuggestion[] = [...marketplaceResults];

		// Always append Easii local skills at the end as "specific knowledge"
		for (const local of localFallbacks) {
			const alreadyCovered = marketplaceResults.some((m) =>
				m.name.toLowerCase().includes(local.skillName.replace(/-/g, " ")),
			);
			if (!alreadyCovered) combined.push(local);
		}

		return combined;
	}

	// No useful results from marketplace → use local skills
	return localFallbacks;
}

// ─── MCP Suggestions ───────────────────────────────────────────────────────

function hasDep(deps: string[], name: string): boolean {
	return deps.includes(name);
}

function hasDepPrefix(deps: string[], prefix: string): boolean {
	return deps.some((dep) => dep === prefix || dep.startsWith(`${prefix}/`));
}

function hasFlutterProject(cwd: string): boolean {
	const pubspecPath = path.join(cwd, "pubspec.yaml");
	if (!fs.existsSync(pubspecPath)) return false;
	try {
		return fs.readFileSync(pubspecPath, "utf-8").includes("flutter:");
	} catch {
		return false;
	}
}

function readConfiguredMcpServerKeys(cwd: string): Set<string> {
	const keys = new Set<string>();
	for (const rel of [".mcp.json", ".pi/mcp.json"]) {
		const configPath = path.join(cwd, rel);
		if (!fs.existsSync(configPath)) continue;
		try {
			const data = JSON.parse(fs.readFileSync(configPath, "utf-8")) as {
				mcpServers?: Record<string, unknown>;
			};
			for (const key of Object.keys(data.mcpServers ?? {})) {
				keys.add(key.toLowerCase());
			}
		} catch {
			// invalid config — skip
		}
	}
	return keys;
}

function isMcpAlreadyConfigured(
	serverKey: string,
	configured: Set<string>,
): boolean {
	const normalized = serverKey.toLowerCase();
	if (configured.has(normalized)) return true;

	for (const key of configured) {
		if (key.includes(normalized) || normalized.includes(key)) return true;
	}

	return false;
}

function formatMcpEntry(serverKey: string, config: McpServerConfig): string {
	return JSON.stringify(config, null, 2)
		.split("\n")
		.map((line, index) =>
			index === 0 ? `     "${serverKey}": ${line}` : `     ${line}`,
		)
		.join("\n");
}

function getMcpCatalog(stack: DetectedStack, cwd: string): McpSuggestion[] {
	const { deps, profile } = stack;
	const catalog: McpSuggestion[] = [];

	if (profile === "react-native-expo" || hasDep(deps, "expo")) {
		catalog.push({
			serverKey: "expo",
			name: "Expo MCP",
			reason: "Docs del SDK, simulador y flujos locales de Expo",
			config: {
				command: "npx",
				args: ["-y", "expo-mcp@latest"],
				lifecycle: "lazy",
			},
		});
	}

	if (hasDepPrefix(deps, "@supabase") || hasDep(deps, "supabase")) {
		catalog.push({
			serverKey: "supabase",
			name: "Supabase MCP",
			reason: "Tablas, SQL, migraciones y config del proyecto Supabase",
			config: {
				url: "https://mcp.supabase.com/mcp?read_only=true",
			},
			setupHint:
				"OAuth when connecting. Add project_ref to scope to a specific project.",
		});
	}

	if (hasFlutterProject(cwd)) {
		catalog.push({
			serverKey: "dart",
			name: "Dart MCP",
			reason: "Flutter/Dart: analysis, tests, pub and SDK tooling",
			config: {
				command: "dart",
				args: [
					"mcp-server",
					"--experimental-mcp-server",
					"--force-roots-fallback",
				],
				lifecycle: "lazy",
			},
			setupHint: "Requiere Flutter/Dart SDK instalado.",
		});
	}

	if (hasDep(deps, "prisma") || hasDep(deps, "@prisma/client")) {
		catalog.push({
			serverKey: "postgres",
			name: "PostgreSQL MCP",
			reason: "Consultas y schema cuando Prisma apunta a Postgres",
			config: {
				command: "npx",
				args: ["-y", "@modelcontextprotocol/server-postgres"],
				env: { DATABASE_URL: "${DATABASE_URL}" },
				lifecycle: "lazy",
			},
			setupHint:
				"Define DATABASE_URL in your environment or in the server env.",
		});
	} else if (
		hasDep(deps, "pg") ||
		hasDep(deps, "postgres") ||
		hasDep(deps, "@neondatabase/serverless") ||
		hasDep(deps, "drizzle-orm")
	) {
		catalog.push({
			serverKey: "postgres",
			name: "PostgreSQL MCP",
			reason: "SQL queries and schema exploration",
			config: {
				command: "npx",
				args: ["-y", "@modelcontextprotocol/server-postgres"],
				env: { DATABASE_URL: "${DATABASE_URL}" },
				lifecycle: "lazy",
			},
			setupHint:
				"Define DATABASE_URL in your environment or in the server env.",
		});
	}

	if (
		stack.e2eFramework === "playwright" ||
		hasDep(deps, "@playwright/test") ||
		hasDep(deps, "playwright")
	) {
		catalog.push({
			serverKey: "playwright",
			name: "Playwright MCP",
			reason: "Browser automation for E2E and visual debugging",
			config: {
				command: "npx",
				args: ["-y", "@playwright/mcp@latest"],
				lifecycle: "lazy",
			},
		});
	}

	if (
		hasDep(deps, "firebase") ||
		hasDep(deps, "firebase-admin") ||
		fs.existsSync(path.join(cwd, "firebase.json"))
	) {
		catalog.push({
			serverKey: "firebase",
			name: "Firebase MCP",
			reason: "Firestore, Auth, Functions y recursos de Firebase",
			config: {
				command: "npx",
				args: ["-y", "firebase-tools@latest", "mcp"],
				lifecycle: "lazy",
			},
			setupHint: "Requiere firebase login o credenciales de servicio.",
		});
	}

	if (hasDep(deps, "stripe")) {
		catalog.push({
			serverKey: "stripe",
			name: "Stripe MCP",
			reason: "Pagos, customers e intents de Stripe",
			config: {
				command: "npx",
				args: ["-y", "@stripe/mcp@latest"],
				env: { STRIPE_SECRET_KEY: "${STRIPE_SECRET_KEY}" },
				lifecycle: "lazy",
			},
			setupHint: "Define STRIPE_SECRET_KEY in your environment.",
		});
	}

	if (
		profile === "nextjs" ||
		profile === "react-web" ||
		profile === "node-backend"
	) {
		catalog.push({
			serverKey: "context7",
			name: "Context7 MCP",
			reason: "Updated docs for web/Node stack frameworks and libraries",
			config: {
				command: "npx",
				args: [
					"-y",
					"--package=@upstash/context7-mcp@latest",
					"--",
					"context7-mcp",
				],
				lifecycle: "lazy",
			},
		});
	}

	return catalog;
}

function buildMcpSuggestions(
	stack: DetectedStack,
	cwd: string,
): McpSuggestion[] {
	const configured = readConfiguredMcpServerKeys(cwd);
	const seen = new Set<string>();

	return getMcpCatalog(stack, cwd).filter((suggestion) => {
		if (seen.has(suggestion.serverKey)) return false;
		seen.add(suggestion.serverKey);

		return !isMcpAlreadyConfigured(suggestion.serverKey, configured);
	});
}

// ─── Capability Audit ────────────────────────────────────────────────

function readTextIfExists(filePath: string): string {
	try {
		return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
	} catch {
		return "";
	}
}

function hasAnyFile(cwd: string, rels: string[]): boolean {
	return rels.some((rel) => fs.existsSync(path.join(cwd, rel)));
}

function hasGithubWorkflow(cwd: string): boolean {
	const workflowsDir = path.join(cwd, ".github", "workflows");
	if (!fs.existsSync(workflowsDir)) return false;
	try {
		return fs
			.readdirSync(workflowsDir, { withFileTypes: true })
			.some((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name));
	} catch {
		return false;
	}
}

function readGithubWorkflowText(cwd: string): string {
	const workflowsDir = path.join(cwd, ".github", "workflows");
	if (!fs.existsSync(workflowsDir)) return "";
	try {
		return fs
			.readdirSync(workflowsDir, { withFileTypes: true })
			.filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
			.map((entry) => readTextIfExists(path.join(workflowsDir, entry.name)))
			.join("\n");
	} catch {
		return "";
	}
}

function detectStrictTdd(configText: string): ProjectCapability {
	if (!configText) {
		return { status: "missing", summary: "OpenSpec config no detectado" };
	}

	const strictEnabled = /^strict_tdd:\s*true\s*(?:#.*)?$/m.test(configText);
	const hasTestCommand = /test_command:\s*["']?[^"'\s][^\n]*/.test(configText);

	if (strictEnabled && hasTestCommand) {
		return {
			status: "configured",
			summary: "strict_tdd activo con test_command",
		};
	}
	if (strictEnabled || hasTestCommand) {
		return { status: "detected-partial", summary: "partial TDD configuration" };
	}
	return { status: "missing", summary: "strict_tdd no configurado" };
}

function dockerApplies(profile: ProfileName): boolean {
	return (
		profile === "nextjs" ||
		profile === "react-web" ||
		profile === "node-backend"
	);
}

function detectCapabilities(
	cwd: string,
	stack: DetectedStack,
): ProjectCapabilities {
	const commands = inferProjectCommands(cwd, stack);
	const configText = readTextIfExists(
		path.join(cwd, "openspec", "config.yaml"),
	);
	const unitTests: ProjectCapability = commands.unitCommand
		? {
				status: "configured",
				summary: commands.unitCommand,
				details: [
					stack.testFramework !== "none"
						? stack.testFramework
						: "script detectado",
				],
			}
		: stack.testFramework !== "none"
			? {
					status: "detected-partial",
					summary: `${stack.testFramework} detectado sin script claro`,
				}
			: { status: "missing", summary: "unit tests no detectados" };

	const e2eTests: ProjectCapability = commands.e2eCommand
		? {
				status: "configured",
				summary: commands.e2eCommand,
				details: [
					stack.e2eFramework !== "none"
						? stack.e2eFramework
						: "script detectado",
				],
			}
		: stack.e2eFramework !== "none"
			? {
					status: "detected-partial",
					summary: `${stack.e2eFramework} detectado sin comando claro`,
				}
			: { status: "missing", summary: "E2E no detectado" };

	const hasCi =
		hasGithubWorkflow(cwd) ||
		hasAnyFile(cwd, [".gitlab-ci.yml", "bitbucket-pipelines.yml"]);
	const ciText = [
		readGithubWorkflowText(cwd),
		readTextIfExists(path.join(cwd, ".gitlab-ci.yml")),
		readTextIfExists(path.join(cwd, "bitbucket-pipelines.yml")),
	].join("\n");
	const ciRunsQuality =
		/(test|typecheck|type-check|lint|vitest|jest|playwright|maestro)/i.test(
			ciText,
		);
	const ci: ProjectCapability = hasCi
		? ciRunsQuality
			? { status: "configured", summary: "CI detectado con checks de calidad" }
			: {
					status: "detected-partial",
					summary: "CI detectado sin checks claros",
				}
		: { status: "missing", summary: "CI no detectado" };

	const hasCdFile = hasAnyFile(cwd, [
		"vercel.json",
		"netlify.toml",
		"fly.toml",
		"render.yaml",
	]);
	const hasDeployWorkflow =
		/(deploy|release|publish|eas build|vercel|netlify|flyctl|docker push)/i.test(
			ciText,
		);
	const cd: ProjectCapability =
		stack.hasEAS || hasCdFile || hasDeployWorkflow
			? {
					status:
						hasDeployWorkflow || stack.hasEAS
							? "configured"
							: "detected-partial",
					summary: stack.hasEAS
						? "EAS Build detectado"
						: hasDeployWorkflow
							? "workflow de deploy/release detectado"
							: "archivo de plataforma detectado",
				}
			: { status: "missing", summary: "CD/deploy no detectado" };

	const hasDockerfile = fs.existsSync(path.join(cwd, "Dockerfile"));
	const hasCompose = hasAnyFile(cwd, [
		"docker-compose.yml",
		"docker-compose.yaml",
		"compose.yml",
		"compose.yaml",
	]);
	const hasDockerignore = fs.existsSync(path.join(cwd, ".dockerignore"));
	const docker: ProjectCapability = !dockerApplies(stack.profile)
		? { status: "not-applicable", summary: "no evaluado para este perfil" }
		: hasDockerfile
			? {
					status: hasDockerignore ? "configured" : "detected-partial",
					summary: hasDockerignore
						? "Dockerfile + .dockerignore"
						: "Dockerfile sin .dockerignore",
					details: hasCompose ? ["compose detectado"] : undefined,
				}
			: hasCompose
				? {
						status: "detected-partial",
						summary: "compose detectado sin Dockerfile",
					}
				: { status: "missing", summary: "Docker no detectado" };

	return {
		unitTests,
		e2eTests,
		strictTdd: detectStrictTdd(configText),
		ci,
		cd,
		docker,
	};
}

// ─── Report ──────────────────────────────────────────────────────────────────

const PROFILE_LABELS: Record<ProjectProfile, string> = {
	"react-native-expo": "React Native + Expo",
	"react-native-bare": "React Native (bare)",
	nextjs: "Next.js",
	"react-web": "React Web",
	"node-backend": "Node.js Backend",
	"npm-library": "npm library",
	"gamedev-phaser": "Videojuego (Phaser)",
	"gamedev-pixi": "Videojuego (PixiJS)",
	unknown: "Proyecto desconocido",
};

const ANSI = {
	reset: "\u001b[0m",
	bold: "\u001b[1m",
	dim: "\u001b[2m",
	cyan: "\u001b[36m",
	green: "\u001b[32m",
	yellow: "\u001b[33m",
	magenta: "\u001b[35m",
	red: "\u001b[31m",
} as const;

function color(text: string, code: keyof typeof ANSI): string {
	if (process.env.NO_COLOR) return text;
	return `${ANSI[code]}${text}${ANSI.reset}`;
}

function statusIcon(status: CapabilityStatus): string {
	switch (status) {
		case "configured":
			return color("✓", "green");
		case "detected-partial":
			return color("~", "yellow");
		case "missing":
			return color("✗", "red");
		case "not-applicable":
			return color("–", "dim");
	}
}

function formatCapability(
	label: string,
	capability: ProjectCapability,
): string {
	return `  ${statusIcon(capability.status)} ${label}: ${capability.summary}`;
}

function formatStackInfo(stack: DetectedStack): string[] {
	const lines: string[] = [
		`${color("[@easii/pi]", "cyan")} ${color("Stack detected", "bold")}: ${color(PROFILE_LABELS[stack.profile], "green")}`,
	];

	if (stack.hasTypeScript) lines.push(`  ${color("✓", "green")} TypeScript`);
	if (stack.hasExpoRouter) lines.push(`  ${color("✓", "green")} Expo Router`);
	if (stack.hasEAS) lines.push(`  ${color("✓", "green")} EAS Build`);
	if (stack.testFramework !== "none")
		lines.push(`  ${color("✓", "green")} Tests: ${stack.testFramework}`);
	if (stack.e2eFramework !== "none")
		lines.push(`  ${color("✓", "green")} E2E: ${stack.e2eFramework}`);
	if (stack.stateManagement.length > 0)
		lines.push(
			`  ${color("✓", "green")} State: ${stack.stateManagement.join(", ")}`,
		);

	return lines;
}

function formatCapabilitiesReport(capabilities: ProjectCapabilities): string[] {
	const lines: string[] = [
		"",
		color("Detected capabilities", "magenta") +
			color(" — read-only", "dim"),
	];
	lines.push(formatCapability("Unit tests", capabilities.unitTests));
	lines.push(formatCapability("E2E", capabilities.e2eTests));
	lines.push(formatCapability("Strict TDD", capabilities.strictTdd));
	lines.push(formatCapability("CI", capabilities.ci));
	lines.push(formatCapability("CD/deploy", capabilities.cd));
	if (capabilities.docker.status !== "not-applicable") {
		lines.push(formatCapability("Docker", capabilities.docker));
	}
	return lines;
}

function formatSkillsReport(suggestions: SkillSuggestion[]): string[] {
	if (suggestions.length === 0) return [];

	const lines: string[] = [
		"",
		color("Suggested skills", "magenta") +
			color(" — already applicable to this stack", "dim"),
	];

	for (const s of suggestions) {
		if (s.source === "marketplace") {
			lines.push(
				`  ${color("→", "yellow")} ${color("[marketplace]", "dim")} ${s.name}  ★${s.rating.toFixed(1)}  (${s.downloads.toLocaleString()} installs)`,
			);
			lines.push(`     Install: ${s.installCmd}`);
			if (s.description) lines.push(color(`     ${s.description}`, "dim"));
		} else {
			lines.push(
				`  ${color("→", "yellow")} ${color("[@easii/pi]", "dim")} /skill:${s.skillName}  — ${s.reason}`,
			);
		}
	}

	return lines;
}

function formatMcpsReport(mcpSuggestions: McpSuggestion[]): string[] {
	if (mcpSuggestions.length === 0) return [];

	const lines: string[] = [
		"",
		color("Suggested MCPs", "magenta") +
			color(" — entries for mcpServers in .mcp.json or .pi/mcp.json", "dim"),
	];
	for (const mcp of mcpSuggestions) {
		lines.push(
			`  ${color("→", "yellow")} ${color(mcp.name, "bold")}  — ${mcp.reason}`,
		);
		lines.push(formatMcpEntry(mcp.serverKey, mcp.config));
		if (mcp.setupHint) lines.push(color(`     ${mcp.setupHint}`, "dim"));
	}
	lines.push(
		color(
			"  Tip: with pi-mcp-adapter, use /mcp setup to import existing configs.",
			"dim",
		),
	);

	return lines;
}

function buildReport(
	stack: DetectedStack,
	suggestions: SkillSuggestion[],
	mcpSuggestions: McpSuggestion[] = [],
	capabilities?: ProjectCapabilities,
): string {
	const sections = [
		...formatStackInfo(stack),
		...(capabilities ? formatCapabilitiesReport(capabilities) : []),
		...formatSkillsReport(suggestions),
		...formatMcpsReport(mcpSuggestions),
	];

	return sections.join("\n");
}

// ─── Project Setup (SDD schema) ───────────────────────────────────────────

const SCHEMA_BY_PROFILE: Partial<Record<ProjectProfile, string>> = {
	"react-native-expo": "rn-feature",
	"react-native-bare": "rn-feature",
};

function getPackageRoot(): string {
	return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function yamlQuote(value: string): string {
	return JSON.stringify(value);
}

function yamlList(values: string[], indent = "      "): string[] {
	return values.length > 0
		? values.map((value) => `${indent}- ${yamlQuote(value)}`)
		: [`${indent}[]`];
}

function buildStackContextLines(
	stack: DetectedStack,
	commands: InferredProjectCommands,
): string[] {
	const lines: string[] = [
		`Profile: ${PROFILE_LABELS[stack.profile]}`,
		`Package manager: ${commands.packageManager}`,
	];

	if (stack.hasTypeScript) lines.push("TypeScript detected");
	if (stack.hasExpoRouter) lines.push("Expo Router detected");
	if (stack.hasEAS) lines.push("EAS Build detected");
	if (stack.testFramework !== "none")
		lines.push(`Unit test framework: ${stack.testFramework}`);
	if (stack.e2eFramework !== "none")
		lines.push(`E2E framework: ${stack.e2eFramework}`);
	if (stack.stateManagement.length > 0)
		lines.push(`State management: ${stack.stateManagement.join(", ")}`);
	if (commands.testCommand)
		lines.push(`Primary test command: ${commands.testCommand}`);
	if (commands.e2eCommand) lines.push(`E2E command: ${commands.e2eCommand}`);
	if (commands.typecheckCommand)
		lines.push(`Typecheck command: ${commands.typecheckCommand}`);

	return lines;
}

function buildSetupPreferencesLines(preferences?: SetupPreferences): string[] {
	if (!preferences) return [];

	return [
		"  setup_preferences:",
		`    strict_tdd: ${yamlQuote(preferences.strictTdd)}`,
		`    e2e: ${yamlQuote(preferences.e2e)}`,
		`    ci: ${yamlQuote(preferences.ci)}`,
		`    cd: ${yamlQuote(preferences.cd)}`,
		`    docker: ${yamlQuote(preferences.docker)}`,
	];
}

function buildEasiiDetectedConfigBlock(
	schemaName: string,
	stack: DetectedStack,
	commands: InferredProjectCommands,
	preferences?: SetupPreferences,
): string {
	const markers: string[] = [];
	if (stack.hasTypeScript) markers.push("typescript");
	if (stack.hasExpoRouter) markers.push("expo-router");
	if (stack.hasEAS) markers.push("eas-build");
	for (const state of stack.stateManagement) markers.push(`state:${state}`);

	return [
		"# @easii/pi detected configuration — start",
		"easii:",
		"  stack:",
		`    profile: ${yamlQuote(stack.profile)}`,
		`    label: ${yamlQuote(PROFILE_LABELS[stack.profile])}`,
		`    has_typescript: ${stack.hasTypeScript}`,
		`    test_framework: ${yamlQuote(stack.testFramework)}`,
		`    e2e_framework: ${yamlQuote(stack.e2eFramework)}`,
		"    markers:",
		...yamlList(markers, "      "),
		"  sdd:",
		`    suggested_schema: ${yamlQuote(schemaName)}`,
		`    suggested_test_command: ${yamlQuote(commands.testCommand)}`,
		`    suggested_typecheck_command: ${yamlQuote(commands.typecheckCommand)}`,
		"  commands:",
		`    package_manager: ${yamlQuote(commands.packageManager)}`,
		`    unit: ${yamlQuote(commands.unitCommand)}`,
		`    e2e: ${yamlQuote(commands.e2eCommand)}`,
		`    typecheck: ${yamlQuote(commands.typecheckCommand)}`,
		`    lint: ${yamlQuote(commands.lintCommand)}`,
		`    format: ${yamlQuote(commands.formatCommand)}`,
		...buildSetupPreferencesLines(preferences),
		"# @easii/pi detected configuration — end",
	].join("\n");
}

function buildMinimalOpenspecConfig(
	schemaName: string,
	stack: DetectedStack,
	cwd: string,
): string {
	const commands = inferProjectCommands(cwd, stack);
	const contextLines = buildStackContextLines(stack, commands);

	return [
		`schema: ${schemaName}`,
		"strict_tdd: false",
		"context: |",
		"  Project configured by @easii/pi setup-project.",
		...contextLines.map((line) => `  ${line}`),
		"rules:",
		"  proposal:",
		"    require_problem_statement: true",
		"  spec:",
		"    require_acceptance_criteria: true",
		"  design:",
		"    require_tradeoffs: true",
		"  tasks:",
		"    protect_review_workload: true",
		"  apply:",
		`    test_command: ${yamlQuote(commands.testCommand)}`,
		"  verify:",
		`    test_command: ${yamlQuote(commands.testCommand)}`,
		"testing:",
		`  detected: ${yamlQuote(new Date().toISOString().slice(0, 10))}`,
		"  runner:",
		`    command: ${yamlQuote(commands.testCommand)}`,
		`    framework: ${yamlQuote(stack.testFramework === "none" ? "" : stack.testFramework)}`,
		"  layers:",
		`    unit: ${yamlQuote(commands.unitCommand)}`,
		'    integration: ""',
		`    e2e: ${yamlQuote(commands.e2eCommand)}`,
		"  commands:",
		"    unit:",
		...yamlList(commands.unitCommand ? [commands.unitCommand] : []),
		"    integration:",
		...yamlList([]),
		"    e2e:",
		...yamlList(commands.e2eCommand ? [commands.e2eCommand] : []),
		"quality:",
		`  lint: ${yamlQuote(commands.lintCommand)}`,
		`  typecheck: ${yamlQuote(commands.typecheckCommand)}`,
		`  format: ${yamlQuote(commands.formatCommand)}`,
		"",
	].join("\n");
}

function setEmptyRuleTestCommand(
	content: string,
	ruleName: "apply" | "verify",
	testCommand: string,
): { content: string; changed: boolean } {
	if (!testCommand) return { content, changed: false };
	const pattern = new RegExp(
		`(  ${ruleName}:\\n(?:    [^\\n]*\\n)*?    test_command:\\s*)""`,
	);
	const next = content.replace(pattern, `$1${yamlQuote(testCommand)}`);
	return { content: next, changed: next !== content };
}

function getManagedEasiiBlock(content: string): string | null {
	return (
		content.match(
			/# @easii\/pi detected configuration — start\n[\s\S]*?\n# @easii\/pi detected configuration — end/,
		)?.[0] ?? null
	);
}

async function applyDetectedSddHints(
	configPath: string,
	schemaName: string,
	stack: DetectedStack,
	cwd: string,
	ui: SetupUi,
	preferences?: SetupPreferences,
): Promise<string> {
	if (!fs.existsSync(configPath)) return "no changes";

	const commands = inferProjectCommands(cwd, stack);
	const block = buildEasiiDetectedConfigBlock(
		schemaName,
		stack,
		commands,
		preferences,
	);
	const managedBlockPattern =
		/# @easii\/pi detected configuration — start\n[\s\S]*?\n# @easii\/pi detected configuration — end/;

	let content = fs.readFileSync(configPath, "utf-8");
	const existingBlock = getManagedEasiiBlock(content);
	const hadManagedBlock = existingBlock !== null;
	let blockStatus = hadManagedBlock ? "stack unchanged" : "stack added";

	if (existingBlock && existingBlock !== block) {
		const ok = await confirmOrAbort(
			ui,
			"Update SDD hints",
			"openspec/config.yaml already has a @easii/pi block. Recalculate with detected stack? Manual changes inside that block will be replaced.",
		);
		if (ok) {
			content = content.replace(managedBlockPattern, block);
			blockStatus = "stack updated";
		} else {
			blockStatus = "@easii/pi block not modified";
		}
	} else if (!hadManagedBlock) {
		content = `${content.trimEnd()}\n\n${block}\n`;
	}

	const applyResult = setEmptyRuleTestCommand(
		content,
		"apply",
		commands.testCommand,
	);
	content = applyResult.content;
	const verifyResult = setEmptyRuleTestCommand(
		content,
		"verify",
		commands.testCommand,
	);
	content = verifyResult.content;

	fs.writeFileSync(
		configPath,
		content.endsWith("\n") ? content : `${content}\n`,
	);

	const changes = [blockStatus];
	if (applyResult.changed || verifyResult.changed)
		changes.push(`test_command inferido: ${commands.testCommand}`);
	if (!commands.testCommand) changes.push("sin test_command confiable");
	return changes.join("; ");
}

async function ensureSchemaInConfig(
	configPath: string,
	schemaName: string,
	stack: DetectedStack,
	cwd: string,
	ui: SetupUi,
): Promise<string> {
	if (!fs.existsSync(configPath)) {
		fs.mkdirSync(path.dirname(configPath), { recursive: true });
		fs.writeFileSync(
			configPath,
			buildMinimalOpenspecConfig(schemaName, stack, cwd),
		);
		return "creado";
	}

	const content = fs.readFileSync(configPath, "utf-8");
	const match = content.match(/^schema:\s*(.+)$/m);

	if (match) {
		const current = match[1].trim();
		if (current === schemaName) return "no changes (schema already correct)";

		const ok = await confirmOrAbort(
			ui,
			"Change SDD schema",
			`openspec/config.yaml has schema: ${current}. Change to ${schemaName}?`,
		);
		if (!ok) return "schema not modified";

		fs.writeFileSync(
			configPath,
			content.replace(/^schema:\s*.+$/m, `schema: ${schemaName}`),
		);
		return `updated (${current} → ${schemaName})`;
	}

	fs.writeFileSync(configPath, `schema: ${schemaName}\n${content}`);
	return "schema added";
}

async function confirmOrAbort(
	ui: SetupUi,
	title: string,
	message: string,
): Promise<boolean> {
	if (typeof ui.confirm === "function") return ui.confirm(title, message);

	ui.notify(
		`[@easii/pi] ${title}: action cancelled because this version of Pi does not expose ctx.ui.confirm. ${message}`,
		"warning",
	);
	return false;
}

function profileSupportsE2e(stack: DetectedStack): boolean {
	return [
		"react-native-expo",
		"react-native-bare",
		"nextjs",
		"react-web",
	].includes(stack.profile);
}

function recommendedE2eTool(stack: DetectedStack): string {
	return stack.profile === "react-native-expo" ||
		stack.profile === "react-native-bare"
		? "Maestro"
		: "Playwright";
}

async function collectSetupPreferences(
	ui: SetupUi,
	stack: DetectedStack,
	capabilities: ProjectCapabilities,
	commands: InferredProjectCommands,
): Promise<SetupPreferences> {
	const recommendedActions: string[] = [];

	if (capabilities.strictTdd.status !== "configured" && commands.testCommand) {
		recommendedActions.push(`enable strict_tdd with ${commands.testCommand}`);
	}
	if (capabilities.e2eTests.status === "missing" && profileSupportsE2e(stack)) {
		recommendedActions.push(
			`mark ${recommendedE2eTool(stack)} as recommended E2E strategy`,
		);
	}
	if (capabilities.ci.status === "missing")
		recommendedActions.push("mark CI as pending recommendation");
	if (capabilities.cd.status === "missing")
		recommendedActions.push("mark CD/deploy as pending recommendation");
	if (capabilities.docker.status === "missing")
		recommendedActions.push("mark Docker as pending recommendation");

	const applyRecommendations =
		recommendedActions.length > 0
			? await confirmOrAbort(
					ui,
					"Setup recommendations",
					[
						"Found missing capabilities. Apply these recommendations to openspec/config.yaml?",
						"",
						...recommendedActions.map((action) => `- ${action}`),
						"",
						"If you prefer to decide each point manually, choose No.",
					].join("\n"),
				)
			: false;

	const strictTdd =
		capabilities.strictTdd.status === "configured"
			? "configured"
			: !commands.testCommand
				? "missing-runner"
				: applyRecommendations
					? "enable"
					: "skip";

	const e2e =
		capabilities.e2eTests.status === "configured"
			? "configured"
			: capabilities.e2eTests.status === "detected-partial"
				? "detected-partial"
				: !profileSupportsE2e(stack)
					? "not-applicable"
					: applyRecommendations
						? "recommended"
						: "skip";

	const ci =
		capabilities.ci.status === "configured" ||
		capabilities.ci.status === "detected-partial"
			? capabilities.ci.status
			: applyRecommendations
				? "recommended"
				: "skip";

	const cd =
		capabilities.cd.status === "configured" ||
		capabilities.cd.status === "detected-partial"
			? capabilities.cd.status
			: applyRecommendations
				? "recommended"
				: "skip";

	const docker =
		capabilities.docker.status === "not-applicable"
			? "not-applicable"
			: capabilities.docker.status === "configured" ||
					capabilities.docker.status === "detected-partial"
				? capabilities.docker.status
				: applyRecommendations
					? "recommended"
					: "skip";

	return { strictTdd, e2e, ci, cd, docker };
}

function applyStrictTddPreference(
	configPath: string,
	preferences: SetupPreferences,
	commands: InferredProjectCommands,
): string {
	if (
		preferences.strictTdd !== "enable" ||
		!commands.testCommand ||
		!fs.existsSync(configPath)
	)
		return "no changes";

	let content = fs.readFileSync(configPath, "utf-8");
	content = /^strict_tdd:/m.test(content)
		? content.replace(/^strict_tdd:\s*.*$/m, "strict_tdd: true")
		: `strict_tdd: true\n${content}`;

	const applyResult = setEmptyRuleTestCommand(
		content,
		"apply",
		commands.testCommand,
	);
	content = applyResult.content;
	const verifyResult = setEmptyRuleTestCommand(
		content,
		"verify",
		commands.testCommand,
	);
	content = verifyResult.content;

	fs.writeFileSync(
		configPath,
		content.endsWith("\n") ? content : `${content}\n`,
	);
	return `strict_tdd activado con ${commands.testCommand}`;
}

async function runProjectSetup(ctx: {
	cwd: string;
	ui: SetupUi;
}): Promise<void> {
	const stack = detectStack(ctx.cwd);
	if (!stack || stack.profile === "unknown") {
		ctx.ui.notify(
			"[@easii/pi] No compatible stack detected. Is there a package.json in this directory?",
			"warning",
		);
		return;
	}

	const schemaName = SCHEMA_BY_PROFILE[stack.profile];
	if (!schemaName) {
		ctx.ui.notify(
			`[@easii/pi] No SDD schema available yet for ${PROFILE_LABELS[stack.profile]}. Use gentle-pi /sdd-init for now.`,
			"info",
		);
		return;
	}

	const sourceDir = path.join(
		getPackageRoot(),
		"assets",
		"schemas",
		schemaName,
	);
	if (!fs.existsSync(path.join(sourceDir, "schema.yaml"))) {
		ctx.ui.notify(
			`[@easii/pi] Schema not found in package: ${sourceDir}`,
			"error",
		);
		return;
	}

	const destDir = path.join(ctx.cwd, "openspec", "schemas", schemaName);
	const destExists = fs.existsSync(path.join(destDir, "schema.yaml"));
	const configPath = path.join(ctx.cwd, "openspec", "config.yaml");
	const commands = inferProjectCommands(ctx.cwd, stack);
	const capabilities = detectCapabilities(ctx.cwd, stack);

	const okToSetup = await confirmOrAbort(
		ctx.ui,
		"Configure project with @easii/pi",
		[
			`Stack detected: ${PROFILE_LABELS[stack.profile]}`,
			`Suggested SDD schema: ${schemaName}`,
			"",
			"This will:",
			`${destExists ? "- replace" : "- copy"} openspec/schemas/${schemaName}/`,
			`${fs.existsSync(configPath) ? "- update" : "- create"} openspec/config.yaml`,
			"- add stack hints for /sdd-init",
			commands.testCommand
				? `- use inferred test_command: ${commands.testCommand}`
				: "- leave test_command empty because no reliable runner",
			"",
			"Continue?",
		].join("\n"),
	);
	if (!okToSetup) {
		ctx.ui.notify("[@easii/pi] Setup cancelled.", "info");
		return;
	}

	const preferences = await collectSetupPreferences(
		ctx.ui,
		stack,
		capabilities,
		commands,
	);

	if (destExists) {
		const ok = await confirmOrAbort(
			ctx.ui,
			"Replace schema",
			`${schemaName} already exists in openspec/schemas/. Replace with @easii/pi version?`,
		);
		if (!ok) {
			ctx.ui.notify("[@easii/pi] Setup cancelled.", "info");
			return;
		}
		fs.rmSync(destDir, { recursive: true, force: true });
	}

	fs.mkdirSync(path.dirname(destDir), { recursive: true });
	fs.cpSync(sourceDir, destDir, { recursive: true });

	const configStatus = await ensureSchemaInConfig(
		configPath,
		schemaName,
		stack,
		ctx.cwd,
		ctx.ui,
	);
	const strictTddStatus = applyStrictTddPreference(
		configPath,
		preferences,
		commands,
	);
	const sddHintsStatus = await applyDetectedSddHints(
		configPath,
		schemaName,
		stack,
		ctx.cwd,
		ctx.ui,
		preferences,
	);

	const report = [
		`[@easii/pi] Project configured with schema: ${schemaName}`,
		`  ✓ Copied to openspec/schemas/${schemaName}/`,
		`  ✓ openspec/config.yaml — ${configStatus}`,
		`  ✓ strict TDD — ${strictTddStatus}`,
		`  ✓ hints for /sdd-init — ${sddHintsStatus}`,
		"",
		"Next: /sdd-new <change-name> to start a feature.",
		"Optional: /sdd-init to review/adjust test runners and SDD rules.",
	].join("\n");

	ctx.ui.notify(report, "info");
}

// ─── Extension ────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		const stack = detectStack(ctx.cwd);
		if (!stack || stack.profile === "unknown") return;

		const suggestions = await buildSuggestions(stack);
		const mcpSuggestions = buildMcpSuggestions(stack, ctx.cwd);
		const capabilities = detectCapabilities(ctx.cwd, stack);
		const report = buildReport(
			stack,
			suggestions,
			mcpSuggestions,
			capabilities,
		);
		ctx.ui.notify(report, "info");
	});

	pi.registerCommand("easii:stack", {
		description:
			"Detect stack, audit capabilities and suggest relevant skills/MCPs",
		handler: async (_args, ctx) => {
			const stack = detectStack(ctx.cwd);

			if (!stack || stack.profile === "unknown") {
				ctx.ui.notify(
					"[@easii/pi] Could not detect stack. Is there a package.json in this directory?",
					"warning",
				);
				return;
			}

			ctx.ui.notify("[@easii/pi] Searching skills in marketplace...", "info");
			const suggestions = await buildSuggestions(stack);
			const mcpSuggestions = buildMcpSuggestions(stack, ctx.cwd);
			const capabilities = detectCapabilities(ctx.cwd, stack);
			const report = buildReport(
				stack,
				suggestions,
				mcpSuggestions,
				capabilities,
			);
			ctx.ui.notify(report, "info");
		},
	});

	pi.registerCommand("easii:setup-project", {
		description:
			"Copy the correct SDD schema based on detected stack (openspec/schemas + config.yaml)",
		handler: async (_args, ctx) => {
			await runProjectSetup(ctx);
		},
	});
}
