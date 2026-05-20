import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/rest.js";
import { InlineNotice, SectionHeader, StatusBadge } from "../../components/DesignPrimitives.js";

type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
type Recommendation = "AUTO_PASS" | "MANUAL_REVIEW" | "REJECT_OR_INTERVIEW";

interface RiskScore {
	score: number;
	level: RiskLevel;
	reasons: string[];
}

interface Evidence {
	category: string;
	metric: string;
	value: number | string;
	threshold?: number | string;
	weight: number;
	description: string;
}

interface ScreeningReportResponse {
	cached: boolean;
	stale: boolean;
	fetchedAt: number;
	report: {
		generatedAt: string;
		identity: {
			gameName: string;
			tagLine: string;
			summonerLevel?: number;
		};
		sample: {
			soloRankedMatches: number;
			analyzedMatches: number;
			excludedMatches: number;
			confidence: "LOW" | "MEDIUM" | "HIGH";
		};
		profile: {
			currentSoloRank: string | null;
			recentWinRate: number | null;
			mainRoles: Array<{ role: string; games: number; rate: number }>;
			mainChampions: Array<{ champion: string; games: number; wins: number; winRate: number }>;
		};
		scores: {
			smurfRisk: RiskScore;
			rankMismatchRisk: RiskScore;
			derankOrThrowRisk: RiskScore;
			roleMismatchRisk: RiskScore;
			dataQualityRisk: RiskScore;
			overallReviewRisk: RiskScore;
		};
		evidence: Evidence[];
		recommendation: Recommendation;
	};
}

export function ScreeningReport({ userId }: { userId: string }) {
	const [data, setData] = useState<ScreeningReportResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const load = useCallback(
		(refresh = false) => {
			setLoading(true);
			setError(null);
			api<ScreeningReportResponse>(
				`/users/${encodeURIComponent(userId)}/screening-report${refresh ? "?refresh=1" : ""}`,
			)
				.then(setData)
				.catch((err) => setError(err instanceof Error ? err.message : String(err)))
				.finally(() => setLoading(false));
		},
		[userId],
	);

	useEffect(() => {
		load(false);
	}, [load]);

	if (loading && !data) return <div className="skeleton h-44 w-full rounded-lg" />;
	if (error && !data) return <InlineNotice tone="error">{error}</InlineNotice>;
	if (!data) return null;

	const report = data.report;
	const overall = report.scores.overallReviewRisk;
	const risks = [
		["부계정", report.scores.smurfRisk],
		["티어 불일치", report.scores.rankMismatchRisk],
		["패작 패턴", report.scores.derankOrThrowRisk],
		["포지션 변동", report.scores.roleMismatchRisk],
		["데이터 품질", report.scores.dataQualityRisk],
	] as const;

	return (
		<div className="space-y-3">
			{data.stale && (
				<InlineNotice tone="warning">Riot API 갱신 실패로 이전 캐시를 표시 중입니다.</InlineNotice>
			)}
			<div className="surface-base rounded-lg border border-base-300 p-3 space-y-3">
				<SectionHeader
					title={`${report.identity.gameName}#${report.identity.tagLine}`}
					description="확정 판정이 아닌 운영 검토용 신호입니다."
					actions={
						<button
							type="button"
							className="btn btn-xs btn-outline"
							disabled={loading}
							onClick={() => load(true)}
						>
							갱신
						</button>
					}
				/>

				<div className="grid grid-cols-2 md:grid-cols-4 gap-2">
					<Metric label="종합" value={`${overall.score}`} badge={levelLabel(overall.level)} />
					<Metric label="권고" value={recommendationLabel(report.recommendation)} />
					<Metric label="신뢰도" value={report.sample.confidence} />
					<Metric
						label="표본"
						value={`${report.sample.analyzedMatches}/${report.sample.soloRankedMatches}`}
					/>
				</div>

				<div className="flex flex-wrap gap-2">
					<StatusBadge tone="neutral" variant="outline" size="sm">
						{report.profile.currentSoloRank ?? "UNRANKED"}
					</StatusBadge>
					{report.identity.summonerLevel != null && (
						<StatusBadge tone="neutral" variant="outline" size="sm">
							Lv.{report.identity.summonerLevel}
						</StatusBadge>
					)}
					{report.profile.recentWinRate != null && (
						<StatusBadge tone="info" variant="outline" size="sm">
							최근 승률 {formatPct(report.profile.recentWinRate)}
						</StatusBadge>
					)}
					{data.cached && (
						<StatusBadge tone="neutral" variant="ghost" size="sm">
							캐시
						</StatusBadge>
					)}
				</div>

				<div className="grid grid-cols-1 md:grid-cols-5 gap-2">
					{risks.map(([label, risk]) => (
						<div key={label} className="rounded-md border border-base-300 bg-base-100 p-2">
							<div className="flex items-center justify-between gap-2">
								<div className="text-xs text-base-content/65">{label}</div>
								<StatusBadge tone={riskTone(risk.level)} size="xs">
									{risk.level}
								</StatusBadge>
							</div>
							<div className="mt-1 text-lg font-bold tabular-nums">{risk.score}</div>
							<div className="mt-1 text-xs text-base-content/65 truncate">
								{risk.reasons[0] ?? "특이 신호 없음"}
							</div>
						</div>
					))}
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
					<SummaryList
						title="포지션"
						items={report.profile.mainRoles.map(
							(role) => `${role.role} ${role.games}G · ${formatPct(role.rate)}`,
						)}
					/>
					<SummaryList
						title="챔피언"
						items={report.profile.mainChampions.map(
							(champ) => `${champ.champion} ${champ.games}G · ${formatPct(champ.winRate)}`,
						)}
					/>
				</div>

				{report.evidence.length > 0 && (
					<div className="space-y-2">
						<div className="text-sm font-semibold">근거</div>
						<ul className="space-y-1">
							{report.evidence.slice(0, 8).map((item) => (
								<li
									key={`${item.category}:${item.metric}`}
									className="rounded-md bg-base-200 px-2 py-1.5 text-xs text-base-content/75"
								>
									<span className="font-medium text-base-content">{item.value}</span>
									{item.threshold && <span> · 기준 {item.threshold}</span>}
									<span> · {item.description}</span>
								</li>
							))}
						</ul>
					</div>
				)}
				{error && <InlineNotice tone="warning">{error}</InlineNotice>}
			</div>
		</div>
	);
}

