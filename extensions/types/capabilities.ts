/**
 * Capability audit status for a single project capability.
 * @see detectCapabilities()
 */
export type CapabilityStatus =
	| "configured"
	| "detected-partial"
	| "missing"
	| "not-applicable";

/**
 * Single capability record with status, summary, and optional details.
 * @see detectCapabilities()
 */
export interface ProjectCapability {
	status: CapabilityStatus;
	summary: string;
	details?: string[];
}

/**
 * Full capability audit for a project (read-only).
 * Covers unit tests, E2E, strict TDD, CI, CD/deploy, and Docker.
 * Populated by detectCapabilities().
 */
export interface ProjectCapabilities {
	unitTests: ProjectCapability;
	e2eTests: ProjectCapability;
	strictTdd: ProjectCapability;
	ci: ProjectCapability;
	cd: ProjectCapability;
	docker: ProjectCapability;
}
