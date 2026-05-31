/**
 * A skill sourced from the openagentskill.com marketplace.
 * Populated by searchMarketplace() from the API response.
 */
export interface MarketplaceSkill {
	name: string;
	slug: string;
	installCmd: string;
	downloads: number;
	rating: number;
	description: string;
	source: "marketplace";
}

/**
 * A skill bundled with @easii/pi as local fallback knowledge.
 * Populated by getLocalFallbacks() based on detected profile.
 */
export interface LocalSkill {
	skillName: string;
	reason: string;
	source: "local";
}

/**
 * Union of skill suggestion sources.
 * @see buildSuggestions()
 */
export type SkillSuggestion = MarketplaceSkill | LocalSkill;

/**
 * Raw API response item from openagentskill.com/api/agent/skills.
 * Contains snake_case and camelCase variants of the same fields.
 * @see searchMarketplace()
 */
export interface MarketplaceResult {
	slug: string;
	name: string;
	install_command?: string;
	installCommand?: string;
	downloads?: number;
	rating?: number;
	description?: string;
}