function Metric({ label, value, badge }: { label: string; value: string; badge?: string }) {
	return (
		<div className="rounded-md border border-base-300 bg-base-100 p-2">
			<div className="text-xs text-base-content/65">{label}</div>
			<div className="mt-1 flex items-center gap-2 text-lg font-bold tabular-nums">
				{value}
				{badge && (
					<StatusBadge tone="warning" size="xs">
						{badge}
					</StatusBadge>
				)}
			</div>
		</div>
	);
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
	return (
		<div className="rounded-md border border-base-300 bg-base-100 p-2">
			<div className="text-sm font-semibold">{title}</div>
			<div className="mt-2 flex flex-wrap gap-1.5">
				{items.length > 0 ? (
					items.map((item) => (
						<StatusBadge key={item} tone="neutral" variant="outline" size="xs">
							{item}
						</StatusBadge>
					))
				) : (
					<span className="text-xs text-base-content/55">표본 없음</span>
				)}
			</div>
		</div>
	);
}

function riskTone(level: RiskLevel): "success" | "warning" | "error" {
	if (level === "HIGH") return "error";
	if (level === "MEDIUM") return "warning";
	return "success";
}

function levelLabel(level: RiskLevel): string {
	return level === "HIGH" ? "높음" : level === "MEDIUM" ? "중간" : "낮음";
}

function recommendationLabel(value: Recommendation): string {
	if (value === "REJECT_OR_INTERVIEW") return "추가 인증";
	if (value === "MANUAL_REVIEW") return "수동 검토";
	return "통과 가능";
}

function formatPct(value: number): string {
	return `${Math.round(value * 100)}%`;
}
