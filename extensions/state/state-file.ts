import * as fs from "node:fs";
import * as path from "node:path";

export interface EasiiState {
	lastProfile: string;
	lastSignalsHash: string;
	lastSeen: string; // ISO 8601 — informational only
}

export function readState(cwd: string): EasiiState | null {
	const filePath = path.join(cwd, ".pi", "easii-state.json");
	if (!fs.existsSync(filePath)) return null;
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf-8")) as EasiiState;
	} catch {
		return null;
	}
}

export function writeState(cwd: string, state: EasiiState): void {
	const dir = path.join(cwd, ".pi");
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(
		path.join(dir, "easii-state.json"),
		JSON.stringify(state, null, 2),
	);
}
