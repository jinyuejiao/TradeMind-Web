/**
 * App 运行时 API 覆盖（可选）
 * 同步进 www 后，可在入口 HTML 于 env-config 之前引入：
 *   <script src="/assets/js/tm-app-api-override.js"></script>
 * 正式环境请改为真实 HTTPS 网关，勿提交密钥。
 */
window.TM_APP_API_BASE = window.TM_APP_API_BASE || 'https://api.trademind.example';
