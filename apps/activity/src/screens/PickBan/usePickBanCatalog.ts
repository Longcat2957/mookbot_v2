import { useChampionCatalog } from "../../features/champions/useChampionCatalog.js";
import type { Champion } from "./types.js";

export function usePickBanCatalog(): Champion[] {
	return useChampionCatalog<Champion>().champions;
}
