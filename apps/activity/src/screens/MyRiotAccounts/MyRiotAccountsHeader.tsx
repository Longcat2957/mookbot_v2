import { SectionHeader } from "../../components/DesignPrimitives.js";

interface Props {
	onBack: () => void;
}

export function MyRiotAccountsHeader({ onBack }: Props) {
	return (
		<header>
			<SectionHeader
				title={<span className="text-xl">라이엇 계정 관리</span>}
				description="여러 계정 연결 가능 · 메인은 한 개 · 게임 기록은 디스코드 계정에 영구 보존"
				actions={
					<button type="button" className="btn btn-sm btn-ghost" onClick={onBack}>
						돌아가기
					</button>
				}
			/>
		</header>
	);
}
