# 백엔드(THE-METI) 작업 요청서

> 작성: meti-app(앱) 팀 → THE-METI(서버) 팀
> 작성일: 2026-06-24
> 배경: meti-app Mock 모드 → 실서버 API 연동 작업 중 발견된 백엔드 변경 요청사항

---

## 요청 1. `GET /api/v1/events` 공개 행사 피드 신규 추가 ⭐ (P0)

### 배경
- 현재 스펙(v1.7)에는 그룹 종속 행사 API만 존재 (`/events/groups/:groupId/events`).
- 앱은 커뮤니티 **행사 탭**에서 "METI 전체 공개 행사"를 보여주는 피드가 필요함.
- 앱 코드(`events_screen.dart`)는 이미 `GET /events`를 호출하도록 작성되어 있으나, 백엔드에 해당 엔드포인트가 없어 빈 응답(200 empty body) → JSON 파싱 오류 발생.

### 결정된 구조 (앱-서버 공통)
- 행사 데이터는 하나(`events` 테이블), 뷰가 둘:
  - **전체 공개 피드** = `visibility='public'` 전체 그룹 대상 → 신규 `GET /events`
  - **그룹 내부 행사** = `group_id=X` → 기존 `/events/groups/:groupId/events`
- 행사 카드에 그룹명을 노출하므로 응답에 `group_name` 포함 필수.

### 요청 스펙
```
GET /api/v1/events
```
| 항목 | 내용 |
|------|------|
| 인증 | **불필요** (auth: false) |
| 쿼리 | `?page=`, `?limit=`, `?status=upcoming\|ongoing\|ended` |
| 필터 조건 | `visibility = 'public'` AND 활성 상태 (취소/삭제 제외) |
| 정렬 | `starts_at` 기준 (예정 우선) |
| 페이지네이션 | 기존 `paginate()` 헬퍼 형식과 동일 |

