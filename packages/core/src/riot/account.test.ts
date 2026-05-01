import { describe, expect, it } from "vitest";
import { parseRiotId } from "./account.js";

describe("parseRiotId", () => {
	it("simple ASCII", () => {
		expect(parseRiotId("Faker#KR1")).toEqual(["Faker", "KR1"]);
	});

	it("game name with spaces", () => {
		expect(parseRiotId("Hide on bush#KR1")).toEqual(["Hide on bush", "KR1"]);
	});

	it("unicode game name", () => {
		expect(parseRiotId("페이커#KR1")).toEqual(["페이커", "KR1"]);
	});

	it("multiple #s — splits at first only", () => {
		expect(parseRiotId("name#tag#extra")).toEqual(["name", "tag#extra"]);
	});

	it("non-default region tag", () => {
		expect(parseRiotId("Smurf#NA1")).toEqual(["Smurf", "NA1"]);
	});

	it("throws on missing #", () => {
		expect(() => parseRiotId("nohashhere")).toThrow(/Invalid Riot ID/);
	});

	it("throws on empty name (#tag)", () => {
		expect(() => parseRiotId("#KR1")).toThrow(/Invalid Riot ID/);
	});

	it("throws on empty tag (name#)", () => {
		expect(() => parseRiotId("name#")).toThrow(/Invalid Riot ID/);
	});

	it("throws on empty string", () => {
		expect(() => parseRiotId("")).toThrow(/Invalid Riot ID/);
	});
});
