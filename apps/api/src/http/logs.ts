// /로그 슬래시가 발급한 JWT 로 audit_log 를 조회하는 운영자 전용 웹뷰.
//
// 흐름:
//   1) GET /api/logs?token=<jwt>            → JWT 검증 → HttpOnly 쿠키 set → /api/logs 로 redirect
//   2) GET /api/logs                        → 쿠키 검증 → HTML 페이지 반환
//   3) GET /api/logs/data?action&...&cursor → 쿠키 검증 → JSON (admin_audit_log 페이지네이션)
//
// 쿠키 (logs_sid): 발급된 JWT 그대로. exp 까지 유효 (기본 60분).

import { db } from "@mookbot/core";
import type { FastifyInstance } from "fastify";
import { verifyLogsJwt } from "../auth/logs-jwt.js";

const COOKIE_NAME = "logs_sid";

export async function registerLogsRoutes(app: FastifyInstance): Promise<void> {
	// HTML 페이지 + 토큰 → 쿠키 교환.
	app.get<{ Querystring: { token?: string } }>("/api/logs", async (req, reply) => {
		// 1) 토큰 query 가 있으면 검증 후 쿠키 set + clean URL 로 redirect
		const token = req.query.token;
		if (token) {
			const payload = await verifyLogsJwt(token);
			if (!payload) {
				reply.code(401).type("text/html; charset=utf-8");
				return renderError("토큰 검증 실패", "Discord 에서 `/로그` 명령어를 다시 입력해주세요.");
			}
			// exp 까지 쿠키 maxAge 설정
			const ttl = Math.max(1, payload.exp - Math.floor(Date.now() / 1000));
			reply.setCookie(COOKIE_NAME, token, {
				httpOnly: true,
				secure: true,
				sameSite: "lax",
				path: "/api/logs",
				maxAge: ttl,
			});
			// query 빠진 깨끗한 URL 로 — bookmark / 새로고침 시 토큰이 노출되지 않도록.
			reply.redirect("/api/logs", 303);
			return reply;
		}

		// 2) 쿠키만으로 진입
		const session = await getCookieSession(req);
		if (!session) {
			reply.code(401).type("text/html; charset=utf-8");
			return renderError(
				"인증 만료 또는 미인증",
				"Discord 에서 `/로그` 명령어를 입력해 새 링크를 받아주세요.",
			);
		}

		reply.type("text/html; charset=utf-8");
		return renderViewer(session.sub);
	});

	// JSON 데이터 — 쿠키 인증.
	app.get<{
		Querystring: {
			action?: string;
			operator_id?: string;
			since?: string;
			until?: string;
			limit?: string;
			cursor?: string;
		};
	}>("/api/logs/data", async (req, reply) => {
		const session = await getCookieSession(req);
		if (!session) {
			return reply.code(401).send({ error: "unauthenticated" });
		}

		const q = req.query;
		const limit = q.limit ? Math.min(200, Math.max(1, Number(q.limit))) : 50;
		const params: Parameters<typeof db.listAuditLog>[0] = { limit };
		if (q.action) params.action = q.action;
		if (q.operator_id) params.operatorId = q.operator_id;
		if (q.since) {
			const v = Number(q.since);
			if (Number.isFinite(v)) params.since = v;
		}
		if (q.until) {
			const v = Number(q.until);
			if (Number.isFinite(v)) params.until = v;
		}
		if (q.cursor) {
			const v = Number(q.cursor);
			if (Number.isFinite(v)) params.cursor = v;
		}

		const rows = await db.listAuditLog(params);
		const userIds = [...new Set(rows.map((r) => r.operator_id))];
		const users = userIds.length > 0 ? await db.listUsers(userIds) : [];
		const nameById = new Map(users.map((u) => [u.discord_id, u.display_name]));

		const actions = await db.listAuditActions();

		return {
			logs: rows.map((r) => ({
				id: r.id,
				createdAt: r.created_at,
				operatorId: r.operator_id,
				operatorName: nameById.get(r.operator_id) ?? r.operator_id,
				action: r.action,
				targetType: r.target_type,
				targetId: r.target_id,
				payload: r.payload,
				note: r.note,
			})),
			nextCursor: rows.length === limit ? (rows[rows.length - 1]?.id ?? null) : null,
			actions,
		};
	});

	// 명시적 로그아웃 — 쿠키 삭제 (UX nicety).
	app.post("/api/logs/logout", async (req, reply) => {
		reply.clearCookie(COOKIE_NAME, { path: "/api/logs" });
		return { ok: true };
	});
}

