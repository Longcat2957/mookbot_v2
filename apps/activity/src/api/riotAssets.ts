const RIOT_ASSET_CACHE_BUSTER = "20260608";

export function riotAssetUrl(url: string | null | undefined): string | null {
	if (!url) return null;
	if (!url.startsWith("/dd/") && !url.startsWith("https://ddragon.leagueoflegends.com/")) {
		return url;
	}
	const assetUrl = new URL(url, window.location.origin);
	assetUrl.searchParams.set("ddv", RIOT_ASSET_CACHE_BUSTER);
	return `${assetUrl.pathname}${assetUrl.search}`;
}
