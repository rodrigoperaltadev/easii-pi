/**
 * User preferences for project setup collected in collectSetupPreferences().
 * Stored in the easii.setup_preferences block of openspec/config.yaml.
 */
export interface SetupPreferences {
	strictTdd: "configured" | "enable" | "skip" | "missing-runner";
	e2e:
		| "configured"
		| "detected-partial"
		| "recommended"
		| "skip"
		| "not-applicable";
	ci: "configured" | "detected-partial" | "recommended" | "skip";
	cd: "configured" | "detected-partial" | "recommended" | "skip";
	docker:
		| "configured"
		| "detected-partial"
		| "recommended"
		| "skip"
		| "not-applicable";
}

/**
 * UI interface injected by the Pi runtime into setup commands.
 * Provides optional confirm() and required notify().
 * Used as dependency injection in confirmOrAbort().
 */
export interface SetupUi {
	confirm?: (title: string, message: string) => Promise<boolean>;
	notify: (message: string, level: "info" | "warning" | "error") => void;
}
