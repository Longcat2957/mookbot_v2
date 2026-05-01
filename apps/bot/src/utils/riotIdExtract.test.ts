import { describe, expect, it } from "vitest";
import { countHashes, extractRiotIdFromDisplayName } from "./riotIdExtract.js";

describe("countHashes", () => {
	it("0 hashes", () => expect(countHashes("foo")).toBe(0));
	it("1 hash", () => expect(countHashes("a#b")).toBe(1));
	it("3 hashes", () => expect(countHashes("a#b#c#d")).toBe(3));
	it("empty string", () => expect(countHashes("")).toBe(0));
});

describe("extractRiotIdFromDisplayName", () => {
	it("plain name without parentheses → undefined", () => {
		expect(extractRiotIdFromDisplayName("min")).toBeUndefined();
	});

	it("(GameName#TagLine) at end", () => {
		expect(extractRiotIdFromDisplayName("min(Faker#KR1)")).toEqual({
			gameName: "Faker",
			tagLine: "KR1",
			tagExplicit: true,
		});
	});

	it("(GameName) only → default tag KR1", () => {
		expect(extractRiotIdFromDisplayName("min(Faker)")).toEqual({
			gameName: "Faker",
			tagLine: "KR1",
			tagExplicit: false,
		});
	});

	it("ambiguous: 2+ hashes anywhere → undefined", () => {
		expect(extractRiotIdFromDisplayName("a#b#c(name#tag)")).toBeUndefined();
	});

	it("trailing whitespace OK", () => {
		expect(extractRiotIdFromDisplayName("min(Faker#KR1)   ")).toEqual({
			gameName: "Faker",
			tagLine: "KR1",
			tagExplicit: true,
		});
	});

	it("inner game name with spaces", () => {
		expect(extractRiotIdFromDisplayName("min(Hide on bush#KR1)")).toEqual({
			gameName: "Hide on bush",
			tagLine: "KR1",
			tagExplicit: true,
		});
	});

	it("empty parens → undefined", () => {
		expect(extractRiotIdFromDisplayName("min()")).toBeUndefined();
	});

	it("uses last (...) when multiple groups", () => {
		expect(extractRiotIdFromDisplayName("min (note) (Faker#KR1)")).toEqual({
			gameName: "Faker",
			tagLine: "KR1",
			tagExplicit: true,
		});
	});

	it("non-default region tag", () => {
		expect(extractRiotIdFromDisplayName("user(Smurf#NA1)")).toEqual({
			gameName: "Smurf",
			tagLine: "NA1",
			tagExplicit: true,
		});
	});
});
