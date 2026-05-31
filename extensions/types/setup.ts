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
 * Notification severity levels for user-facing messages.
 * @see SetupUi.notify()
 */
export type NotificationLevel = "info" | "warning" | "error";

/**
 * Notification service for user-facing messages.
 * Used as dependency injection for non-interactive operation.
 */
export interface NotificationService {
	notify(message: string, level: NotificationLevel): void;
}

/**
 * Confirmation service for user choices.
 * Optional — versions of Pi that don't expose ctx.ui.confirm will skip confirmations.
 */
export interface ConfirmationService {
	confirm?(title: string, message: string): Promise<boolean>;
}

/**
 * UI interface injected by the Pi runtime into setup commands.
 * Combines notification and optional confirmation capabilities.
 * @deprecated Use NotificationService and ConfirmationService separately.
 */
export interface SetupUi extends NotificationService, ConfirmationService {
	confirm?(title: string, message: string): Promise<boolean>;
	notify(message: string, level: NotificationLevel): void;
}
