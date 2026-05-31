import * as fs from "node:fs";
import * as path from "node:path";

// Types defined in this file (no self-import)
export interface EasiiSettings {
	easii?: {
		verbosity?: Verbosity;
	};
}

export type Verbosity = "off" | "minimal" | "full";

export const DEFAULT_VERBOSITY: Verbosity = "minimal";

export function getVerbosity(cwd: string): Verbosity {
	const filePath = path.join(cwd, ".pi", "settings.json");
	if (!fs.existsSync(filePath)) return DEFAULT_VERBOSITY;
	try {
		const data = JSON.parse(
			fs.readFileSync(filePath, "utf-8"),
		) as EasiiSettings;
		const verbosity = data.easii?.verbosity;
		if (
			verbosity === "off" ||
			verbosity === "minimal" ||
			verbosity === "full"
		) {
			return verbosity;
		}
		return DEFAULT_VERBOSITY;
	} catch {
		return DEFAULT_VERBOSITY;
	}
}
