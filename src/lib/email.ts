// ============================================================
// 트랜잭션 메일 발송 (Brevo HTTP API)
// - Workers 런타임에는 SMTP가 없어 HTTP API 방식만 가능. Brevo를 어댑터로 감싼다.
// - 모빈 표준: 랜딩 5종(alltimo·ddoctor·hello100·hellomedia·reh)이 같은 패턴을 쓴다.
//   참고 구현: ../LP_alltimo/hellomedia/functions/api/contact.js
//   ⚠ 인증 헤더가 `api-key`다 — Bearer 아님.
// - BREVO_API_KEY(secret) / EMAIL_FROM(vars) 미설정 시 비활성 (configured() = false).
//   호출부는 비활성을 "조용히 성공"으로 처리하지 말 것 — 과거 비밀번호 재설정이
//   메일을 안 보내고 "발송했습니다"만 응답해 계정 복구가 불가능했다.
// - 발신 도메인(my-elid.com)은 Brevo 대시보드에서 SPF/DKIM 검증을 마쳐야 실제로 나간다.
// ============================================================
import type { Bindings } from '../types'

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'

export type SendResult =
  | { status: 'sent'; id: string }
  | { status: 'disabled' }                          // 키 미설정 — 환경 구성 문제
  | { status: 'error'; httpStatus: number; detail?: string }

export function emailConfigured(env: Bindings): boolean {
  return !!(env.BREVO_API_KEY && env.EMAIL_FROM)
}

// Brevo는 발신자를 {name, email} 객체로 받는다. EMAIL_FROM은 사람이 읽기 쉬운
// RFC 형식("ELID <noreply@my-elid.com>")으로 두고 여기서 분해한다.
// 꺾쇠가 없으면 전체를 주소로 보고 이름은 서비스명으로 채운다.
function parseSender(from: string, appName?: string): { name: string; email: string } {
  const m = from.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/)
  if (m) return { name: m[1].replace(/^["']|["']$/g, '') || (appName || 'ELID'), email: m[2] }
  return { name: appName || 'ELID', email: from.trim() }
}

// 이메일 본문·링크에 쓰는 서비스 기준 URL. 환경별로 달라야 하므로 vars로 둔다.
export function appBaseUrl(env: Bindings): string {
  return (env.APP_BASE_URL || 'https://my-elid.com').replace(/\/+$/, '')
}

export async function sendEmail(
  env: Bindings,
  msg: { to: string; subject: string; html: string; text?: string }
): Promise<SendResult> {
  if (!emailConfigured(env)) return { status: 'disabled' }

  let res: Response
  try {
    res = await fetch(BREVO_ENDPOINT, {
      method : 'POST',
      headers: {
        'api-key'     : env.BREVO_API_KEY!,     // ⚠ Bearer 아님
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender     : parseSender(env.EMAIL_FROM!, env.APP_NAME),
        to         : [{ email: msg.to }],
        subject    : msg.subject,
        htmlContent: msg.html,
        ...(msg.text ? { textContent: msg.text } : {}),
      }),
    })
  } catch (e) {
    return { status: 'error', httpStatus: 502, detail: String(e) }
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    return { status: 'error', httpStatus: res.status, detail: detail.slice(0, 300) }
  }

  // Brevo는 201 + { messageId } 를 돌려준다
  const body = await res.json<{ messageId?: string }>().catch(() => null)
  return { status: 'sent', id: body?.messageId ?? '' }
}

// ── 템플릿 ────────────────────────────────────────────────
// 메일 클라이언트는 외부 CSS·클래스를 대부분 무시하므로 인라인 스타일로만 작성한다.

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="ko">
<body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;margin:0 auto;">
    <tr><td style="text-align:center;padding-bottom:16px;">
      <span style="font-size:13px;font-weight:700;letter-spacing:3px;color:#64748b;">EL<span style="color:#C9A86A">I</span>D</span>
    </td></tr>
    <tr><td style="background:#ffffff;border-radius:16px;padding:32px 28px;">
      <h1 style="margin:0 0 16px;font-size:18px;color:#0f172a;">${title}</h1>
      ${bodyHtml}
    </td></tr>
    <tr><td style="text-align:center;padding-top:16px;font-size:11px;color:#94a3b8;">
      본 메일은 발신 전용입니다.
    </td></tr>
  </table>
</body>
</html>`
}

export function passwordResetEmail(resetUrl: string): { subject: string; html: string; text: string } {
  const html = layout('비밀번호 재설정', `
      <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#475569;">
        비밀번호 재설정을 요청하셨습니다. 아래 버튼을 눌러 새 비밀번호를 설정해 주세요.
        이 링크는 <strong>1시간</strong> 후 만료됩니다.
      </p>
      <p style="margin:0 0 20px;text-align:center;">
        <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:10px;font-size:14px;font-weight:600;">비밀번호 재설정</a>
      </p>
      <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#94a3b8;">
        버튼이 동작하지 않으면 아래 주소를 브라우저에 붙여넣어 주세요.
      </p>
      <p style="margin:0 0 20px;font-size:12px;word-break:break-all;color:#2563eb;">${resetUrl}</p>
      <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
        본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다. 비밀번호는 변경되지 않습니다.
      </p>`)

  return {
    subject: '[ELID] 비밀번호 재설정 안내',
    html,
    text: `비밀번호 재설정을 요청하셨습니다.\n다음 주소에서 새 비밀번호를 설정해 주세요(1시간 후 만료):\n${resetUrl}\n\n본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.`,
  }
}