### 응답 필드 (앱 `Event.fromJson` 기준)
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "group_id": 1,
      "title": "METI 네트워킹 밋업",
      "description": "...",
      "location": "서울 강남구",
      "starts_at": "2026-07-01T18:00:00Z",
      "ends_at": "2026-07-01T21:00:00Z",
      "status": "upcoming",
      "visibility": "public",
      "registration_type": "free",
      "capacity": 100,
      "participant_count": 34,
      "entry_fee": 0,
      "group_name": "METI 개발자 모임",      // ★ 필수
      "organizer_name": "홍길동"             // ★ 필수
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 3, "total_pages": 1, "has_next": false }
}
```

---

## 요청 2. `GET /api/v1/chat` 응답에 상대 멤버 정보 포함 (P1)

### 배경
- 현재 `GET /chat`은 `chat_rooms.*` + `unread_count` + `last_message` + `last_message_at`만 반환하고 **채팅방 멤버(상대방) 정보가 없음**.
- 앱은 채팅 목록에서 상대방 **이름·아바타**를 표시해야 하는데 (`room.members[0].name`, `avatar_url`) 해당 데이터가 없어 모두 "알 수 없음"으로 표시됨.

### 요청
`GET /chat` 각 room 객체에 상대 멤버 정보 추가. 둘 중 한 형태:
```json
// (a) members 배열 — 앱 현재 파싱 방식과 일치(권장)
"members": [ { "user_id": 12, "name": "김철수", "avatar_url": "https://..." } ]
// (b) 또는 direct방 상대 1명 단일 객체
"other_member": { "user_id": 12, "name": "김철수", "avatar_url": "https://..." }
```
- direct 방: 본인 제외한 상대 1명. (그룹 채팅 대비 배열 형태가 확장에 유리)
- `chat_room_members JOIN users`로 조회.

---

## 요청 3. 회원가입 만 19세 미만 차단 (서버 측 enforcement) (P1)

### 배경 / 정책
- **미성년자(만 19세 미만) 가입을 원천 차단**하고, 보호자 동의가 필요한 기능을 전면 제거하기로 결정(2026-06-24).
- 앱: 회원가입에 생년월일 입력 추가 + **만 19세 미만 클라이언트 차단** 구현 완료. `POST /auth/register` body에 `birth_date`(YYYY-MM-DD) 전송.
- 앱에서 **보호자(Guardian) 기능 전체 삭제**, 그룹 가입 시 미성년/생년월일 수집 제거.

### 요청
1. `POST /auth/register`에서 `birth_date` 수신·저장, **서버에서도 만 19세 미만이면 거부**(클라이언트 우회 방지). 적절한 에러 메시지/코드 반환.
2. (협의) `guardians` 라우트 및 `user_guardians`·minor 관련 컬럼/로직은 더 이상 앱에서 사용하지 않음. 서버 정리 여부는 백엔드팀 판단.
3. 레슨(`lessons`)은 **성인 대상 기능으로 유지** — 보호자/미성년 학생 연계 부분만 정리 대상.

---

## 요청 4. 레슨 일정 API — 보호자(user_guardians) 의존 제거 + 500 오류 (P1)

### 현상
- `GET /lessons/:groupId/schedules` 및 `.../schedules/:id`가 **그룹 비멤버 호출 시 500 서버 오류** 반환.
  - 재현: admin(super_admin, 그룹1 비멤버) 토큰으로 `GET /api/v1/lessons/1/schedules` → `{"success":false,"error":"서버 오류가 발생했습니다."}`
- 원인 추정: 멤버가 아니면 **보호자 자격 체크 분기**로 진입 → `user_guardians` JOIN 쿼리 실행. 미성년/보호자 정책 폐기로 해당 테이블이 정리되었거나 정합성이 깨져 SQL 오류 → 500.

### 요청
- **미성년/보호자 폐기 정책**([app 측 보호자 기능 전면 삭제])에 맞춰 lesson-schedules의 **보호자 접근 분기(`user_guardians` 참조) 제거**.
- 접근 제어를 **그룹 멤버(강사/관리자/학생) 기준만**으로 단순화.
- 비멤버는 깔끔히 403 반환(현재 500 → 정상화).

### 참고: 앱 측 필드 매핑은 처리 완료(서버 작업 아님)
- 서버 응답 필드와 앱 모델 필드명이 달라 앱에서 양쪽 모두 파싱하도록 수정함:
  - `starts_at`↔`scheduled_at`, `ends_at`(→duration 계산)↔`duration_minutes`, `max_students`↔`capacity`, `present_count`↔`attendance_count`, 출석 `name`↔`student_name`, `checked_at`↔`recorded_at`.
- 생성 바디는 `starts_at`/`ends_at`(실서버) + `scheduled_at`/`duration_minutes`(Mock) 동시 전송.

---

## (참고) 백엔드 작업 아님 — 앱 측 후속 작업으로 보류한 항목

| 항목 | 내용 | 상태 |
|------|------|------|
| 채팅 이미지/파일 실업로드 | `POST /chat/:roomId/upload`(multipart)는 백엔드 구현 완료. 앱이 아직 미연동(현재 Mock 파일명만 전송) | 앱 후속 작업 |
| 채팅 동영상 첨부 | 백엔드 `message_type` enum이 `text/image/file/card` — `video` 미지원. 앱에서 동영상 첨부 옵션 제거함 | 정책 확인 필요(추후 video 지원 여부) |

> 위 항목은 당장 서버 작업이 필요 없으나, **동영상 첨부를 정식 지원할지**는 추후 협의 필요.

---

## (확인용) 앱 측에서 이미 처리한 항목 — 백엔드 작업 불필요

아래는 앱 코드를 백엔드 현행 스펙에 맞춰 **앱에서 수정 완료**한 것으로, 서버 작업이 필요 없습니다. 참고용으로만 기재합니다.

| 항목 | 내용 | 처리 |
|------|------|------|
| 이벤트 삭제 URL | 앱이 `DELETE /events/groups/:gid/events/:id` 호출 → 서버는 `DELETE /events/:id` | 앱 URL 수정 완료 |
| 그룹 멤버 한도 필드 | 앱이 `max_group_members` 읽음 → 서버는 `max_members` 반환 | 앱 필드명 수정 완료 |
| 한도초과 응답 파싱 | 서버 `upgrade_required`/`error_code` 응답을 앱이 미파싱 | 앱 파서 보강 완료 |

---

## 진행 현황 (연동 검증 순서)
- ✅ 인증 / 명함 / 그룹 / 이벤트 / 채팅 / 포인트 / 레슨 일정 — 검증 완료
- ❌ 보호자 — 미성년 차단 정책으로 기능 삭제(연동 취소)

## 요청 요약 (서버팀 액션)
| # | 요청 | 우선순위 |
|---|------|---------|
| 1 | `GET /api/v1/events` 공개 행사 피드 신규 추가 | P0 |
| 2 | `GET /api/v1/chat` 응답에 상대 멤버 정보 포함 | P1 |
| 3 | 회원가입 만 19세 미만 서버 측 차단(`birth_date` 검증) | P1 |
| 4 | 레슨 일정 API 보호자(`user_guardians`) 의존 제거 + 비멤버 500 오류 정상화 | P1 |
