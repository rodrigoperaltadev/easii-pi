// Pi runtime API type — re-exported for external consumers of the types package
export type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// stack
export type {
	ProjectProfile,
	DetectedStack,
	InferredProjectCommands,
	PackageManager,
	ProfileName,
	PackageJson,
} from "./stack.js";

// skills
export type {
	MarketplaceSkill,
	LocalSkill,
	SkillSuggestion,
	MarketplaceResult,
} from "./skills.js";

// mcp
export type { McpServerConfig, McpSuggestion } from "./mcp.js";

// capabilities
export type {
	CapabilityStatus,
	ProjectCapability,
	ProjectCapabilities,
} from "./capabilities.js";

// setup
export type {
	SetupPreferences,
	SetupUi,
	NotificationLevel,
	NotificationService,
	ConfirmationService,
} from "./setup.js";
