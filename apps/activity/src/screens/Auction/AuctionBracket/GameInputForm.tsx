import { useMemo, useState } from "react";
import { api } from "../../../api/rest.js";
import { InlineNotice, SectionHeader } from "../../../components/DesignPrimitives.js";
import { useChampionCatalog } from "../../../features/champions/useChampionCatalog.js";
import { ChampPickerModal } from "../ChampPickerModal.js";
import type { AuctionMatch, AuctionTournamentDetail } from "../types.js";
import type { MatchDetail } from "./_shared.js";
import { BanInputGrid } from "./BanInputGrid.js";
import { GameSideControls } from "./GameSideControls.js";
import {
	buildTeamPicks,
	type Champion,
	type ChampPickerTarget,
	createEmptyAssignment,
	createEmptyBans,
	createEmptyPicks,
	type GameTeam,
	type Role,
	type RoleAssignment,
	type RolePicks,
	type TeamBans,
	usedChampionIds,
	validateGameInput,
} from "./gameInputTypes.js";
import { PickInputGrid } from "./PickInputGrid.js";

export function GameInputForm({
	match,
	team1,
	team2,
	games,
	onRecorded,
}: {
	match: AuctionMatch;
	team1: AuctionTournamentDetail["teams"][number];
	team2: AuctionTournamentDetail["teams"][number];
	games: MatchDetail["games"];
	onRecorded: () => void;
}) {
	const nextGameNumber = (games.length + 1) as 1 | 2 | 3;
	const [team1Side, setTeam1Side] = useState<"BLUE" | "RED">("BLUE");
	const [winningTeam, setWinningTeam] = useState<GameTeam>("TEAM_1");
	const [assign, setAssign] = useState<RoleAssignment>(() => createEmptyAssignment());
	const [picks, setPicks] = useState<RolePicks>(() => createEmptyPicks());
	const [bans, setBans] = useState<TeamBans>(() => createEmptyBans());
	const { champions } = useChampionCatalog<Champion>();
	const [picker, setPicker] = useState<ChampPickerTarget | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const champById = useMemo(() => new Map(champions.map((c) => [c.id, c])), [champions]);
	const usedChampIds = useMemo(() => usedChampionIds(picks, bans), [picks, bans]);

	const updateAssign = (team: GameTeam, role: Role, userId: string | undefined) => {
		setAssign((prev) => ({ ...prev, [team]: { ...prev[team], [role]: userId } }));
	};

	const setPick = (team: GameTeam, role: Role, championId: number) => {
		setPicks((prev) => ({ ...prev, [team]: { ...prev[team], [role]: championId } }));
	};
	const setBan = (team: GameTeam, index: number, championId: number) => {
		setBans((prev) => {
			const arr = [...prev[team]];
			arr[index] = championId;
			return { ...prev, [team]: arr };
		});
	};
	const removeBan = (team: GameTeam, index: number) => {
		setBans((prev) => {
			const arr = [...prev[team]];
			arr.splice(index, 1);
			return { ...prev, [team]: arr };
		});
	};

	const submit = async () => {
		const validationError = validateGameInput(assign, picks);
		if (validationError) {
			setError(validationError);
			return;
		}
		setSubmitting(true);
		setError(null);
		try {
			await api(`/auction-matches/${match.matchId}/games`, {
				method: "POST",
				body: JSON.stringify({
					gameNumber: nextGameNumber,
					team1Side,
					winningTeam,
					picks: {
						TEAM_1: buildTeamPicks(assign, picks, "TEAM_1"),
						TEAM_2: buildTeamPicks(assign, picks, "TEAM_2"),
					},
					bans: { TEAM_1: bans.TEAM_1.filter(Boolean), TEAM_2: bans.TEAM_2.filter(Boolean) },
				}),
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
			onRecorded();
		}
	};

	return (
		<>
			<div className="space-y-3 xl:border-l xl:border-base-300 xl:pl-4">
				<SectionHeader
					title={<span className="text-sm">Game {nextGameNumber} 입력</span>}
					actions={<div className="text-xs text-base-content/50">라인 자유 배치</div>}
				/>
				<div className="grid grid-cols-1 2xl:grid-cols-[13rem_minmax(0,1fr)] gap-3 items-start">
					<div className="surface-quiet-soft rounded-md p-2.5 space-y-2">
						<GameSideControls
							team1Side={team1Side}
							winningTeam={winningTeam}
							team1Index={team1.teamIndex}
							team2Index={team2.teamIndex}
							onTeam1SideChange={setTeam1Side}
							onWinningTeamChange={setWinningTeam}
						/>
					</div>
					<div className="grid grid-cols-1 2xl:grid-cols-[minmax(14rem,0.75fr)_minmax(0,1.25fr)] gap-3">
						<BanInputGrid
							bans={bans}
							champById={champById}
							team1Index={team1.teamIndex}
							team2Index={team2.teamIndex}
							onOpenPicker={setPicker}
							onRemoveBan={removeBan}
						/>
						<PickInputGrid
							assign={assign}
							picks={picks}
							champById={champById}
							team1={team1}
							team2={team2}
							onAssign={updateAssign}
							onOpenPicker={setPicker}
						/>
					</div>
				</div>
				{error && <InlineNotice tone="error">{error}</InlineNotice>}
				<button
					type="button"
					className="btn btn-sm btn-primary w-full"
					onClick={submit}
					disabled={submitting}
				>
					{submitting ? "기록 중…" : `Game ${nextGameNumber} 결과 기록`}
				</button>
			</div>

			<ChampPickerModal
				open={picker !== null}
				champions={champions}
				disabled={usedChampIds}
				onSelect={(c) => {
					if (!picker) return;
					if (picker.kind === "pick") setPick(picker.team, picker.role, c.id);
					else setBan(picker.team, picker.index, c.id);
				}}
				onClose={() => setPicker(null)}
			/>
		</>
	);
}
