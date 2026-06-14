/**
 * static-serve.ts
 * public/static/ 파일들을 Worker 번들에 인라인으로 포함해서 직접 서빙.
 * Cloudflare Pages의 ASSETS 바인딩 없이도 동작함.
 */
import { Hono } from 'hono'
import type { Bindings, Variables } from './types'

// Vite의 ?raw 임포트 — 빌드 시 파일 내용이 문자열로 번들에 포함됨
import adminJs         from '../public/static/admin.js?raw'
import adminUsersJs    from '../public/static/admin-users.js?raw'
import adminEventsJs   from '../public/static/admin-events.js?raw'
import adminPlansJs    from '../public/static/admin-plans.js?raw'
import adminLessonsJs  from '../public/static/admin-lessons.js?raw'
import adminNfcJs      from '../public/static/admin-nfc.js?raw'
import adminReportsJs  from '../public/static/admin-reports.js?raw'
import adminGroupsJs   from '../public/static/admin-groups.js?raw'
import adminOrdersJs   from '../public/static/admin-orders.js?raw'
import adminPartnerJs  from '../public/static/admin-partner.js?raw'
import appJs           from '../public/static/app.js?raw'
import styleCss        from '../public/static/style.css?raw'

const staticRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const JS_HEADERS  = { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }
const CSS_HEADERS = { 'Content-Type': 'text/css; charset=utf-8',              'Cache-Control': 'public, max-age=3600' }

staticRouter.get('/admin.js',          (c) => c.body(adminJs,        200, JS_HEADERS))
staticRouter.get('/admin-users.js',    (c) => c.body(adminUsersJs,   200, JS_HEADERS))
staticRouter.get('/admin-events.js',   (c) => c.body(adminEventsJs,  200, JS_HEADERS))
staticRouter.get('/admin-plans.js',    (c) => c.body(adminPlansJs,   200, JS_HEADERS))
staticRouter.get('/admin-lessons.js',  (c) => c.body(adminLessonsJs, 200, JS_HEADERS))
staticRouter.get('/admin-nfc.js',      (c) => c.body(adminNfcJs,     200, JS_HEADERS))
staticRouter.get('/admin-reports.js',  (c) => c.body(adminReportsJs, 200, JS_HEADERS))
staticRouter.get('/admin-groups.js',   (c) => c.body(adminGroupsJs,  200, JS_HEADERS))
staticRouter.get('/admin-orders.js',   (c) => c.body(adminOrdersJs,  200, JS_HEADERS))
staticRouter.get('/admin-partner.js',  (c) => c.body(adminPartnerJs, 200, JS_HEADERS))
staticRouter.get('/app.js',            (c) => c.body(appJs,          200, JS_HEADERS))
staticRouter.get('/style.css',         (c) => c.body(styleCss,       200, CSS_HEADERS))

export default staticRouter