async function getCookieSession(req: import("fastify").FastifyRequest) {
	const raw = req.cookies[COOKIE_NAME];
	if (!raw) return null;
	return verifyLogsJwt(raw);
}

// ============================================================
// HTML 렌더링 — single-file, no external dependency.
// 운영자 전용 + 사용자 적음 → 정적 자산 분리 / SPA / 빌드 파이프라인 불필요.
// ============================================================

function renderError(title: string, message: string): string {
	return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${baseStyles()}</style></head><body>
<div class="error">
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(message)}</p>
</div></body></html>`;
}

function renderViewer(operatorId: string): string {
	return `<!doctype html><html lang="ko"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>monkey audit log</title>
<style>${baseStyles()}${viewerStyles()}</style>
</head><body>
<header>
  <h1>📜 Audit Log</h1>
  <div class="who">로그인: <code>${escapeHtml(operatorId)}</code> <button id="logout" type="button">로그아웃</button></div>
</header>
<form id="filters" autocomplete="off">
  <label>action <select name="action"><option value="">(전체)</option></select></label>
  <label>operator id <input name="operator_id" placeholder="discord id"></label>
  <label>since <input name="since" type="datetime-local"></label>
  <label>until <input name="until" type="datetime-local"></label>
  <label>limit <input name="limit" type="number" min="1" max="200" value="50"></label>
  <button type="submit">조회</button>
  <button id="reset" type="button">초기화</button>
</form>
<div id="status"></div>
<table id="logs">
  <thead><tr>
    <th>id</th><th>시각 (KST)</th><th>operator</th><th>action</th>
    <th>target</th><th>note</th><th>payload</th>
  </tr></thead>
  <tbody></tbody>
</table>
<div id="pager"><button id="more" type="button" hidden>더 보기</button></div>
<script>${viewerScript()}</script>
</body></html>`;
}

function baseStyles(): string {
	return `
