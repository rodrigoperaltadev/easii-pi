/**
 * Project profile labels for display in reports.
 * @see PROFILE_LABELS in stack-detector.ts
 */
export type ProjectProfile =
	| "react-native-expo"
	| "react-native-bare"
	| "nextjs"
	| "react-web"
	| "node-backend"
	| "npm-library"
	| "gamedev-phaser"
	| "gamedev-pixi"
	| "unknown";

/**
 * Detected project stack metadata.
 * Populated by detectStack() from package.json and filesystem checks.
 */
export interface DetectedStack {
	profile: ProjectProfile;
	deps: string[];
	hasTypeScript: boolean;
	hasExpoRouter: boolean;
	hasEAS: boolean;
	testFramework: "jest" | "vitest" | "none";
	e2eFramework: "maestro" | "detox" | "playwright" | "none";
	stateManagement: string[];
}

/**
 * Inferred project build/test commands per detected stack.
 * Populated by inferProjectCommands() from package.json scripts and lockfile detection.
 */
export interface InferredProjectCommands {
	packageManager: "npm" | "pnpm" | "yarn" | "bun";
	testCommand: string;
	unitCommand: string;
	e2eCommand: string;
	typecheckCommand: string;
	lintCommand: string;
	formatCommand: string;
}

/**
 * Bounded type for package manager values.
 * Alias for InferredProjectCommands["packageManager"].
 * Used as parameter bound in detectPackageManager(), commandForScript(), commandForBinary().
 */
export type PackageManager = InferredProjectCommands["packageManager"];

/**
 * Bounded type for project profile names.
 * Alias for ProjectProfile.
 * Used as parameter bound in dockerApplies() and runProjectSetupBlockBuilder().
 */
export type ProfileName = ProjectProfile;
