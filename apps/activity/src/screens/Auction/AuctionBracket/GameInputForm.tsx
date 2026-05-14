import { useEffect, useMemo, useState } from "react";
import { api } from "../../../api/rest.js";
import { ChampPickerModal } from "../ChampPickerModal.js";
import type { AuctionMatch, AuctionTournamentDetail } from "../types.js";
import type { MatchDetail } from "./_shared.js";

const ROLE_ORDER = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;
type Role = (typeof ROLE_ORDER)[number];

interface Champion {
	id: number;
	idSlug: string;
	name: string;
	iconUrl: string;
}

// ============================================================
// GameInputForm — 라인 자유 픽 (Q8): 각 팀 5명을 5라인에 자유 배치 + 챔프 그리드 모달.
// BAN 5개/팀 입력 포함.
// ============================================================
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
	const [winningTeam, setWinningTeam] = useState<"TEAM_1" | "TEAM_2">("TEAM_1");
	const [assign, setAssign] = useState<Record<"TEAM_1" | "TEAM_2", Partial<Record<Role, string>>>>({
		TEAM_1: {},
		TEAM_2: {},
	});
	const [picks, setPicks] = useState<Record<"TEAM_1" | "TEAM_2", Partial<Record<Role, number>>>>({
		TEAM_1: {},
		TEAM_2: {},
	});
	const [bans, setBans] = useState<Record<"TEAM_1" | "TEAM_2", number[]>>({
		TEAM_1: [],
		TEAM_2: [],
	});

	const [champions, setChampions] = useState<Champion[]>([]);
	useEffect(() => {
		(async () => {
			try {
				const r = await api<{ champions: Champion[] }>("/champions");
				setChampions(r.champions);
			} catch {}
		})();
	}, []);
	const champById = useMemo(() => new Map(champions.map((c) => [c.id, c])), [champions]);

	// 챔프 모달 — 어느 slot 을 선택 중인지 추적
	const [picker, setPicker] = useState<
		| null
		| { kind: "pick"; team: "TEAM_1" | "TEAM_2"; role: Role }
		| { kind: "ban"; team: "TEAM_1" | "TEAM_2"; index: number }
	>(null);

	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const team1Members = team1.members;
	const team2Members = team2.members;

	// 모든 슬롯에 사용된 챔프 id (중복 방지)
	const usedChampIds = useMemo(() => {
		const set = new Set<number>();
		for (const team of ["TEAM_1", "TEAM_2"] as const) {
			for (const role of ROLE_ORDER) {
				const c = picks[team][role];
				if (c != null) set.add(c);
			}
			for (const b of bans[team]) if (b != null) set.add(b);
		}
		return set;
	}, [picks, bans]);

	const updateAssign = (team: "TEAM_1" | "TEAM_2", role: Role, userId: string | undefined) => {
		setAssign((prev) => ({ ...prev, [team]: { ...prev[team], [role]: userId } }));
	};

	const setPick = (team: "TEAM_1" | "TEAM_2", role: Role, championId: number) => {
		setPicks((prev) => ({ ...prev, [team]: { ...prev[team], [role]: championId } }));
	};
	const setBan = (team: "TEAM_1" | "TEAM_2", index: number, championId: number) => {
		setBans((prev) => {
			const arr = [...prev[team]];
			arr[index] = championId;
			return { ...prev, [team]: arr };
		});
	};
	const removeBan = (team: "TEAM_1" | "TEAM_2", index: number) => {
		setBans((prev) => {
			const arr = [...prev[team]];
			arr.splice(index, 1);
			return { ...prev, [team]: arr };
		});
	};

	const submit = async () => {
		for (const team of ["TEAM_1", "TEAM_2"] as const) {
			for (const role of ROLE_ORDER) {
				if (!assign[team][role]) {
					setError(`${team} ${role} 사용자 미지정`);
					return;
				}
				if (!picks[team][role]) {
					setError(`${team} ${role} 챔프 미지정`);
					return;
				}
			}
			const userIds = Object.values(assign[team]);
			if (new Set(userIds).size !== userIds.length) {
				setError(`${team} 안에 같은 사용자 중복`);
				return;
			}
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
						TEAM_1: ROLE_ORDER.map((r) => ({
							userId: assign.TEAM_1[r]!,
							role: r,
							championId: picks.TEAM_1[r]!,
						})),
						TEAM_2: ROLE_ORDER.map((r) => ({
							userId: assign.TEAM_2[r]!,
							role: r,
							championId: picks.TEAM_2[r]!,
						})),
					},
					bans: { TEAM_1: bans.TEAM_1.filter(Boolean), TEAM_2: bans.TEAM_2.filter(Boolean) },
				}),
			});
			onRecorded();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
		}
	};

	const ChampSlotButton = ({
		championId,
		onClick,
		onClear,
	}: {
		championId: number | undefined;
		onClick: () => void;
		onClear?: () => void;
	}) => {
		const c = championId != null ? champById.get(championId) : undefined;
		return (
			<button
				type="button"
				onClick={onClick}
				className={`btn btn-xs flex-1 min-w-0 gap-1 ${c ? "btn-outline" : "btn-ghost"}`}
			>
				{c ? (
					<>
						<img src={c.iconUrl} alt={c.name} className="w-4 h-4 rounded" />
						<span className="truncate text-[10px]">{c.name}</span>
						{onClear && (
							<span
								className="text-base-content/40 hover:text-error"
								onClick={(e) => {
									e.stopPropagation();
									onClear();
								}}
								role="button"
								tabIndex={0}
							>
								✕
							</span>
						)}
					</>
				) : (
					<span className="text-[10px] opacity-60">+ 챔프</span>
				)}
			</button>
		);
	};

	return (
		<>
			<div className="space-y-2 border-t border-base-300 pt-2">
				<h4 className="font-bold text-sm">Game {nextGameNumber} 입력 (라인 자유 배치)</h4>
				<div className="flex items-center gap-3 text-xs">
					<span>1팀 사이드:</span>
					<div className="join">
						<button
							type="button"
							className={`btn btn-xs join-item ${team1Side === "BLUE" ? "btn-info" : "btn-ghost"}`}
							onClick={() => setTeam1Side("BLUE")}
						>
							BLUE
						</button>
						<button
							type="button"
							className={`btn btn-xs join-item ${team1Side === "RED" ? "btn-error" : "btn-ghost"}`}
							onClick={() => setTeam1Side("RED")}
						>
							RED
						</button>
					</div>
				</div>

				{/* BAN — 각 팀 5개 슬롯 */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
					{(["TEAM_1", "TEAM_2"] as const).map((team) => (
						<div key={team} className="card bg-base-100 border border-base-300">
							<div className="card-body p-2 gap-1">
								<div className="font-bold text-xs">
									🚫 BAN — {team === "TEAM_1" ? `팀${team1.teamIndex}` : `팀${team2.teamIndex}`}
								</div>
								<div className="grid grid-cols-5 gap-1">
									{[0, 1, 2, 3, 4].map((i) => {
										const banId = bans[team][i];
										return (
											<ChampSlotButton
												key={i}
												championId={banId}
												onClick={() => setPicker({ kind: "ban", team, index: i })}
												{...(banId != null ? { onClear: () => removeBan(team, i) } : {})}
											/>
										);
									})}
								</div>
							</div>
						</div>
					))}
				</div>

				{/* PICK — 라인 5개 × 양 팀, 사용자 + 챔프 */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
					{(["TEAM_1", "TEAM_2"] as const).map((team) => {
						const members = team === "TEAM_1" ? team1Members : team2Members;
						return (
							<div key={team} className="card bg-base-100 border border-base-300">
								<div className="card-body p-2 gap-1">
									<div className="font-bold text-xs">
										⚔️ PICK — {team === "TEAM_1" ? `팀${team1.teamIndex}` : `팀${team2.teamIndex}`}
									</div>
									{ROLE_ORDER.map((role) => (
										<div key={role} className="flex items-center gap-1 text-xs">
											<span className="w-8 font-medium">{role.slice(0, 3)}</span>
											<select
												value={assign[team][role] ?? ""}
												onChange={(e) => updateAssign(team, role, e.target.value || undefined)}
												className="select select-bordered select-xs flex-1 min-w-0"
											>
												<option value="">- 선택 -</option>
												{members.map((m) => (
													<option key={m.userId} value={m.userId}>
														{m.displayName}
													</option>
												))}
											</select>
											<ChampSlotButton
												championId={picks[team][role]}
												onClick={() => setPicker({ kind: "pick", team, role })}
											/>
										</div>
									))}
								</div>
							</div>
						);
					})}
				</div>

				<div className="flex items-center gap-3 text-xs">
					<span>승팀:</span>
					<div className="join">
						<button
							type="button"
							className={`btn btn-xs join-item ${winningTeam === "TEAM_1" ? "btn-info" : "btn-ghost"}`}
							onClick={() => setWinningTeam("TEAM_1")}
						>
							팀{team1.teamIndex} 승
						</button>
						<button
							type="button"
							className={`btn btn-xs join-item ${winningTeam === "TEAM_2" ? "btn-error" : "btn-ghost"}`}
							onClick={() => setWinningTeam("TEAM_2")}
						>
							팀{team2.teamIndex} 승
						</button>
					</div>
				</div>
				{error && <div className="alert alert-error alert-sm">{error}</div>}
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