:root{color-scheme:light dark}
body{font-family:-apple-system,BlinkMacSystemFont,"Pretendard","Noto Sans KR",sans-serif;
  margin:0;padding:1rem;background:#fafafa;color:#222;line-height:1.5}
@media(prefers-color-scheme:dark){body{background:#16181c;color:#dcddde}}
h1{margin-top:0}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:rgba(127,127,127,.15);padding:.1em .3em;border-radius:3px}
button{font:inherit;padding:.3rem .8rem;cursor:pointer;border:1px solid #aaa;background:transparent;border-radius:3px;color:inherit}
button:hover{background:rgba(127,127,127,.15)}
.error{max-width:40rem;margin:4rem auto;padding:2rem;border:1px solid #c00;border-radius:6px}
`;
}

function viewerStyles(): string {
	return `
header{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem}
header h1{margin:0}
.who{font-size:.85rem;color:#666}
@media(prefers-color-scheme:dark){.who{color:#aaa}}
form#filters{display:flex;gap:.6rem;flex-wrap:wrap;align-items:end;margin-bottom:1rem;padding:.8rem;background:rgba(127,127,127,.08);border-radius:4px}
form#filters label{display:flex;flex-direction:column;font-size:.75rem;color:#666}
form#filters input,form#filters select{font:inherit;padding:.25rem .4rem;margin-top:.15rem;border:1px solid #aaa;border-radius:3px;background:transparent;color:inherit}
form#filters select{min-width:12rem}
#status{margin:.5rem 0;font-size:.85rem;color:#666}
table#logs{width:100%;border-collapse:collapse;font-size:.85rem}
table#logs th,table#logs td{padding:.4rem .5rem;border-bottom:1px solid rgba(127,127,127,.25);text-align:left;vertical-align:top}
table#logs th{font-weight:600;background:rgba(127,127,127,.08)}
table#logs td.payload{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.75rem;white-space:pre-wrap;max-width:32rem;word-break:break-all}
table#logs td.action{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.8rem;font-weight:500}
table#logs td.time{white-space:nowrap;color:#666;font-size:.78rem}
table#logs tr:hover{background:rgba(127,127,127,.08)}
#pager{margin:1rem 0;text-align:center}
`;
}

function viewerScript(): string {
	// IIFE — 페이지 단순. 외부 fetch 1개 (data) + 필터/페이지네이션 + DOM 조작.
	return `
(()=>{
const $=s=>document.querySelector(s);
const tbody=$('#logs tbody');
const moreBtn=$('#more');
const statusEl=$('#status');
const form=$('#filters');
const actionSel=form.action;
let nextCursor=null;
let cachedActions=null;

function fmtTime(unix){
  const d=new Date(unix*1000);
  const pad=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+' '+
    pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());
}
function escapeHtml(s){
  return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"})[c]||c);
}
function buildParams(append){
  const fd=new FormData(form);
  const qs=new URLSearchParams();
  for(const [k,v] of fd){
    if(!v) continue;
    if(k==='since'||k==='until'){
      const sec=Math.floor(new Date(v).getTime()/1000);
      if(Number.isFinite(sec)) qs.set(k,String(sec));
    }else qs.set(k,v);
  }
  if(append&&nextCursor) qs.set('cursor',String(nextCursor));
  return qs.toString();
}
async function load(append=false){
  if(!append){tbody.innerHTML='';nextCursor=null;}
  statusEl.textContent='조회 중…';
  moreBtn.hidden=true;
  try{
    const res=await fetch('/api/logs/data?'+buildParams(append),{credentials:'same-origin'});
    if(res.status===401){statusEl.textContent='세션 만료 — Discord 에서 /로그 다시 입력하세요.';return;}
    const data=await res.json();
    if(!cachedActions){
      cachedActions=data.actions||[];
      for(const a of cachedActions){
        const o=document.createElement('option');o.value=a;o.textContent=a;
        actionSel.appendChild(o);
      }
    }
    for(const r of data.logs){
      const tr=document.createElement('tr');
      const target=r.targetType?(r.targetType+' #'+(r.targetId??'?')):(r.targetId??'');
      tr.innerHTML='<td>'+r.id+'</td>'+
        '<td class="time">'+fmtTime(r.createdAt)+'</td>'+
        '<td><code>'+escapeHtml(r.operatorName)+'</code><br><small>'+escapeHtml(r.operatorId)+'</small></td>'+
        '<td class="action">'+escapeHtml(r.action)+'</td>'+
        '<td>'+escapeHtml(target)+'</td>'+
        '<td>'+escapeHtml(r.note??'')+'</td>'+
        '<td class="payload">'+escapeHtml(r.payload??'')+'</td>';
      tbody.appendChild(tr);
    }
    nextCursor=data.nextCursor;
    statusEl.textContent=tbody.children.length+'건 표시';
    moreBtn.hidden=!nextCursor;
  }catch(err){statusEl.textContent='에러: '+(err.message||err);}
}
form.addEventListener('submit',e=>{e.preventDefault();load(false);});
$('#reset').addEventListener('click',()=>{form.reset();load(false);});
moreBtn.addEventListener('click',()=>load(true));
$('#logout').addEventListener('click',async()=>{
  await fetch('/api/logs/logout',{method:'POST',credentials:'same-origin'});
  location.reload();
});
load(false);
})();
`;
}

function escapeHtml(s: string): string {
	return s.replace(/[&<>"']/g, (c) => {
		switch (c) {
			case "&":
				return "&amp;";
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case '"':
				return "&quot;";
			case "'":
				return "&#39;";
		}
		return c;
	});
}
