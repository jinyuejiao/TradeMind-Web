# 商贸智脑（TradeMind）系统概要设计文档

## 概述

商贸智脑是一个面向中小微企业的智能经营一体化平台，提供客户管理、产品管理、订单管理、供应商管理、生产管理、AI智能处理、报表分析等一站式解决方案。

系统支持**多商户类型（业态）**SaaS 扩展：租户具有字典 **D013** 定义的 `merchant_type`，登录 JWT 与 API 网关向下游透传 **`X-Merchant-Type`**；前端通过 **`/fragments/<业态目录>/`** 与 **`tm-ui-loader.js`** 实现行业片段注入（详见 §3.1、§2.7）。

系统已实现**商业化订阅与推荐奖励**底座：`subscription_plans` / `tenant_subscriptions` 管理业态×等级配额与订阅履历；注册默认试用（**D001/TRIAL**）；用户维度 **`referral_code`** 与提现字段；网关根据 JWT **`accessMode`** 做 **READ_ONLY / BILLING_ONLY** 路由限制（详见 §1.1.3–§1.1.6、§2.7、§2.8）。**独立推广员系统**（**`ROLE_PROMOTER`**）已落地：运维开号、`/api/v1/promoter/**` 门户 API、移动 H5 **`promoter-portal.html`**（含微信公众号 OAuth）、推广员单笔奖励 **150.00**（§2.8.6–§2.8.7、§3.1.8、§3.2.9）。业务服务侧 **配额硬校验（AOP/Redis）** 仍为后续迭代项。

销售/进货单据已落地**物流状态 + 财务状态双线模型**（字典 **D010–D012** 物流、**D015–D017** 财务/流水类型）：物流驱动 **`warehouse_stock`** 精准出入库（明细 **`is_processed`** 幂等），财务经 **`record-payment`** 独立记账（详见 §1.3.7–§1.4.4、§2.9）。前端 **`tm-layout-engine.css`** 统一手机端三段式壳层与弹窗 Bottom Sheet（§3.1.0、§7.5）。

## 系统架构

采用微服务架构，由多个独立服务组成，通过API网关统一对外提供服务；网关在校验 JWT 后 **保留** `Authorization` 并向业务服务注入 **`X-User-Id`、`X-Tenant-Id`、`X-User-Role`、`X-Merchant-Type`**；并在解析令牌中的 **`accessMode`** 后执行订阅访问策略（见 §2.7）；**`/api/v1/ops/**`** 路径额外校验运维角色（§2.4.5）；**`ROLE_PROMOTER`** 采用 deny-by-default 白名单，仅可访问推广员门户与登录（§2.4.7）。

---

## 1. 数据库表结构设计

**DDL 权威来源**：**仅 `InitCfgService`** 在启动时执行数据库初始化；**`DatabaseInitService.initProductionBaseline()`** 按序幂等执行 **`db/schema-production.sql`**（33 张表 + 索引 + 存量列补齐 `ALTER`）→ **`db/seed-data.sql`**（运维租户、D001–D017 字典、16 行订阅方案）→ **`validateCoreSchema()`**（Java 校验表/关键列/字典/索引与 spec 对齐）。**Hibernate `ddl-auto: none`** 全局禁用自动建表；业务微服务 **禁止** 在启动时执行 `CREATE TABLE` 或自带迁移脚本。上线前清库重置流程见 **`docs/Database_Deployment_Guide.md`**；手工自检见 **`db/check_schema.sql`**。下列 **字段名** 均为 **PostgreSQL 物理蛇形列名**。

### 1.1 核心业务表

#### 1.1.1 租户表（tenants）

| 字段名 | 类型 | 长度 | 可空 | 默认值 | 说明 |
| ----- | --- | --- | --- | --- | --- |
| tenant_id | VARCHAR | 32 | 否 | - | 租户 ID，主键 |
| tenant_name | VARCHAR | 100 | 否 | - | 租户名称 |
| phone | VARCHAR | 20 | 否 | - | 联系电话，**UNIQUE** |
| email | VARCHAR | 120 | 是 | NULL | 邮箱 |
| tenant_code | VARCHAR | 50 | 是 | - | 租户代码 |
| subscription_type | VARCHAR | 50 | 否 | - | 订阅类型（字典 **D001** 等） |
| energy_balance | INT | - | 否 | 0 | 能量余额 |
| sub_start_time | TIMESTAMP | - | 否 | - | 订阅开始时间 |
| sub_end_time | TIMESTAMP | - | 否 | - | 订阅结束时间 |
| tenant_status | VARCHAR | 50 | 否 | NORMAL | 租户状态 |
| merchant_type | VARCHAR | 50 | 否 | WHOLESALE | 商户类型（字典 **D013** `dict_code`），与 JWT、网关 `X-Merchant-Type` 一致 |
| current_plan_id | UUID | - | 是 | NULL | 当前生效方案 `subscription_plans.plan_id` |
| access_mode | VARCHAR | 32 | 否 | FULL | **`FULL`** / **`READ_ONLY`** / **`BILLING_ONLY`**，与 JWT `accessMode` 一致 |
| grace_until | TIMESTAMP | - | 是 | NULL | 宽限期截止时间（可选） |
| create_time | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| update_time | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP | 更新时间 |


#### 1.1.2 用户表（users）

| 字段名 | 类型 | 长度 | 可空 | 默认值 | 说明 |
| ----- | --- | --- | --- | --- | --- |
| user_id | SERIAL | - | 否 | 自增 | 用户 ID，主键 |
| tenant_id | VARCHAR | 32 | 否 | - | 租户 ID，FK → `tenants(tenant_id)` |
| user_name | VARCHAR | 50 | 否 | - | 登录名，**UNIQUE** |
| real_name | VARCHAR | 50 | 是 | - | 真实姓名 |
| password_hash | VARCHAR | 256 | 否 | - | 密码哈希 |
| email | VARCHAR | 120 | 是 | NULL | 邮箱 |
| phone | VARCHAR | 20 | 否 | - | 手机，**UNIQUE** |
| role_type | VARCHAR | 50 | 否 | - | 角色类型（字典 **D003**） |
| user_status | VARCHAR | 50 | 否 | NORMAL | 用户状态（字典 **D004**） |
| referral_code | VARCHAR | 8 | 是 | NULL | 推荐码 **`JY`+6 位数字**，**UNIQUE**；由 **`ReferralCodeAllocator`** 分配 |
| payout_pay_type | VARCHAR | 32 | 是 | NULL | 提现支付方式编码 |
| payout_account_name | VARCHAR | 100 | 是 | NULL | 提现户名 |
| payout_account_no | VARCHAR | 256 | 是 | NULL | 提现账号（生产建议密文存储） |
| payout_bank_name | VARCHAR | 100 | 是 | NULL | 开户行 |
| payout_verified | BOOLEAN | - | 是 | FALSE | 提现资料是否已核验 |
| last_login_ip | VARCHAR | 45 | 是 | NULL | 最近一次登录 IP（登录成功时写入） |
| wechat_mp_openid | VARCHAR | 64 | 是 | NULL | 微信公众号 OAuth openid（推广员静默登录绑定），**UNIQUE**（非空时） |
| create_time | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| update_time | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP | 更新时间 |

奖励归属 **用户**，与租户经营账户 **`biz_accounts`** 分离；详见 §2.8。**运维账号**：种子租户 **`SYSTEM_OPS`** / 用户 **`ops_admin`**（`role_type=ROLE_OPS_ADMIN`）见 **`db/seed-data.sql`**。**独立推广员**：同租户 **`SYSTEM_OPS`**，`role_type=ROLE_PROMOTER`，由运维 **`POST /api/v1/ops/promoters`** 开号（§2.8.6）。


#### 1.1.2.1 新手导览状态表（user_onboarding_state）

按 **租户 + 登录主体 + 业态 + 角色** 持久化商户端新手导览进度；**DDL** 在 **`db/schema-production.sql`**（L2 **`user_onboarding_state`**）。读写 API 见 **`TenantService`** **`GET/PUT /onboarding/state`**（网关 **`/api/v1/tenant/onboarding/state`**）。

| 字段名 | 类型 | 可空 | 说明 |
| ----- | --- | --- | --- |
| id | BIGSERIAL | 否 | 主键 |
| tenant_id | VARCHAR(32) | 否 | FK → `tenants(tenant_id)` |
| subject_type | VARCHAR(16) | 否 | `PRIMARY` 主账号登录体；`SUBUSER` 子账号（`subject_id` 为 `users.user_id`） |
| subject_id | VARCHAR(64) | 否 | 主体 ID（主账号或子账号 `user_id` 字符串） |
| industry | VARCHAR(32) | 否 | 业态，如 `WHOLESALE`（字典 **D013**） |
| role_code | VARCHAR(32) | 否 | 归一化角色：`ADMIN`/`SALES`/`WAREHOUSE`/`FINANCE`/`READONLY` |
| first_login_at | TIMESTAMP | 是 | 首次进入主应用时间；`NULL` 表示尚未标记首登 |
| snapshot | JSONB | 否 | 导览快照（**`snapshot_version=3`**），典型键见下表 |
| snapshot_version | INT | 否 | 快照结构版本，当前 `3` |
| updated_at | TIMESTAMP | 否 | 最近更新时间 |

**`snapshot` JSON 约定（与前端 `tm-onboarding.js` 对齐）**：

| 键 | 类型 | 说明 |
| --- | --- | --- |
| `version` | number | 固定 `3` |
| `welcomed` | boolean | 是否已展示欢迎页（仅 **首登** 自动弹欢迎，见 §3.1.6） |
| `mandatoryDone` | boolean | 角色必学路径是否完成 |
| `celebrated` | boolean | 是否已展示完成庆祝 |
| `dismissed` | boolean | 用户关闭可选导览 FAB（须与 `mandatoryDone` 同时为 true 才不再自动打扰） |
| `checklist` | object | 可选功能导览项完成标记（如 `pendingAudit`、`crmCustomer`） |
| `mandatoryStepIndex` | number | 必学中断续做步骤索引 |
| `updatedAt` | string | ISO 时间，用于本地与服务端合并 |

**唯一约束**：`(tenant_id, subject_type, subject_id, industry, role_code)`。

**同步策略**：浏览器 **`localStorage`** 键 **`tm_onboarding_v3_{tenantId}_{subjectId}_{industry}_{roleCode}`** 作离线缓存；登录后 **`GET /onboarding/state`** 与本地 **merge**（进度取并集，`dismissed` 须双端均为 true）；步骤变更经 **`PUT /onboarding/state`** 防抖写回。登录响应 **`onboarding: { isFirstLogin, mandatoryDone }`** 可写入 **`sessionStorage.tm_onboarding_bootstrap`** 以减少首屏 RTT。


#### 1.1.3 订阅方案表（subscription_plans）

行业 × 等级一行方案；配额与功能矩阵以 JSONB 维护。默认种子见 **`InitCfgService`** **`db/seed-data.sql`**（`subscription_plans` 表为空时写入四类业态 × 四档等级共 16 行）；**批发商（`WHOLESALE`）** 的试用/启航/优享定价与配额在同次首次种子末尾写入，**不在后续启动覆盖**（§2.8.6）。**`TenantService.SubscriptionPlanSeedService`** 已废弃（移除 `@Component`）。

| 字段名           | 类型        | 可空 | 说明 |
| ------------- | --------- | --- | --- |
| plan_id       | UUID PK   | 否   | 主键，默认 `gen_random_uuid()` |
| merchant_type | VARCHAR(50) | 否 | 字典 **D013** `dict_code` |
| tier_code     | VARCHAR(32) | 否 | 字典 **D001** `dict_code`：`TRIAL`/`BASIC`/`PREMIUM`/`ENTERPRISE` |
| feature_matrix | JSONB    | 否   | 功能开关 JSON；门户 UI 扩展可读 **`discount_tag`**、**`ribbon`**（角标/飘带文案）、**`recommended`**（是否主推档）等 |
| quota_limits  | JSONB     | 否   | 配额 JSON，键含 **`max_users`**、**`max_products`**、**`max_customers`**、**`max_suppliers`** 等 |
| trial_days    | INT       | 否   | 试用天数（TRIAL 方案用于注册试用窗口） |
| display_name  | VARCHAR(64) | 是 | 门户展示名（如「试用版本」「启航会员」「优享会员」） |
| list_price_cny | DECIMAL(12,2) | 否 | 标价（人民币）；试用档为 `0` |
| original_price_cny | DECIMAL(12,2) | 是 | 划线原价（可选，门户展示） |
| billing_period_days | INT | 是 | 付费周期天数（如年费 `365`）；**`applyPaidPlan` / 续费** 优先按本字段叠加 **`sub_end_time`** |
| show_in_portal | SMALLINT | 否 | `1` 在会员门户 API 中返回；`0` 隐藏（如停用 WHOLESALE `ENTERPRISE` 展示） |
| status        | SMALLINT  | 否   | `1` 有效；`0` 停用（不参与门户 active 查询） |
| effective_from | TIMESTAMP | 否 | 生效时间 |
| update_time   | TIMESTAMP | 是   | 更新时间 |
| （约束） | UNIQUE(merchant_type, tier_code) | | 同一业态同一等级唯一 |

**约束**：`UNIQUE(merchant_type, tier_code)`；列定义与 **`db/schema-production.sql`** 一致。

#### 1.1.4 租户订阅履历表（tenant_subscriptions）

| 字段名 | 类型 | 说明 |
| ----- | --- | --- |
| id | UUID PK | 主键 |
| tenant_id | VARCHAR(32) FK | 租户 |
| plan_id | UUID FK | 指向 **`subscription_plans`** |
| price_paid | DECIMAL(12,2) | 实付金额；**`> 0`** 且履约成功时触发推荐达标逻辑 |
| currency | VARCHAR(8) | 默认 `CNY` |
| started_at / ended_at | TIMESTAMP | 本条合约区间；付费续费叠加规则见 §2.8 |
| status | VARCHAR(32) | 常见取值：`ACTIVE`、`EXPIRED`、`PENDING`、`REFUNDED`（字符串持久化） |
| external_order_id | VARCHAR(64) | 外部支付单号 |
| create_time | TIMESTAMP | 创建时间 |

*约束（与 DDL 一致）*：`CONSTRAINT chk_tenant_subscriptions_dates CHECK (ended_at >= started_at)`。

#### 1.1.4.1 订阅支付订单（subscription_payment_orders）

会员订阅与杭州银行统一收银台 **`txnOrderId`** 对应的支付事实表；**`tenant_subscriptions.external_order_id`** 可与 **`txn_order_id`** 对齐。约束：**`uq_subscription_payment_orders_txn(txn_order_id)`**；**`amount_cents > 0`**。

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
| ----- | --- | --- | --- | --- |
| id | UUID PK | 否 | gen_random_uuid() | 主键 |
| tenant_id | VARCHAR(32) FK | 否 | - | 租户 |
| user_id | INT FK | 否 | - | 下单用户 → `users(user_id)` |
| txn_order_id | VARCHAR(32) | 否 | - | 商户侧订单号，与行方一致，**UNIQUE** |
| biz_type | VARCHAR(32) | 否 | - | 业务类型，如 **`SUB_NEW`** / **`SUB_RENEW`** / **`SUB_UPGRADE`** |
| target_tier_code | VARCHAR(32) | 是 | - | 目标等级 `dict_code`（D001） |
| plan_id | UUID FK | 是 | - | 关联 **`subscription_plans.plan_id`** |
| amount_cents | BIGINT | 否 | - | 订单金额，**分** |
| currency | VARCHAR(8) | 否 | CNY | 币种 |
| status | VARCHAR(32) | 否 | PENDING | **`PENDING`** / **`PAYING`** / **`SUCCESS`** / **`FAILED`** / **`CLOSED`** 等 |
| channel_resp_code | VARCHAR(16) | 是 | - | 行方最近应答码（如受理/查询摘要） |
| channel_resp_msg | VARCHAR(1024) | 是 | - | 行方最近应答说明 |
| resp_txn_ssn | VARCHAR(64) | 是 | - | 杭州银行平台流水号（受理/通知回写） |
| resp_txn_time | VARCHAR(32) | 是 | - | 行方平台时间戳字符串 |
| hccb_token_code | VARCHAR(128) | 是 | - | 收银台 **`tokenCode`**（跳转用） |
| paid_at | TIMESTAMP | 是 | - | 支付成功履约时间 |
| closed_at | TIMESTAMP | 是 | - | 关单/失败终态时间 |
| create_time | TIMESTAMP | 否 | CURRENT_TIMESTAMP | 创建时间 |
| update_time | TIMESTAMP | 是 | CURRENT_TIMESTAMP | 更新时间 |

索引：`idx_sub_pay_orders_tenant_status(tenant_id, status)`；`idx_sub_pay_orders_create(create_time)`。

#### 1.1.4.2 订阅支付审计流水（subscription_payment_events）

与行方 **`txnAccept`**、异步 **`NOTIFY`**、轮询 **`QUERY`**、履约 **`FULFILL_SUBSCRIPTION`** 等交互的**追加型**流水；**`payment_order_id` ON DELETE CASCADE**。与 **`tenant_subscriptions`** 履历职责分离。

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
| ----- | --- | --- | --- | --- |
| id | UUID PK | 否 | gen_random_uuid() | 主键 |
| payment_order_id | UUID FK | 否 | - | → **`subscription_payment_orders.id`** |
| event_type | VARCHAR(48) | 否 | - | 如 **`TXN_ACCEPT_REQUEST`**、**`TXN_ACCEPT_RESPONSE`**、**`NOTIFY`**、**`QUERY`**、**`FULFILL_SUBSCRIPTION`** |
| http_status | INT | 是 | - | HTTP 状态（外呼行方或接收通知时） |
| channel_resp_code | VARCHAR(16) | 是 | - | 渠道/行方应答码摘要 |
| channel_resp_msg | VARCHAR(2048) | 是 | - | 应答说明摘要 |
| payload_summary | VARCHAR(8192) | 是 | - | 报文摘要（截断存储） |
| create_time | TIMESTAMP | 否 | CURRENT_TIMESTAMP | 事件时间 |

索引：`idx_sub_pay_events_order(payment_order_id, create_time)`。

#### 1.1.5 推荐关系表（referral_records）

| 字段名 | 类型 | 说明 |
| ----- | --- | --- |
| id | UUID PK | 主键 |
| referrer_user_id | INT FK → users | 推荐人用户 |
| referee_tenant_id | VARCHAR(32) FK UNIQUE | 被推荐租户，**一租户仅绑定一条** |
| referral_code_snapshot | VARCHAR(16) | 注册时填写的推荐码快照 |
| status | VARCHAR(32) | **`PENDING`** / **`QUALIFIED`** / **`VOID`** |
| qualified_at | TIMESTAMP | 达标时间 |
| void_reason | VARCHAR(200) | 作废原因 |
| bound_at | TIMESTAMP | 绑定时间 |

#### 1.1.6 推荐奖励明细表（referral_rewards）

| 字段名 | 类型 | 说明 |
| ----- | --- | --- |
| id | UUID PK | 主键 |
| referrer_user_id | INT FK | 获奖推荐人 |
| referral_record_id | UUID FK | 关联 **`referral_records`** |
| reward_amount | DECIMAL(12,2) | 金额；商户推荐默认 **`custom.referral.reward-per-qualified`**（100）；**`ROLE_PROMOTER`** 固定 **150.00** |
| status | VARCHAR(32) | **`ACCRUED`** / **`PAYABLE`** / **`PAID`** / **`REJECTED`** |
| paid_at | TIMESTAMP | 发放时间 |
| create_time | TIMESTAMP | 创建时间 |


#### 1.1.7 能量变动记录表（balanceChgDetails）

| 字段名 | 类型 | 长度 | 可空 | 默认值 | 说明 |
| ----- | --- | --- | --- | --- | --- |
| record_id | VARCHAR | 32 | 否 | - | 记录 ID，主键 |
| tenant_id | VARCHAR | 32 | 否 | - | 租户 ID，FK → `tenants` |
| user_id | INT | - | 否 | - | 用户 ID，FK → `users` |
| change_type | VARCHAR | 50 | 否 | - | 变动类型（字典 **D005**） |
| consume_type | VARCHAR | 50 | 是 | - | 消费类型（字典 **D006**） |
| change_points | INT | - | 否 | - | 变动点数 |
| balance_before | INT | - | 否 | - | 变动前余额 |
| balance_after | INT | - | 否 | - | 变动后余额 |
| related_order | VARCHAR | 50 | 是 | - | 关联订单 |
| remark | VARCHAR | 200 | 是 | - | 备注 |
| create_time | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| update_time | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP | 更新时间 |


### 1.2 CRM模块表

#### 1.2.1 客户表（customers）

| 字段名 | 类型 | 长度 | 可空 | 默认值 | 说明 |
| ----- | --- | --- | --- | --- | --- |
| cust_id | SERIAL | - | 否 | - | 客户 ID，主键 |
| tenant_id | VARCHAR | 32 | 否 | - | 租户 ID，FK → `tenants` |
| user_id | INT | - | 否 | - | 用户 ID，FK → `users` |
| name | VARCHAR | 100 | 否 | - | 客户名称 |
| phone | VARCHAR | 20 | 否 | - | 联系电话，**UNIQUE** |
| email | VARCHAR | 120 | 是 | NULL | 邮箱 |
| source | VARCHAR | 50 | 是 | - | 获客来源（字典 **D008**）；首单/AI 建客写入；**不占 CRM 标签位** |
| cust_status | VARCHAR | 50 | 是 | - | **价值标签**（字典 **D009**）；系统根据订单活跃数据维护；映射 CRM **Badge 1** |
| cust_segment | VARCHAR | 50 | 是 | - | **特色标签**码；系统维护；固定码见 **D014**，动态码 `PC:{category_id}`；映射 CRM **Badge 2** |
| tags_computed_at | TIMESTAMP | - | 是 | NULL | 最近一次系统打标时间 |
| summary | TEXT | - | 是 | - | 摘要 |
| region | VARCHAR | 50 | 是 | - | 区域 |
| address | VARCHAR | 200 | 是 | - | 地址 |
| create_time | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| update_time | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP | 更新时间 |

#### 1.2.2 客户双标签与打标规则（2026-05-31）

CRM 列表/详情 **仅展示 2 个系统标签**，用户不可编辑；新增/编辑弹窗 **不含标签字段**。联系信息（姓名、手机等）仍可编辑；`cust_status`、`cust_segment` 由 **`CustomerTaggingService`**（CRMService 或 RDService 订单事件回调）写入。

**展示**

| Badge | 语义 | 字段 | 字典 |
| ----- | ---- | ---- | ---- |
| Badge 1 | 价值标签（值不值得重点维护） | `cust_status` | **D009** |
| Badge 2 | 特色标签（买什么、有何辨识度） | `cust_segment` | **D014** + 动态 `PC:{id}` → `product_categories.name` |

**有效订单口径**（打标共用）：`orders.order_status <> D010005`（非退货）且 `orders.fin_status <> BAD_DEBT`；品类经 `order_items → products.category_id → product_categories`。

**Badge 1 — `cust_status`（D009）优先级互斥**

| dict_code | 展示名 | 规则（WHOLESALE 默认） |
| --------- | ------ | ---------------------- |
| NEW | 新客 | 建档 ≤ 30 天且有效订单数 ≤ 1 |
| HIGH_VALUE | 高价值 | 近 12 月有效 GMV ≥ 租户 P80，且末单 ≤ 60 天 |
| ACTIVE | 活跃 | 末单 ≤ 60 天，未达 HIGH_VALUE |
| SLEEPING | 沉睡 | 末单 61–180 天 |
| LOST | 流失 | 其余（含建档超 30 天仍 0 单） |

判定顺序：`NEW` → `HIGH_VALUE` → `ACTIVE` → `SLEEPING` → `LOST`。

**Badge 2 — `cust_segment`**

| 存储值 | 展示名 | 规则 |
| ------ | ------ | ---- |
| `PENDING` | 待识别 | 无有效订单，或明细均无 `category_id` |
| `PC:{category_id}` | `{product_categories.name}` | 近 6 月品类 GMV 占比 ≥ 50% |
| `MIXED` | 混合 | Top1 品类占比 30%–50% |
| `GENERAL` | 综合 | Top1 品类占比 < 30% |

**更新时机**：订单创建/签收/结清 → 单客户重算；每日 02:00 全租户补算 Badge 1；每月 1 日全租户重算 Badge 2。

### 1.3 产品与订单模块表

> **命名说明**：下列「字段名」与 **`db/schema-production.sql`** 中 **PostgreSQL 物理列名（蛇形）** 一致；Java/JSON 为驼峰映射。

#### 1.3.1 供应商表（supplier）

| 字段名           | 类型        | 长度  | 可空  | 默认值              | 说明       |
| ------------- | --------- | --- | --- | ---------------- | -------- |
| supplier_id   | SERIAL    | -   | 否   | -                | 供应商主键   |
| tenant_id     | VARCHAR   | 32  | 否   | -                | 租户ID    |
| user_id       | INT       | -   | 否   | -                | 用户ID     |
| name          | VARCHAR   | 100 | 否   | -                | 供应商名称   |
| contact       | VARCHAR   | 50  | 是   | -                | 联系人     |
| phone         | VARCHAR   | 20  | 是   | -                | 联系电话    |
| address       | VARCHAR   | 200 | 是   | -                | 地址       |
| rating        | DECIMAL   | 2,1 | 是   | 0                | 评分       |
| delivery_rate | DECIMAL   | 5,2 | 是   | 0                | 交付率      |
| status        | SMALLINT  | -   | 否   | 1                | 状态       |
| create_time   | TIMESTAMP | -   | 是   | CURRENT_TIMESTAMP | 创建时间    |
| update_time   | TIMESTAMP | -   | 是   | CURRENT_TIMESTAMP | 更新时间    |

#### 1.3.2 仓库表（warehouse）

| 字段名          | 类型        | 长度  | 可空  | 默认值              | 说明    |
| ------------ | --------- | --- | --- | ---------------- | ----- |
| warehouse_id | SERIAL    | -   | 否   | -                | 仓库主键  |
| tenant_id    | VARCHAR   | 32  | 否   | -                | 租户ID  |
| name         | VARCHAR   | 100 | 否   | -                | 仓库名称  |
| address      | VARCHAR   | 200 | 是   | -                | 仓库地址  |
| create_time  | TIMESTAMP | -   | 是   | CURRENT_TIMESTAMP | 创建时间  |
| update_time  | TIMESTAMP | -   | 是   | CURRENT_TIMESTAMP | 更新时间  |

#### 1.3.3 仓库库存表（warehouse_stock）

| 字段名          | 类型        | 长度  | 可空  | 默认值              | 说明      |
| ------------ | --------- | --- | --- | ---------------- | ------- |
| stock_id     | SERIAL    | -   | 否   | -                | 库存记录主键  |
| tenant_id    | VARCHAR   | 32  | 否   | -                | 租户ID    |
| product_id   | INT       | -   | 否   | -                | 产品ID    |
| warehouse_id | INT     | -   | 否   | -                | 仓库ID    |
| stock        | INT       | -   | 否   | 0                | 库存数量    |
| create_time  | TIMESTAMP | -   | 是   | CURRENT_TIMESTAMP | 创建时间    |
| update_time  | TIMESTAMP | -   | 是   | CURRENT_TIMESTAMP | 更新时间    |

#### 1.3.4 产品分类表（product_categories）

| 字段名         | 类型        | 长度  | 可空  | 默认值              | 说明    |
| ----------- | --------- | --- | --- | ---------------- | ----- |
| category_id | SERIAL    | -   | 否   | -                | 分类主键  |
| tenant_id   | VARCHAR   | 32  | 否   | -                | 租户ID  |
| user_id     | INT       | -   | 否   | -                | 用户ID   |
| name        | VARCHAR   | 50  | 否   | -                | 分类名称  |
| description | TEXT      | -   | 是   | -                | 分类描述  |
| create_time | TIMESTAMP | -   | 是   | CURRENT_TIMESTAMP | 创建时间  |
| update_time | TIMESTAMP | -   | 是   | CURRENT_TIMESTAMP | 更新时间  |

#### 1.3.5 产品表（products）

| 字段名           | 类型        | 长度   | 可空  | 默认值              | 说明                                      |
| ------------- | --------- | ---- | --- | ---------------- | --------------------------------------- |
| product_id    | SERIAL    | -    | 否   | -                | 产品主键                                   |
| tenant_id     | VARCHAR   | 32   | 否   | -                | 租户ID                                    |
| user_id       | INT       | -    | 否   | -                | 用户ID                                    |
| supplier_id   | INT       | -    | 是   | NULL             | 供应商ID（`supplier.supplier_id`）            |
| warehouse_id  | INT       | -    | 是   | NULL             | 默认仓库ID（`warehouse.warehouse_id`）          |
| name          | VARCHAR   | 100  | 否   | -                | 产品名称                                    |
| category_id   | INT       | -    | 是   | NULL             | 分类ID（`product_categories.category_id`）；**可空**，前端新增/编辑产品**非必填** |
| description   | TEXT      | -    | 是   | -                | 产品描述                                    |
| sku           | VARCHAR   | 50   | 否   | -                | SKU                                     |
| price         | DECIMAL   | 10,2 | 否   | 0                | 销售价格                                    |
| stock         | INT       | -    | 否   | 0                | 库存数量                                    |
| warning_stock | INT     | -    | 是   | 0                | 预警库存                                    |
| sales_volume  | INT       | -    | 是   | 0                | 销量                                      |
| region        | VARCHAR   | 50   | 是   | -                | 区域/主销区域                                 |
| base_unit     | VARCHAR   | 20   | 是   | -                | 基本单位                                    |
| sales_unit    | VARCHAR   | 20   | 是   | -                | 销售单位                                    |
| purchase_unit | VARCHAR   | 20   | 是   | -                | 采购单位                                    |
| create_time   | TIMESTAMP | -    | 是   | CURRENT_TIMESTAMP | 创建时间                                    |
| update_time   | TIMESTAMP | -    | 是   | CURRENT_TIMESTAMP | 更新时间                                    |

*索引*：**`uq_products_tenant_sku(tenant_id, sku)`** 租户内 SKU 唯一；**`idx_products_tenant_id`**、**`idx_products_warehouse_id`**。

#### 1.3.6 单位换算表（unitConversion）

| 字段名           | 类型        | 长度   | 可空  | 默认值              | 说明     |
| ------------- | --------- | ---- | --- | ---------------- | ------ |
| conversion_id | SERIAL    | -    | 否   | -                | 换算主键   |
| tenant_id     | VARCHAR   | 32   | 否   | -                | 租户ID   |
| product_id    | INT       | -    | 否   | -                | 产品ID   |
| unit_name     | VARCHAR   | 20   | 否   | -                | 单位名称   |
| ratio         | DECIMAL   | 10,2 | 否   | -                | 换算比例   |
| is_default    | BOOLEAN   | -    | 是   | FALSE            | 是否默认单位 |
| create_time   | TIMESTAMP | -    | 是   | CURRENT_TIMESTAMP | 创建时间   |
| update_time   | TIMESTAMP | -    | 是   | CURRENT_TIMESTAMP | 更新时间   |

#### 1.3.7 订单表（orders）

| 字段名 | 类型 | 长度 | 可空 | 默认值 | 说明 |
| ----- | --- | --- | --- | --- | --- |
| order_id | SERIAL | - | 否 | - | 订单 ID，主键 |
| tenant_id | VARCHAR | 32 | 否 | - | 租户 ID，FK → `tenants` |
| user_id | INT | - | 否 | - | 用户 ID，FK → `users` |
| cust_id | INT | - | 否 | - | 客户 ID，FK → `customers` |
| account_id | INT | - | 是 | NULL | 结算账户，FK → `biz_accounts.account_id`，ON DELETE SET NULL |
| order_code | VARCHAR | 50 | 否 | - | 订单编号，**UNIQUE** |
| total_amount | DECIMAL | 12,2 | 否 | 0 | 总金额 |
| order_status | VARCHAR | 50 | 否 | D010001 | 订单**物流**状态（字典 **D010** `dict_code`，持久化 **`D010001`…`D010006`**；DDL 默认 **`D010001`（待配货）**；兼容 `ALLOCATING`/`PICKING` 等别名，入库前经 **`OrderStatusCodes.normalizeForStorage`**） |
| fin_status | VARCHAR | 50 | 否 | UNPAID | 订单**财务**状态（字典 **D015**：`UNPAID`/`PARTIAL_PAID`/`SETTLED`/`BAD_DEBT`） |
| warehouse_id | INT | - | 是 | NULL | 发出仓库 FK → `warehouse(warehouse_id)` ON DELETE SET NULL |
| received_amount | DECIMAL | 12,2 | 否 | 0 | 累计已收金额；与 **`total_amount`** 比较驱动 **`fin_status`** |
| delivery_date | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP | 交付日期 |
| create_time | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| update_time | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP | 更新时间 |

*索引*：**`idx_orders_tenant_create_time(tenant_id, create_time DESC)`**、**`idx_orders_tenant_status(tenant_id, order_status)`**、**`idx_orders_fin_status(tenant_id, fin_status)`**。

#### 1.3.8 订单详情表（order_items）

| 字段名 | 类型 | 长度 | 可空 | 默认值 | 说明 |
| ----- | --- | --- | --- | --- | --- |
| item_id | SERIAL | - | 否 | - | 明细 ID，主键 |
| order_id | INT | - | 否 | - | 订单 ID，FK → `orders` |
| product_id | INT | - | 否 | - | 产品 ID，FK → `products` |
| quantity | INT | - | 否 | - | 数量 |
| unit_price | DECIMAL | 10,2 | 否 | - | 单价 |
| total_amount | DECIMAL | 12,2 | 否 | - | 行总金额 |
| item_status | VARCHAR | 50 | 否 | - | 明细**物流**状态（字典 **D011**） |
| is_processed | BOOLEAN | - | 否 | FALSE | 是否已完成出库处理（发货幂等标志） |
| processed_at | TIMESTAMP | - | 是 | NULL | 出库处理时间 |
| processed_qty | INT | - | 是 | NULL | 已处理数量（通常等于 `quantity`） |
| delivery_date | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP | 交付日期 |
| create_time | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| update_time | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP | 更新时间 |

#### 1.3.9 生产表（production）

> **说明**：**`production`** 表已纳入 **`db/schema-production.sql`**（L3 物料档案，依赖 `products`）；**RDService** 通过 JPA **`Production.java`** 读写。风险等级关联字典 **D007**。

| 字段名 | 类型 | 长度 | 可空 | 默认值 | 说明 |
| ----- | --- | --- | --- | --- | --- |
| prod_id | SERIAL | - | 否 | - | 生产 ID，主键 |
| tenant_id | VARCHAR | 32 | 否 | - | 租户 ID，FK → `tenants` |
| user_id | INT | - | 是 | - | 操作用户 ID，FK → `users` |
| product_id | INT | - | 是 | - | 产品 ID，FK → `products` |
| quantity | INT | - | 否 | - | 生产数量 |
| delivery_time | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP | 交货时间 |
| progress | INT | - | 是 | 0 | 生产进度（0–100） |
| risk_level | VARCHAR | 50 | 是 | - | 风险等级（字典 **D007**） |
| notes | TEXT | - | 是 | - | 备注 |
| create_time | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| update_time | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP | 更新时间 |

索引：`idx_production_tenant_id`、`idx_production_product_id`、`idx_production_user_id`。


### 1.4 供应链模块表

> **命名说明**：下列「字段名」与 **`db/schema-production.sql`** 的 **PostgreSQL 物理列名（蛇形）** 一致。Java 实体 / JSON 侧为 **驼峰**（如 `purchase_id` → `purchaseId`），由 MyBatis `map-underscore-to-camel-case` 与 Jackson 默认策略映射。

#### 1.4.1 进货单主表（purchases）

| 字段名             | 类型        | 长度   | 可空  | 默认值              | 说明                                  |
| --------------- | --------- | ---- | --- | ---------------- | ----------------------------------- |
| purchase_id     | SERIAL    | -    | 否   | -                | 进货单主键                               |
| tenant_id       | VARCHAR   | 32   | 否   | -                | 租户ID                                |
| user_id         | INT       | -    | 否   | -                | 用户ID                                |
| account_id      | INT       | -    | 是   | NULL             | 付款账户ID（外键 `biz_accounts.account_id`） |
| purchase_code   | VARCHAR   | 50   | 是   | -                | 进货单号                                |
| supplier_id     | INT       | -    | 否   | -                | 供应商ID                               |
| warehouse_id    | INT       | -    | 是   | NULL             | 入库仓库ID                              |
| total_amount    | DECIMAL   | 12,2 | 否   | -                | 总金额                                 |
| paid_amount     | DECIMAL   | 12,2 | 否   | -                | 已付金额                                |
| fin_status      | VARCHAR   | 50   | 否   | UNPAID           | 进货**财务**状态（字典 **D016**）              |
| purchase_status | VARCHAR   | 20   | 否   | DRAFT            | 进货**物流**状态（字典 **D012** `dict_code`；DDL 默认 **`DRAFT`**）   |
| purchase_date   | TIMESTAMP | -    | 否   | -                | 进货日期                                |
| create_time     | TIMESTAMP | -    | 是   | CURRENT_TIMESTAMP | 创建时间                                |
| update_time     | TIMESTAMP | -    | 是   | CURRENT_TIMESTAMP | 更新时间                                |

#### 1.4.2 进货明细表（purchase_items）

| 字段名             | 类型        | 长度   | 可空  | 默认值              | 说明         |
| --------------- | --------- | ---- | --- | ---------------- | ---------- |
| p_item_id       | SERIAL    | -    | 否   | -                | 明细主键       |
| purchase_id     | INT       | -    | 否   | -                | 进货单ID      |
| product_id      | INT       | -    | 否   | -                | 产品ID       |
| quantity        | INT       | -    | 是   | 0                | 数量         |
| unit_price      | DECIMAL   | 10,2 | 否   | -                | 单价         |
| unit_name       | VARCHAR   | 20   | 是   | -                | 单位名称       |
| batch_no        | VARCHAR   | 50   | 是   | -                | 批次号        |
| purchase_status | VARCHAR   | 20   | 否   | -                | 明细物流状态（字典 **D012**，与主表同步） |
| is_processed    | BOOLEAN   | -    | 否   | FALSE            | 是否已完成入库处理（入库幂等标志） |
| processed_at    | TIMESTAMP | -    | 是   | NULL             | 入库处理时间 |
| processed_qty   | INT       | -    | 是   | NULL             | 已入库数量 |
| purchase_date   | TIMESTAMP | -    | 否   | -                | 明细业务日期     |
| create_time     | TIMESTAMP | -    | 是   | CURRENT_TIMESTAMP | 创建时间       |
| update_time     | TIMESTAMP | -    | 是   | CURRENT_TIMESTAMP | 更新时间       |

#### 1.4.3 账户信息表（biz_accounts）

| 字段名               | 类型        | 长度  | 可空  | 默认值              | 说明                |
| ----------------- | --------- | --- | --- | ---------------- | ----------------- |
| account_id        | SERIAL    | -   | 否   | -                | 账户主键              |
| tenant_id         | VARCHAR   | 32  | 否   | -                | 租户ID              |
| user_id           | INT       | -   | 否   | -                | 创建用户ID            |
| account_type      | VARCHAR   | 50  | 否   | -                | 账户类型（支付宝/微信/银行卡等） |
| account_name      | VARCHAR   | 100 | 否   | -                | 账户名称              |
| account_no        | VARCHAR   | 100 | 否   | -                | 账户号/卡号            |
| account_holder    | VARCHAR   | 100 | 是   | NULL             | 归属主体              |
| balance           | DECIMAL   | 14,2 | 否   | 0                | 账户余额（与流水一致；可手动调整并记流水） |
| is_default_receive | BOOLEAN   | -   | 是   | FALSE            | 是否默认收款账户          |
| is_default_pay    | BOOLEAN   | -   | 是   | FALSE            | 是否默认付款账户          |
| status            | SMALLINT  | -   | 否   | 1                | 状态（1有效，0删除）       |
| create_time       | TIMESTAMP | -   | 是   | CURRENT_TIMESTAMP | 创建时间              |
| update_time       | TIMESTAMP | -   | 是   | CURRENT_TIMESTAMP | 更新时间              |

#### 1.4.4 账户流水表（biz_account_ledger）

| 字段名               | 类型        | 长度  | 可空  | 默认值              | 说明 |
| ----------------- | --------- | --- | --- | ---------------- | --- |
| ledger_id         | BIGSERIAL | -   | 否   | -                | 主键 |
| tenant_id         | VARCHAR   | 32  | 否   | -                | 租户 |
| account_id        | INT       | -   | 否   | -                | 账户（FK biz_accounts） |
| txn_type          | VARCHAR   | 20  | 否   | -                | RECEIPT 收款 / PAYMENT 付款 |
| amount            | DECIMAL   | 14,2 | 否   | -                | 金额（正数） |
| txn_time          | TIMESTAMP | -   | 否   | -                | 业务发生时间 |
| balance_after     | DECIMAL   | 14,2 | 否   | -                | 本笔后账户余额 |
| counterparty_label | VARCHAR | 300 | 是   | NULL             | 对方账号/名称展示 |
| source_type       | VARCHAR   | 32  | 否   | -                | ORDER / PURCHASE / BALANCE_EDIT |
| source_id         | BIGINT    | -   | 是   | NULL             | 关联单据或账户等业务 ID |
| idempotency_key   | VARCHAR   | 128 | 是   | NULL             | 幂等键（租户内唯一，部分流水） |
| biz_type_code     | VARCHAR   | 50  | 是   | NULL             | 业务类型（字典 **D017**：`SALES_INCOME`/`PURCHASE_EXPENSE`/`REFUND`/`COMMISSION`） |
| create_time       | TIMESTAMP | -   | 是   | CURRENT_TIMESTAMP | 写入时间 |

**入账规则（与实现一致，2026-05-25 双线解耦）**：

| 触发节点 | 服务 | 接口/动作 | 流水 |
| --- | --- | --- | --- |
| 销售收款 | RDService | **`POST /api/v1/rd/orders/{id}/record-payment`** | `txn_type=RECEIPT`，`biz_type_code=SALES_INCOME`（默认），按本次 **`amount`** 写入；回写 **`orders.received_amount`** 与 **`fin_status`** |
| 采购付款 | SuppService | **`POST /api/v1/supp/purchases/{id}/record-payment`** | `txn_type=PAYMENT`，`biz_type_code=PURCHASE_EXPENSE`（默认），按 **`paid_amount` 增量** 写流水；回写 **`fin_status`** |
| 销售发货 | RDService | **`POST /api/v1/rd/orders/{id}/ship`** | **不写**财务流水；扣减 **`warehouse_stock`**，明细 **`is_processed=true`** |
| 采购入库 | SuppService | **`POST /api/v1/supp/purchases/{id}/inbound`** | **不写**财务流水；增加 **`warehouse_stock`**，明细 **`is_processed=true`** |
| 元数据保存 | RDService | **`PUT /api/v1/rd/orders/{id}/save`** | 可改物流/财务状态标记与账户，**不**改 **`received_amount`**、**不写**流水 |
| 手动调账 | IMService | 账户保存余额变更 | `source_type=BALANCE_EDIT` 轧差 |

**说明**：物流状态变更（含旧版「已完成即入账」）**不再**自动产生流水；存量 **`COMPLETED`/`D010003`** 等迁移逻辑已内置于 **`db/schema-production.sql`** 末尾存量 `UPDATE` 段（历史增量脚本 **`alter_document_status_inventory.sql`** 已废弃并删除）。进货单 **`updatePurchase`** 若仍变更 **`paid_amount`** 差额，经 **`AccountLedgerAppender.onPurchasePaidAmountChanged`** 记账（与独立 **`record-payment`** 并存，前端编辑场景优先显式 **`record-payment`**）。

**索引（与 `db/schema-production.sql` 一致）**：`idx_biz_account_ledger_tenant_account_time(tenant_id, account_id, txn_time DESC)`；**`idx_biz_account_ledger_idempotency`** 为 **`UNIQUE (tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL`**（部分流水幂等）；**`idx_ledger_biz_type(tenant_id, biz_type_code)`**。


### 1.5 系统表

#### 1.5.1 字典表（dictionary）

| 字段名 | 类型 | 长度 | 可空 | 默认值 | 说明 |
| ----- | --- | --- | --- | --- | --- |
| dict_id | VARCHAR | 32 | 否 | - | 字典 ID，主键 |
| parent_id | VARCHAR | 32 | 是 | - | 父级 ID，FK → `dictionary(dict_id)` |
| dict_code | VARCHAR | 50 | 否 | - | 字典编码 |
| dict_name | VARCHAR | 50 | 否 | - | 字典名称 |
| dict_level | SMALLINT | - | 否 | - | 层级 |
| sort | INT | - | 是 | 0 | 排序 |
| remark | VARCHAR | 200 | 是 | - | 备注 |
| status | SMALLINT | - | 否 | 1 | 状态 |
| create_time | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| update_time | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP | 更新时间 |


#### 1.5.2 字典初始化内容

##### 1.5.2.1 字典大类列表


| dictid | parentid | dictcode            | dictname | dictlevel | sort | remark                      |
| ------ | -------- | ------------------- | -------- | --------- | ---- | --------------------------- |
| D001   | NULL     | SUBSCRIPTIONTYPE    | 订阅类型     | 1         | 1    | 租户的订阅套餐类型                   |
| D002   | NULL     | TENANTSTATUS        | 租户状态     | 1         | 2    | 租户全生命周期状态（从注册到流失的阶段划分）      |
| D003   | NULL     | ROLETYPE            | 角色类型     | 1         | 3    | 商户子用户预设的商贸角色类型              |
| D004   | NULL     | USERSTATUS          | 用户状态     | 1         | 4    | 商户子用户的账号状态                  |
| D005   | NULL     | ENERGYCHANGETYPE    | 能量变动类型   | 1         | 5    | AI能量点余额变动的核心类型              |
| D006   | NULL     | ENERGYCONSUMETYPE   | AI消费类型   | 1         | 6    | AI能量点变动的具体功能场景              |
| D007   | NULL     | PRODUCTIONRISK      | 生产风险等级   | 1         | 7    | 生产计划/新品研发的风险等级分类            |
| D008   | NULL     | CUSTOMERSOURCE      | 客户来源     | 1         | 8    | 商户客户的获取渠道分类                 |
| D009   | NULL     | CUSTOMERSTATUS      | 客户价值标签   | 1         | 9    | CRM Badge 1；`customers.cust_status`；系统维护 |
| D014   | NULL     | CUSTOMER_SEGMENT    | 客户特色标签   | 1         | 14   | CRM Badge 2 固定码；动态码 `PC:{category_id}` 见 §1.2.2 |
| D010   | NULL     | ORDERSTATUS         | 订单物流状态   | 1         | 10   | 销售订单物流生命周期（与 D015 财务状态正交） |
| D011   | NULL     | ITEMSTATUS          | 商品明细物流状态 | 1         | 11   | 订单/进货明细行物流处理状态 |
| D012   | NULL     | PURCHASEORDERSTATUS | 进货单据物流状态 | 1         | 12   | 进货单物流：草稿、审核、入库等 |
| D013   | NULL     | MERCHANT_TYPE       | 商户类型     | 1         | 13   | SaaS 多业态：批发 / 外贸 / 电商 / 工贸；子项 `dict_code` 写入 `tenants.merchant_type` 与 JWT |
| D015   | NULL     | ORDER_FIN_STATUS    | 销售单财务状态  | 1         | 15   | `orders.fin_status` |
| D016   | NULL     | PURCHASE_FIN_STATUS | 进货单财务状态  | 1         | 16   | `purchases.fin_status` |
| D017   | NULL     | LEDGER_BIZ_TYPE     | 财务流水业务类型 | 1         | 17   | `biz_account_ledger.biz_type_code` |


##### 1.5.2.2 字典子项详细列表

> **实现说明**：`InitCfgService` **`db/seed-data.sql`** 物理写入的 `dict_code` 为大写下划线风格（如 `SUBSCRIPTION_TYPE`、`MERCHANT_TYPE`）；下表与 **种子 SQL 保持一致**。字典编号 **D014** 预留未使用。

**D001 - 订阅类型**

> **物理主键**：种子写入字典行的 `dict_id` 为 **`D001_001`～`D001_004`**（下划线风格）。下表「dictid」列与产品文档编号对应关系：**D001001 ≡ D001_001**，以此类推。


| dictid  | parentid | dictcode   | dictname | dictlevel | sort | remark     |
| ------- | -------- | ---------- | -------- | --------- | ---- | ---------- |
| D001001 | D001     | TRIAL      | 试用版      | 2         | 1    | 试用版本，有效期较短 |
| D001002 | D001     | BASIC      | 启航会员    | 2         | 2    | 启航会员等级（对应 BASIC） |
| D001003 | D001     | PREMIUM    | 优享会员    | 2         | 3    | 优享会员等级（对应 PREMIUM） |
| D001004 | D001     | ENTERPRISE | 尊享会员    | 2         | 4    | 尊享会员等级（对应 ENTERPRISE） |


**D002 - 租户状态**


| dictid  | parentid | dictcode   | dictname | dictlevel | sort | remark  |
| ------- | -------- | ---------- | -------- | --------- | ---- | ------- |
| D002001 | D002     | NORMAL     | 正常       | 2         | 1    | 租户状态正常  |
| D002002 | D002     | EXPIRED    | 过期       | 2         | 2    | 租户订阅已过期 |
| D002003 | D002     | SUSPENDED  | 暂停       | 2         | 3    | 租户账号已暂停 |
| D002004 | D002     | TERMINATED | 终止       | 2         | 4    | 租户账号已终止 |


**D003 - 角色类型**


| dictid  | parentid | dictcode | dictname | dictlevel | sort | remark  |
| ------- | -------- | -------- | -------- | --------- | ---- | ------- |
| D003001 | D003     | ADMIN    | 管理员      | 2         | 1    | 系统管理员角色 |
| D003002 | D003     | USER     | 普通用户     | 2         | 2    | 普通用户角色  |
| D003003 | D003     | OPERATOR | 操作员      | 2         | 3    | 系统操作员角色 |


**D004 - 用户状态**


| dictid  | parentid | dictcode | dictname | dictlevel | sort | remark  |
| ------- | -------- | -------- | -------- | --------- | ---- | ------- |
| D004001 | D004     | NORMAL   | 正常       | 2         | 1    | 用户状态正常  |
| D004002 | D004     | LOCKED   | 锁定       | 2         | 2    | 用户账号已锁定 |
| D004003 | D004     | DISABLED | 禁用       | 2         | 3    | 用户账号已禁用 |


**D005 - 变动类型**


| dictid  | parentid | dictcode    | dictname | dictlevel | sort | remark |
| ------- | -------- | ----------- | -------- | --------- | ---- | ------ |
| D005001 | D005     | RECHARGE    | 充值       | 2         | 1    | 能量点充值  |
| D005002 | D005     | CONSUMPTION | 消费       | 2         | 2    | 能量点消费  |
| D005003 | D005     | GIFT        | 赠送       | 2         | 3    | 能量点赠送  |
| D005004 | D005     | REFUND      | 退款       | 2         | 4    | 能量点退款  |


**D006 - 消费类型**


| dictid  | parentid | dictcode         | dictname | dictlevel | sort | remark   |
| ------- | -------- | ---------------- | -------- | --------- | ---- | -------- |
| D006001 | D006     | AIEXTRACTION     | AI提取     | 2         | 1    | AI信息提取消费 |
| D006002 | D006     | AIANALYSIS       | AI分析     | 2         | 2    | AI数据分析消费 |
| D006003 | D006     | AIPREDICTION     | AI预测     | 2         | 3    | AI预测分析消费 |
| D006004 | D006     | AIRECOMMENDATION | AI推荐     | 2         | 4    | AI推荐服务消费 |


**D007 - 风险等级**


| dictid  | parentid | dictcode | dictname | dictlevel | sort | remark |
| ------- | -------- | -------- | -------- | --------- | ---- | ------ |
| D007001 | D007     | LOW      | 低        | 2         | 1    | 低风险等级  |
| D007002 | D007     | MEDIUM   | 中        | 2         | 2    | 中等风险等级 |
| D007003 | D007     | HIGH     | 高        | 2         | 3    | 高风险等级  |


**D008 - 客户来源**


| dictid  | parentid | dictcode | dictname | dictlevel | sort | remark  |
| ------- | -------- | -------- | -------- | --------- | ---- | ------- |
| D008001 | D008     | WECHAT   | 微信       | 2         | 1    | 微信渠道获取  |
| D008002 | D008     | ALIPAY   | 支付宝      | 2         | 2    | 支付宝渠道获取 |
| D008003 | D008     | PHONE    | 电话       | 2         | 3    | 电话渠道获取  |
| D008004 | D008     | OTHER    | 其他       | 2         | 4    | 其他渠道获取  |


**D009 - 客户价值标签（CRM Badge 1，`customers.cust_status`）**


| dictid  | parentid | dictcode   | dictname | dictlevel | sort | remark |
| ------- | -------- | ---------- | -------- | --------- | ---- | ------ |
| D009_004 | D009    | NEW        | 新客       | 2         | 0    | 建档初期，见 §1.2.2 |
| D009_005 | D009    | HIGH_VALUE | 高价值     | 2         | 1    | 近 12 月 GMV Top 20% 且近期有单 |
| D009_001 | D009    | ACTIVE     | 活跃       | 2         | 2    | 近 60 天有有效订单 |
| D009_002 | D009    | SLEEPING   | 沉睡       | 2         | 3    | 末单 61–180 天 |
| D009_003 | D009    | LOST       | 流失       | 2         | 4    | 超 180 天无单或长期 0 单 |

> **迁移说明**：`D009_001`–`D009_003` 与 **`db/seed-data.sql`** 存量 `dict_code` 一致；v1.23 新增 **`NEW`（D009_004）**、**`HIGH_VALUE`（D009_005）**；首次全量打标后按 §1.2.2 重算各客户 `cust_status`。

**D014 - 客户特色标签固定码（CRM Badge 2，`customers.cust_segment` 中非 `PC:*` 部分）**


| dictid   | parentid | dictcode | dictname | dictlevel | sort | remark |
| -------- | -------- | -------- | -------- | --------- | ---- | ------ |
| D014_001 | D014     | MIXED    | 混合       | 2         | 1    | 多品类采购，Top1 占比 30%–50% |
| D014_002 | D014     | GENERAL  | 综合       | 2         | 2    | 品类分散，Top1 < 30% |
| D014_003 | D014     | PENDING  | 待识别     | 2         | 3    | 无有效订单或无分类数据 |

> 主营品类展示：`cust_segment = PC:{category_id}` 时，展示名取租户 **`product_categories.name`**（不占 dictionary 行）。

**D010 - 订单物流状态**


| dictid  | parentid | dictcode   | dictname | dictlevel | sort | remark  |
| ------- | -------- | ---------- | -------- | --------- | ---- | ------- |
| D010001 | D010     | ALLOCATING | 待配货      | 2         | 1    | 等待仓库分配 |
| D010002 | D010     | PICKING    | 拣货中      | 2         | 2    | 仓库拣货中 |
| D010003 | D010     | SHIPPED    | 已发货      | 2         | 3    | 出库扣减点 |
| D010004 | D010     | RECEIVED   | 已签收      | 2         | 4    | 物流完结 |
| D010005 | D010     | RETURNED   | 退货       | 2         | 5    | 逆向入库 |


**D011 - 商品明细物流状态**


| dictid  | parentid | dictcode   | dictname | dictlevel | sort | remark  |
| ------- | -------- | ---------- | -------- | --------- | ---- | ------- |
| D011001 | D011     | PENDING    | 待处理      | 2         | 1    | 新建明细默认 |
| D011002 | D011     | ALLOCATING | 配货中      | 2         | 2    | 纳入拣货 |
| D011003 | D011     | FULFILLED  | 已发货/已收货 | 2         | 3    | 物流完成 |
| D011004 | D011     | EXCEPTION  | 异常       | 2         | 4    | 缺货破损等 |


**D012 - 进货单据物流状态**


| dictid  | parentid | dictcode        | dictname | dictlevel | sort | remark    |
| ------- | -------- | --------------- | -------- | --------- | ---- | --------- |
| D012001 | D012     | DRAFT           | 草稿       | 2         | 1    | 可编辑 |
| D012002 | D012     | PENDING_REVIEW  | 待审核      | 2         | 2    | 待审批 |
| D012003 | D012     | APPROVED        | 审核通过     | 2         | 3    | 待入库 |
| D012004 | D012     | PARTIAL_INBOUND | 部分入库     | 2         | 4    | 增量入库 |
| D012005 | D012     | FULL_INBOUND    | 全部入库     | 2         | 5    | 完结入库 |
| D012006 | D012     | VOIDED          | 作废       | 2         | 6    | 禁止入库 |

**D015 - 销售单财务状态**（`orders.fin_status`）

| dictid  | parentid | dictcode     | dictname | dictlevel | sort | remark |
| ------- | -------- | ------------ | -------- | --------- | ---- | ------ |
| D015001 | D015     | UNPAID       | 未收款      | 2         | 1    | 尚未收款 |
| D015002 | D015     | PARTIAL_PAID | 部分收款     | 2         | 2    | 部分收款 |
| D015003 | D015     | SETTLED      | 已结清      | 2         | 3    | 已全部收款 |
| D015004 | D015     | BAD_DEBT     | 坏账       | 2         | 4    | 坏账 |

**D016 - 进货单财务状态**（`purchases.fin_status`）

| dictid  | parentid | dictcode     | dictname | dictlevel | sort | remark |
| ------- | -------- | ------------ | -------- | --------- | ---- | ------ |
| D016001 | D016     | UNPAID       | 未付款      | 2         | 1    | 尚未付款 |
| D016002 | D016     | PARTIAL_PAID | 部分付款     | 2         | 2    | 部分付款 |
| D016003 | D016     | SETTLED      | 已结清      | 2         | 3    | 已全部付款 |

**D017 - 财务流水业务类型**（`biz_account_ledger.biz_type_code`）

| dictid  | parentid | dictcode          | dictname | dictlevel | sort | remark |
| ------- | -------- | ----------------- | -------- | --------- | ---- | ------ |
| D017001 | D017     | SALES_INCOME      | 销售收入     | 2         | 1    | 销售收款 |
| D017002 | D017     | PURCHASE_EXPENSE  | 采购支出     | 2         | 2    | 采购付款 |
| D017003 | D017     | REFUND            | 退款       | 2         | 3    | 退款 |
| D017004 | D017     | COMMISSION        | 佣金       | 2         | 4    | 佣金 |

**D013 - 商户类型（与 `TenantService` / JWT / 网关一致）**


| dictid   | parentid | dictcode       | dictname | dictlevel | sort | remark      |
| -------- | -------- | -------------- | -------- | --------- | ---- | ----------- |
| D013_001 | D013     | WHOLESALE      | 批发       | 2         | 1    | 默认业态      |
| D013_002 | D013     | FOREIGN_TRADE  | 外贸       | 2         | 2    | 外贸业态      |
| D013_003 | D013     | ECOM           | 电商       | 2         | 3    | 电商业态      |
| D013_004 | D013     | FACTORY_TRADE  | 工贸       | 2         | 4    | 工贸业态      |


**片段目录映射（TradeMind-Web）**：`WHOLESALE→wholesale`，`FOREIGN_TRADE→foreign`，`ECOM→ecom`，`FACTORY_TRADE→factory`（见 `/fragments/`）。

#### 1.5.3 订阅配额配置存储（方案约定）

不同 **商户类型（D013）** 与 **订阅等级（D001 `dict_code`）** 组合下，「最大用户数、产品/SKU 数、客户数、供应商数」等上限允许各不相同。**权威配置**落在 **`subscription_plans`** 表中（§1.1.3），按 **`merchant_type` + `tier_code`** 唯一区分一行；各上限以 **`quota_limits` JSONB** 存放（键如 **`max_users`**、**`max_products`**、**`max_customers`**、**`max_suppliers`**）。**实现说明**：**`db/schema-production.sql`** 负责建表；**`db/seed-data.sql`** 在表为空时为四种 **`merchant_type`** × 四档 **`tier_code`** 生成默认 **`quota_limits` / `feature_matrix`**（含 WHOLESALE 定价覆盖）。后续调整可通过 **SQL / 管理端** 改 JSONB。**RDService/CRMService 等写入前配额校验（AOP/Redis）** 仍为后续迭代。若需约束「某业态启用哪些配额键」，可另增 **`quota_metric_definitions`**。

#### 1.5.4 AI操作记录表（ai_operation_records）

| 字段名 | 类型 | 长度 | 可空 | 默认值 | 说明 |
| ----- | --- | --- | --- | --- | --- |
| record_id | SERIAL | - | 否 | - | 主键 |
| tenant_id | VARCHAR | 32 | 否 | - | 租户 ID，FK → `tenants` |
| user_id | INT | - | 否 | - | 用户 ID，FK → `users` |
| request_id | VARCHAR | 50 | 否 | - | 请求 ID |
| op_type | VARCHAR | 50 | 否 | - | 操作类型 |
| ai_result | TEXT | - | 否 | - | AI 结果 |
| status | VARCHAR | 16 | 否 | - | 状态 |
| input_content | TEXT | - | 是 | - | 输入内容 |
| create_time | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| update_time | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP | 更新时间 |


### 1.6 运维中台表（OpsService）

> 运维中台表定义见 **`db/schema-production.sql`** L5 段（**`ops_tenant_snapshot`、`ai_usage_stats`、`ops_subscription_logs`、`system_announcements`** 等）。

#### 1.6.1 租户资源快照（ops_tenant_snapshot）

按时间点记录租户产品/客户/供应商数量，供运维大盘与租户树排序。

| 字段名 | 类型 | 可空 | 说明 |
| ----- | --- | --- | --- |
| id | BIGSERIAL PK | 否 | 主键 |
| tenant_id | VARCHAR(32) FK | 否 | 租户 |
| snapshot_at | TIMESTAMP | 否 | 快照时间 |
| product_cnt | INT | 否 | 产品数，默认 `0` |
| customer_cnt | INT | 否 | 客户数，默认 `0` |
| supplier_cnt | INT | 否 | 供应商数，默认 `0` |

*约束*：`UNIQUE(tenant_id, snapshot_at)`；索引 **`idx_ops_snap_tenant_time(tenant_id, snapshot_at DESC)`**。

#### 1.6.2 AI Token 计量（ai_usage_stats）

| 字段名 | 类型 | 可空 | 说明 |
| ----- | --- | --- | --- |
| id | BIGSERIAL PK | 否 | 主键 |
| tenant_id | VARCHAR(32) FK | 否 | 租户 |
| feature_code | VARCHAR(64) | 否 | 功能编码（如 AI 提取场景） |
| prompt_tokens | INT | 否 | 提示 tokens，默认 `0` |
| completion_tokens | INT | 否 | 补全 tokens，默认 `0` |
| total_tokens | INT | 否 | 合计 tokens，默认 `0` |
| occurred_at | TIMESTAMP | 否 | 发生时间，默认 `CURRENT_TIMESTAMP` |
| request_id | VARCHAR(64) | 是 | 关联 AI 请求 ID |

索引：`idx_ai_usage_tenant_time(tenant_id, occurred_at)`；`idx_ai_usage_time(occurred_at)`。

#### 1.6.3 订阅权益赠送审计（ops_subscription_logs）

| 字段名 | 类型 | 可空 | 说明 |
| ----- | --- | --- | --- |
| id | UUID PK | 否 | 主键 |
| target_tenant_id | VARCHAR(32) FK | 否 | 被操作租户 |
| operator_user_id | INT FK | 否 | 运维操作人 → `users` |
| prev_sub_end_time | TIMESTAMP | 否 | 变更前订阅结束时间 |
| new_sub_end_time | TIMESTAMP | 否 | 变更后订阅结束时间 |
| reason | VARCHAR(500) | 是 | 操作原因 |
| extra_json | JSONB | 是 | 扩展信息 |
| created_at | TIMESTAMP | 否 | 创建时间 |

索引：`idx_ops_sub_logs_tenant(target_tenant_id, created_at DESC)`。

#### 1.6.4 全站公告（system_announcements）

| 字段名 | 类型 | 可空 | 说明 |
| ----- | --- | --- | --- |
| id | UUID PK | 否 | 主键 |
| title | VARCHAR(200) | 否 | 标题 |
| body_md | TEXT | 是 | Markdown 正文 |
| priority | INT | 否 | 优先级，默认 `0` |
| active_from | TIMESTAMP | 否 | 生效开始 |
| active_until | TIMESTAMP | 是 | 生效结束（空表示长期） |
| created_by | INT FK | 否 | 创建人 → `users` |
| created_at | TIMESTAMP | 否 | 创建时间 |
| updated_at | TIMESTAMP | 否 | 更新时间 |

索引：`idx_announce_active(active_from, active_until)`。

---

## 2. 微服务架构设计

### 2.1 服务列表

商贸智脑系统由以下多个微服务组成：


| 服务名称    | 服务标识           | 技术栈                       | 主要职责                            |
| ------- | -------------- | ------------------------- | ------------------------------- |
| 租户服务    | TenantService  | Spring Boot 3.x           | 租户/用户/认证；**订阅试用与履历**（`SubscriptionLifecycleService`、`tenant_subscriptions`）；**推荐绑定与达标奖励**（`ReferralBindingService`、`ReferralQualificationService`）；**新手导览状态**（`OnboardingStateService`、`OnboardingController`）；JWT 含 **`merchantType`、`accessMode`、`subscriptionTier`、`subEndMs`**；注册 body 支持 **`referralCode`** |
| 初始化配置服务 | InitCfgService | Spring Boot 3.x           | 配置管理、RDS/OSS/AI 配置；**唯一数据库初始化引擎**（`db/schema-production.sql` + `db/seed-data.sql` + `validateCoreSchema()`） |
| 客户关系服务  | CRMService     | Spring Boot 3.x           | 客户信息管理                          |
| 进销存服务   | RDService      | Spring Boot 3.x           | 产品管理、订单管理、生产管理、单位换算、仓库管理、产品分类管理 |
| 供应商服务   | SuppService    | Spring Boot 3.x + MyBatis | 供应商管理、进货单管理                     |
| AI智能服务  | AIService      | Spring Boot 3.x           | AI大模型调用、订单提取、语音处理               |
| 智能报表服务  | IMService      | Spring Boot 3.x           | 营收报表、库存健康、盈利分析、往来账务             |
| 运维中台服务  | OpsService     | Spring Boot 3.x + JPA     | 租户大盘/树、订阅延期、推荐奖励运维、AI Token 统计、全站公告；**仅限 `SYSTEM_OPS` + `ROLE_OPS_ADMIN`** |
| API网关   | trademind-gateway | Spring Cloud Gateway    | 服务路由、JWT 校验、注入身份头；**`/api/v1/ops/**` 运维 RBAC**；**按 JWT `accessMode` 限制访问**（`READ_ONLY` 禁写、`BILLING_ONLY` 仅白名单片段）；**`AuthService.isTenantSubscriptionAccessAllowed`**；环境变量 **`AUTH_WHITELIST`**、**`SUBSCRIPTION_BYPASS_FRAGMENTS`**（见 §2.4.3–§2.4.5） |


### 2.2 服务间交互关系

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                    前端 (TradeMind-Web)                          │
└───────────────────────────────────────┬──────────────────────────────────────────┘
                                        │
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                  API网关                                        │
└────────────────┬────────────────────────────────────────────────────────────────┘
                 │
                 ├────────────────────┬────────────────────┬────────────────────┐
                 │                    │                    │                    │
         ┌────────┴────────┐ ┌─────────┴─────────┐ ┌─────────┴─────────┐ ┌─────────┴─────────┐
         │  TenantService   │ │ InitCfgService   │ │  CRMService       │ │  RDService      │
         │  (认证/租户管理)│ │ (配置管理)       │ │ (客户管理)       │ │ (产品/订单/仓库)│
         └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
                 │                    │                    │                    │
         ┌────────┴────────┐ ┌─────────┴─────────┐ ┌─────────────────────────────┘
         │  SuppService    │ │   AIService      │ │      OpsService             │
         │ (供应商/进货)  │ │ (AI处理)        │ │ (运维中台/大盘)            │
         └─────────────────┘ └─────────────────┘ └─────────────────────────────┘
                 │                    │
                 └─────────────────┬─────────────────────────────────────────────┘
                                   │
                           ┌────────┴─────────┐
                           │   IMService      │
                           │   (报表分析)    │
                           └─────────────────┘
```

### 2.3 数据流向说明

1. **认证流程**：前端 → TenantService → 签发 JWT（含 `userId`、`userName`、`tenantId`、`roleType`、`merchantType`、`accessMode`、`subscriptionTier`、`subEndMs`）；登录时 **`AccessModeEvaluator`** 根据 **`sub_end_time`** 与 **`custom.subscription.grace-days-after-expiry`** 刷新 **`tenants.access_mode`** 并写入令牌
2. **配置获取**：各服务 → InitCfgService → 获取RDS/OSS/AI配置
3. **业务操作**：前端 → API网关（校验 JWT，注入身份头）→ 对应业务服务 → 数据库；下游可通过 `UserContext.getMerchantType()`（各服务命名略有差异）读取 **`X-Merchant-Type`**
4. **AI处理**：前端 → AIService → 大模型API → 数据库记录
5. **报表查询**：前端 → IMService → 数据库聚合查询
6. **运维操作**：运维前端 → 网关（JWT 校验 + **`ROLE_OPS_ADMIN`** 鉴权）→ OpsService → 数据库；订阅延期等写操作记入 **`ops_subscription_logs`**

### 2.4 网关路由与跨域拉齐规范（2026-04-30）

#### 2.4.1 统一入口与路由规则

- 前端统一使用`/api`作为网关入口前缀（如`/api/v1/tenant/login`、`/api/v1/rd/products`）。
- 网关路由`predicates.Path`统一包含`/api`前缀，网关负责将外部路径映射到各后端服务实际上下文。
- 对于后端已包含`/api/v1/...`上下文的服务（如TenantService/CRMService/InitCfgService），保持`StripPrefix=0`，避免破坏现网路径。
- 对于后端不带`/api`上下文但Controller基于业务前缀的服务，网关按既有可用策略进行兼容转发，优先保证现网不受影响。

#### 2.4.2 CORS与预检处理

- 网关启用`spring.cloud.gateway.globalcors`统一处理跨域，生产域名白名单包括：
  - `https://trademind.com.cn`
  - `https://www.trademind.com.cn`
- 开启`add-to-simple-url-handler-mapping: true`，确保OPTIONS预检请求能够被统一处理。
- 为避免Nginx与Gateway重复注入CORS头导致浏览器拦截，网关启用`DedupeResponseHeader`去重策略。

#### 2.4.3 鉴权白名单与可观测性

- 网关鉴权白名单从硬编码改为配置化（`custom.security.auth-whitelist`），默认覆盖登录、注册、初始化配置等免鉴权路径。
- 白名单匹配支持路径前缀变化（兼容带`/api`与不带`/api`的路径形态），降低路由调整带来的误拦截风险。
- 过滤器在返回403时保留`debug`级日志（包含路径与原因），用于线上快速定位拦截原因。
- **商业化补充（2026-05-07）**：白名单默认额外包含 **`/v1/tenant/referral/validate`**、**`/v1/tenant/subscription/plans`**（公开校验推荐码与拉方案）、**`/v1/tenant/internal`**（内部开通付费接口 **不走用户 JWT**，由 **`X-Internal-Token`** 与 **`TenantService`** 的 **`custom.security.internal-token`** 对齐校验）。

#### 2.4.4 订阅访问策略（JWT `accessMode`，2026-05-07 实现）

- **`FULL`**：网关放行（在已通过 JWT 校验前提下），下游业务照常。
- **`READ_ONLY`**：对 **POST/PUT/PATCH/DELETE** 返回 **403**，除非请求路径命中 **`custom.security.subscription-bypass-path-fragments`**（默认含 **`/v1/init`**、**`/v1/tenant/subscription`**、**`/v1/tenant/referral`**、**`/v1/tenant/user/payout`**、登录注册发短信等片段）；**GET/HEAD** 一般放行。
- **`BILLING_ONLY`**：仅允许路径命中上述 **bypass** 片段（过期后仅能访问会员/配置/内部激活等）；其余路径拒绝。
- **配置**：网关 **`application.yml`** → **`custom.security.subscription-bypass-path-fragments`**，可用环境变量 **`SUBSCRIPTION_BYPASS_FRAGMENTS`** 覆盖。
- **实现类**：**`AuthGlobalFilter`** 在注入下游头之前调用 **`AuthService.isTenantSubscriptionAccessAllowed`**。

#### 2.4.5 运维 API 访问控制（2026-05-20）

- 路径含 **`/api/v1/ops/`** 的请求在 JWT 校验通过后，额外要求 **`tenantId=SYSTEM_OPS`** 且 **`roleType=ROLE_OPS_ADMIN`**（**`AuthService.isOpsAdmin`**）；否则 **403**。
- **`ROLE_PROMOTER`** 访问 **`/api/v1/ops/**`** 一律 **403**（§2.4.7），与运维角色校验独立。
- 运维接口 **不在** 网关 auth-whitelist 中，必须携带有效 Bearer JWT（通常由 **`ops_admin`** 登录 TenantService 获得）。
- 网关校验通过后 **保留** `Authorization: Bearer` 头转发下游（TenantService 等需二次解析 Claims）；同时注入 **`X-User-Id`、`X-Tenant-Id`、`X-User-Role`、`X-Merchant-Type`**。

#### 2.4.7 推广员 API 访问控制（2026-06-01）

- **`ROLE_PROMOTER`** 采用 **deny-by-default 白名单**（**`AuthService.isPromoterAllowedPath`**）：
  - **允许**：**`/api/v1/promoter/**`**（含 stats/records/payout/wechat）；**`POST /api/v1/tenant/login`**（账号密码登录）。
  - **公开（auth-whitelist）**：**`/v1/promoter/wechat/config`**、**`/v1/promoter/wechat/login`**、**`/v1/promoter/wechat/bind`**、**`/v1/promoter/wechat/oauth-url`**。
  - **拒绝**：**`/api/v1/ops/**`** 及全部商户业务 API（IM/CRM/RD 等）。
- 网关路由：**`/api/v1/promoter/**`** → **`RewritePath`** → TenantService **`/api/v1/tenant/promoter/**`**（**`PromoterController`**）。
- 下游 **`PromoterController`** 强制 **`referrer_user_id = JWT userId`**，不接受外部 referrer 参数。

#### 2.4.6 模块间路径拉齐策略（兼容优先）

- RDService对历史路径与统一路径双支持：
  - `"/productions"`与`"/api/v1/rd/productions"`
  - `"/dictionaries"`与`"/api/v1/rd/dictionaries"`
- SuppService根入口双支持：
  - `"/supp"`与`"/api/v1/supp"`
- 原则：先兼容再收敛，任何路径统一动作不得影响当前前端与网关联调链路。

### 2.5 模块路由对照清单（网关/服务/控制器）

- `TenantService`
  - 网关Path：`/api/v1/tenant/**`
  - 网关StripPrefix：`0`
  - 服务context-path：`/api/v1/tenant`
  - 典型Controller前缀：`/`
  - 拉齐结论：已对齐，保持现状（不改动）。

- `InitCfgService`
  - 网关Path：`/api/v1/init/**`
  - 网关StripPrefix：`0`
  - 服务context-path：`/api/v1/init`
  - 典型Controller前缀：`/config`、`/api/oss`
  - 拉齐结论：网关与服务上下文一致，继续通过网关统一暴露。

- `CRMService`
  - 网关Path：`/api/v1/crm/**`
  - 网关StripPrefix：`0`
  - 服务context-path：`/api/v1/crm`
  - 典型Controller前缀：`/`、`/customers`
  - 拉齐结论：已对齐，保持现状（不改动）。

- `RDService`
  - 网关Path：`/api/v1/rd/**`
  - 网关StripPrefix：`0`
  - 服务context-path：`/`
  - 典型Controller前缀：`/api/v1/rd/products`、`/api/v1/rd/orders`、`/api/v1/rd/customers`、`/productions`、`/dictionaries`
  - 拉齐结论：已补充兼容双路径（`productions`与`dictionaries`支持`/api/v1/rd/...`），不影响存量调用。

- `SuppService`
  - 网关Path：`/api/v1/supp/**`
  - 网关StripPrefix：`0`
  - 服务context-path：`/`
  - 典型Controller前缀：`/supp/*`与`/api/v1/supp/*`双支持
  - 拉齐结论：已按兼容策略拉齐（旧路径保留 + 新路径统一）。

- `AIService`
  - 网关Path：`/api/v1/ai/**`
  - 网关StripPrefix：`2`
  - 服务context-path：`/`
  - 典型Controller前缀：`/ai`
  - 拉齐结论：通过`StripPrefix=2`将`/api/v1/ai/*`映射为服务内`/ai/*`，已对齐且稳定。

- `IMService`
  - 网关Path：`/api/v1/im/**`
  - 网关StripPrefix：`0`
  - 服务context-path：`/`（默认）
  - 典型Controller前缀：`/api/v1/im/report`、`/api/v1/im/accounts`
  - 拉齐结论：已对齐，保持现状（不改动）。

- `OpsService`
  - 网关Path：`/api/v1/ops/**`
  - 网关StripPrefix：`0`
  - 服务context-path：`/`（默认）
  - 典型Controller前缀：`/api/v1/ops`、`/api/v1/ops/dashboard`、`/api/v1/ops/tenants`、`/api/v1/ops/referrals`、`/api/v1/ops/announcements`、`/api/v1/ops/ai-usage`
  - 拉齐结论：已对齐；访问受 §2.4.5 运维 RBAC 约束。

### 2.6 全模块路由对照表（收敛视图）

| 模块 | 网关 Path | StripPrefix | 服务 context-path | Controller 前缀（代表） | 当前判定 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| TenantService | `/api/v1/tenant/**` | `0` | `/api/v1/tenant` | `/` | 不建议动 | 网关与服务上下文完全一致，改动易影响登录/注册主链路。 |
| InitCfgService | `/api/v1/init/**` | `0` | `/api/v1/init` | `/config`、`/api/oss` | 不建议动 | 已稳定服务于多模块配置拉取，保持网关零剥离最稳妥。 |
| CRMService | `/api/v1/crm/**` | `0` | `/api/v1/crm` | `/customers` | 不建议动 | 前后端已按当前前缀协同，收益小于改造风险。 |
| RDService | `/api/v1/rd/**` | `0` | `/` | `/api/v1/rd/products`、`/api/v1/rd/orders`、`/api/v1/rd/customers`、`/productions`、`/dictionaries` | 兼容中 | 现有混合前缀；`productions`与`dictionaries`已补充双路径，逐步向统一前缀收敛。 |
| SuppService | `/api/v1/supp/**` | `0` | `/`（默认） | `/supp/*` 与 `/api/v1/supp/*` 双支持 | 兼容中 | 已采用兼容双路径策略，存量调用与统一入口并行可用。 |
| AIService | `/api/v1/ai/**` | `2` | `/` | `/ai/*` | 可迁移 | 当前依赖网关剥离映射；后续可迁移为服务直接提供`/api/v1/ai/*`后改为`StripPrefix=0`。 |
| IMService | `/api/v1/im/**` | `0` | `/`（默认） | `/api/v1/im/report`、`/api/v1/im/accounts` | 不建议动 | 控制器已统一完整前缀，网关透传简单稳定。 |
| OpsService | `/api/v1/ops/**` | `0` | `/`（默认） | `/api/v1/ops/*` | 不建议动 | 运维专用；网关 **`isOpsAdmin`** 校验，StripPrefix=0 透传。 |
| Promoter API | `/api/v1/promoter/**` | Rewrite→Tenant | `/api/v1/tenant` | `/promoter/*` | 不建议动 | 网关 **`RewritePath`** 至 TenantService；推广员 RBAC 见 §2.4.7。 |

#### 2.6.1 分批平滑收敛建议

1. **第一批（仅文档与监控，零行为变更）**
   - 固化路由基线：以本表作为联调验收清单。
   - 观测项统一：网关记录4xx/5xx、OPTIONS命中率、鉴权拦截路径。

2. **第二批（兼容中模块继续补齐）**
   - `RDService`：将剩余非`/api/v1/rd/*`控制器补成双路径（先加不删）。✅ 已完成（`productions`、`dictionaries`已双路径兼容）
   - `SuppService`：保持双路径一段时间，观察调用日志后再决定下线旧路径。

3. **第三批（可迁移模块收敛）**
   - `AIService`：服务端补`/api/v1/ai/*`兼容入口，灰度后将网关`StripPrefix`由`2`切到`0`。
   - 完成灰度验证后，再评估是否下线旧`/ai/*`裸前缀入口。

4. **冻结规则（防止回归）**
   - 新增接口默认按`/api/v1/{service}`命名。
   - 网关新增路由必须在文档同步登记`Path/StripPrefix/context-path/状态`四元组。

#### 2.6.2 网关访问日志核验清单（SuppService旧路径下线前）

1. **核验目标**
   - 判断旧路径`/supp/*`是否仍有真实流量。
   - 评估是否可将SuppService从“双路径兼容”收敛为“仅`/api/v1/supp/*`”。

2. **观测窗口建议**
   - 至少连续观察`7天`（覆盖工作日与周末）。
   - 如存在批处理/定时任务调用，建议扩展到`14天`。

3. **必看日志字段**
   - 请求路径（`path`）
   - 请求方法（`method`）
   - 状态码（`status`）
   - 来源标识（`origin`/`referer`/客户端IP）
   - 租户标识（若日志已脱敏记录`tenantId`）

4. **重点筛查路径**
   - 旧路径：`/supp/suppliers*`、`/supp/purchases*`、`/supp/dictionaries*`、`/supp/purchase_orders*`
   - 新路径：`/api/v1/supp/suppliers*`、`/api/v1/supp/purchases*`、`/api/v1/supp/dictionaries*`、`/api/v1/supp/purchase_orders*`

5. **判定标准（建议）**
   - 连续`7天`旧路径请求量为`0`：可进入下线准备。
   - 连续`7天`旧路径请求量低于总Supp流量`1%`：可灰度拦截并观察。
   - 任意时段旧路径出现核心写操作（POST/PUT/PATCH/DELETE）：暂不下线，先定位调用方并迁移。

6. **灰度下线步骤（推荐）**
   - 第1阶段：旧路径打`warn`日志并加响应头告警（如`X-API-Deprecated: /supp/*`）。
   - 第2阶段：对旧路径按租户/来源灰度返回`410 Gone`（白名单保留）。
   - 第3阶段：全量下线旧路径映射，保留回滚开关`48小时`。

7. **回滚条件**
   - 出现关键业务失败（供应商保存、进货单创建/状态更新）且链路指向旧路径调用。
   - 下线后旧路径404/410在5分钟内突增并伴随业务告警。

#### 2.6.3 SuppService路径下线执行单（可直接执行）

| 阶段 | 时间建议 | 责任角色 | 执行动作 | 验收标准 | 失败回滚 |
| --- | --- | --- | --- | --- | --- |
| 准备阶段 | D-3 ~ D-1 | 后端 + 运维 | 冻结路由变更；确认双路径都可用；发布下线通知 | 路由基线确认完成；通知到达相关调用方 | 取消窗口，顺延发布 |
| 观测阶段 | D-7 ~ D-1 | 运维 + 后端 | 统计旧路径`/supp/*`访问量与写操作来源 | 连续7天旧路径流量=0或<1%且无关键写操作 | 继续观测，不进入下线 |
| 灰度阶段1 | D日 | 后端 | 旧路径返回告警头`X-API-Deprecated`并打warn日志 | 调用方可见告警，业务无新增报错 | 关闭告警策略 |
| 灰度阶段2 | D+1 ~ D+2 | 后端 + 运维 | 按租户/来源灰度对旧路径返回`410 Gone` | 灰度范围内无核心业务阻断，告警可控 | 立即放开灰度并恢复双路径 |
| 全量下线 | D+3 | 后端 | 移除旧路径映射，仅保留`/api/v1/supp/*` | 24小时核心接口成功率达标且无P1/P2故障 | 恢复旧路径映射并复盘 |
| 观察收尾 | D+4 ~ D+5 | 运维 + 产品 | 持续监控并关闭迁移事项 | 连续48小时无回归告警 | 延长观察窗口 |

**发布当日检查项（Checklist）**

- 发布前：
  - 网关与SuppService实例健康检查通过。
  - 前端主流程冒烟通过（供应商列表、新增、编辑、删除；进货单创建、状态更新）。
  - 旧路径调用方名单与联系人确认完毕。

- 发布后30分钟：
  - 核对`4xx/5xx`趋势无异常抬升。
  - 核对Supp核心写接口成功率（POST/PUT/PATCH/DELETE）。
  - 抽样验证3个租户关键流程。

- 发布后24小时：
  - 核对旧路径访问是否清零。
  - 核对工单/客服侧无新增“供应链不可用”反馈。
  - 形成下线结果记录（时间、版本、影响面、是否回滚）。

### 2.7 商户类型身份链路与网关透传（2026-05-06）

#### 2.7.1 数据与字典

- `tenants.merchant_type`：非空，默认 `WHOLESALE`；合法值仅限字典 **D013** 子项 `dict_code`。列定义见 **`db/schema-production.sql`**；重启 **InitCfgService** 可幂等补齐。

#### 2.7.2 注册与登录（TenantService）

- **注册** `POST /register`：请求体可传 **`merchantType`**（兼容 **`industryType`**），缺省 **`WHOLESALE`**；可选 **`referralCode`**（推荐码，绑定 **`referral_records`**）。事务内顺序：**持久化租户** → **校验并绑定推荐** → **创建管理员用户** → **`SubscriptionLifecycleService.startTrial`**（按 **`subscription_plans`** 中该业态 **`TRIAL`** 行的 **`trial_days`** 写 **`tenant_subscriptions`**，并同步 **`tenants.subscription_type`**、**`sub_*`**、**`current_plan_id`**）→ **`ReferralCodeAllocator`** 为用户生成 **`JYxxxxxx`**。非法 **`merchantType`** 或无效推荐码返回 **400**。
- **登录** `POST /login`：**`ReferralCodeAllocator.assignIfAbsent`** 兼容存量用户补码；**`AccessModeEvaluator.evaluateAndPersist`** 写回 **`access_mode`**；签发 JWT（见 §2.7.3）。响应体除 **`token`**、**`user`**、**`merchantType`** 外，含 **`accessMode`**、**`referralCode`**、**`onboarding`**（首登/必学摘要，详情见 **`GET /onboarding/state`**）。

#### 2.7.3 JWT 与网关

- JWT（HS256）Claims（业务相关）：`userId`、`userName`、`tenantId`、`roleType`、**`merchantType`**（必填）、**`accessMode`**（`FULL`/`READ_ONLY`/`BILLING_ONLY`）、**`subscriptionTier`**（对齐 **`tenants.subscription_type`** / D001 `dict_code`）、**`subEndMs`**（**`sub_end_time`** 的本地时区毫秒时间戳）。**mock-token**（仅 **`allow-mock-token=true`**）解析为 **`WHOLESALE` + `FULL`**。
- 网关 **`AuthGlobalFilter`**：校验 JWT 通过后，依据 **`accessMode`** 调用 **`AuthService.isTenantSubscriptionAccessAllowed`**（§2.4.4）；运维路径额外校验 **`isOpsAdmin`**（§2.4.5）；**保留** `Authorization: Bearer` 转发下游，并注入 **`X-User-Id`、`X-Tenant-Id`、`X-User-Role`、`X-Merchant-Type`**。
- **付费开通**：**`POST .../internal/subscription/activate-paid`** + Header **`X-Internal-Token`**；Body **`tenantId`、`tierCode`、`months`、`pricePaid`、`externalOrderId`**；**`SubscriptionLifecycleService.applyPaidPlan`** 叠加 **`sub_end_time`**，若 **`pricePaid > 0`** 则 **`ReferralQualificationService`** 将对应 **`referral_records`** 置 **`QUALIFIED`** 并写入 **`referral_rewards`**（金额 **`custom.referral.reward-per-qualified`**）。
- **AIService** `HeaderInterceptor`：`X-Merchant-Type` 缺失则 **401**（须经网关访问）。
- **CRMService / RDService / SuppService / IMService**：拦截器或上下文对象同步写入 `merchantType`（若请求头存在）；**配额 enforcement** 可与 **`subscription_plans.quota_limits`** 对齐扩展。

#### 2.7.4 前端（TradeMind-Web）要点

- **注册意图**：`auth.js` 中 `tmResolveMerchantIntent()`，支持 URL 参数 `merchantType`、`industryType`、`industry`、`version`（合法值归一为 D013 `dict_code`），并写入 `sessionStorage`。
- **运行时上下文**：`/assets/js/tm-ui-loader.js` — `TM_UI_CONTEXT.industry`、`TM_UI.applyContextFromToken(token)`、`TM_UI.injectSlots(root)`、`TM_RoleGate.apply(root)`（`data-role`）；壳层就绪后派发 **`tm-role-ui-ready`**（供新手导览启动）。
- **行业片段**：`/fragments/{wholesale|foreign|ecom|factory}/{scope}/{slot}.html`；模块 HTML 内预留 `data-tm-fragment-scope` + `data-tm-slot`。
- **主壳**：单页 **`index-app.html`** + **`ui-main.js`** 按 Tab 注入模块；**PC** 左侧 `aside` 导航，**移动** 底栏 **`#tm-app-tabbar`**（`TM_Responsive` / `body.tm-layout-mobile`，断点 **&lt;768px**）。
- **顶栏**：`#tm-app-header` — 移动端 **`tm-app-header-brand`** 固定展示「商贸智脑」；PC 顶栏不重复退出/新手引导（退出在侧栏、导览见 FAB，§3.1.0、§3.1.6）。
- **样式**：根节点 `data-merchant-type` 与 `theme.css` 中 `--tm-brand-accent-rgb`；手机壳层见 **`tm-layout-engine.css`**（§3.1.0）；详见 `TradeMind-Web/docs/Framework_Guide.md`。

### 2.8 商业化：推荐奖励账户与配额配置（设计修订 2026-05-07）

#### 2.8.1 推荐奖励与租户经营账户分离

- **租户侧 `biz_accounts`**：继续服务进销存/经营场景下的收付款账户（与订单、进货单等绑定），不承载「推荐拉新奖励」打款信息。
- **用户侧字段**：推荐码与提现信息落在 **`users` 表**（§1.1.2、§2.8.5），与登录用户一一对应。
- **多用户同租户**：同一 `tenant_id` 下，**每个用户**可有独立 **`referral_code`**；被推荐方注册时填某用户的码，则推荐关系、**有效推荐** 触发后的 **奖励归属** 均记入 **该推荐人用户**，不因同属一个租户而合并。租户管理员与普通业务员均可参与推广（具体是否限制角色由后续 RBAC 策略决定）。

#### 2.8.2 订阅等级展示名（D001）

- 字典 **D001** 子项中文展示与 **`db/seed-data.sql`** 对齐：**试用版 / 启航会员 / 优享会员 / 尊享会员**（`dict_code` 仍为 `TRIAL`、`BASIC`、`PREMIUM`、`ENTERPRISE`）。详见 §1.5.2.2。

#### 2.8.3 配额指标「可配置」位置 recap

- **按业态 × 等级** 的数值上限：**`subscription_plans.quota_limits`（JSONB）**，键名约定见 §1.5.3。
- **初始化**：表结构、索引与存量列补齐均由 **`InitCfgService`** 启动时幂等执行 **`db/schema-production.sql`**（33 张表，含 **`user_onboarding_state`**、**`production`**、**`tenant_ops_profile`**、**`merchant_feedback`** 等）；核心元数据（运维租户、字典 D001–D017、16 行订阅方案）由 **`db/seed-data.sql`** 注入；**`validateCoreSchema()`** 校验与 spec 对齐。上线前清库重置见 **`docs/Database_Deployment_Guide.md`**。
- **演进**：不同商户类型在同一等级下的指标差异，仅需 **增删改方案行或 JSON 字段**，不依赖发版；必要时配合 **`quota_metric_definitions`** 约束可用键集合。

#### 2.8.4 实现对照（代码与配置，2026-05-07）

| 能力 | 说明 |
| --- | --- |
| 实体与表 | **`Tenant`/`User`** 扩展字段；**`SubscriptionPlan`、`TenantSubscription`、`ReferralRecord`、`ReferralReward`**（**`TenantService`** JPA） |
| 种子方案 | **`InitCfgService`** **`db/seed-data.sql`**（表为空时 16 行）；**`SubscriptionPlanSeedService`** 已废弃 |
| 字典种子 | **`InitCfgService`** **`db/seed-data.sql`**（D001–D017）；**`DictionaryInitService`** 已废弃 |
| 注册试用 | **`SubscriptionLifecycleService.startTrial`** |
| 内部付费 | **`InternalSubscriptionController`** + **`SubscriptionLifecycleService.applyPaidPlan`** |
| 推荐码 | **`ReferralCodeAllocator`**（**`JY` + 6 位**，冲突重试） |
| 绑定与校验 | **`ReferralBindingService`**；公开接口 **`POST /referral/validate`** |
| 达标发奖 | **`ReferralQualificationService`**（首笔 **`pricePaid > 0`**） |
| 会员门户 API | **`SubscriptionPortalController`**：`/subscription/*`（含 **`renew`/`upgrade`**）、`/referral/*`、`/user/payout-profile` |
| 子账号管理 | **`TenantUserController`** + **`TenantUserManagementService`**（席位 **`quota_limits.max_users`**） |
| 新手导览 | **`OnboardingController`**（`/onboarding/state` GET/PUT）、**`OnboardingStateService`**、**`OnboardingRoleCodes`**；登录 **`peekLoginSummary`** |
| 订阅支付 | **`SubscriptionPaymentController`** + **`HccbPaymentNotifyController`**（杭州银行收银台） |
| 运维中台 | **`OpsService`**（租户树、延期、推荐运维、**推广员开号**、AI 用量、公告）；网关 **`isOpsAdmin`** |
| 推广员门户 | **`PromoterController`**、**`PromoterService`**、**`PromoterWechatAuthService`**、**`UserPayoutProfileService`** |
| TenantService 配置项 | **`custom.subscription.grace-days-after-expiry`**（默认 `7`）；**`custom.referral.reward-per-qualified`**（默认 `100`）；**`custom.wechat.mp.*`** |
| 网关 | **`AuthGlobalFilter`** + **`AuthService`**；白名单 / bypass / 运维 RBAC（§2.4.5）/ 推广员 RBAC（§2.4.7） |
| 待办 | 各业务服务 **COUNT/Redis 配额切面**、**`payout_account_no` 加密**、支付渠道正式回调与前端 **`referralCode` 表单项** |

#### 2.8.5 用户侧扩展字段（§1.1.2）

- **已实现列**：**`referral_code`**、**`payout_pay_type`**、**`payout_account_name`**、**`payout_account_no`**、**`payout_bank_name`**、**`payout_verified`**、**`wechat_mp_openid`**（与 **`biz_accounts`** 分离）。

#### 2.8.6 独立推广员系统（2026-06-01）

| 项 | 说明 |
| --- | --- |
| 角色 | **`ROLE_PROMOTER`**，租户固定 **`SYSTEM_OPS`**，与 **`ROLE_OPS_ADMIN`**、商户 **`ADMIN`** 等分离 |
| 开号 | 运维 **`POST /api/v1/ops/promoters`** → OpsService 调 TenantService **`POST /internal/promoters`**（**`X-Internal-Token`**）→ **`PromoterProvisionService`** + **`ReferralCodeAllocator`** |
| 门户 API | **`PromoterController`**（网关 **`/api/v1/promoter/**`**）：**`GET /stats`**、**`GET /records`**、**`GET/POST /payout-profile`**、微信 OAuth 子路径 |
| 数据隔离 | 所有查询 **`WHERE referrer_user_id = JWT userId`**；禁止 Query/Body 传入 referrer |
| 奖励金额 | 推荐人 **`role_type=ROLE_PROMOTER`** 时 **`ReferralQualificationService`** 硬编码 **`150.00`**；商户推荐仍读 **`custom.referral.reward-per-qualified`**（默认 100） |
| 结算 | 仍由运维 **`/api/v1/ops/referrals/rewards/{id}/mark-paid`** 标记 **`PAID`** |
| 前端 | **`promoter-portal.html`**（移动优先 H5，微信公众号菜单挂载） |
| 配置 | **`custom.wechat.mp.app-id/app-secret/oauth-redirect-uri`**（TenantService）；OpsService **`custom.tenant-service.url`** + **`custom.security.internal-token`** |

#### 2.8.7 推广员流水展示状态

| 门户 status | 中文 | 判定 |
| --- | --- | --- |
| `REGISTERED` | 已注册 | **`referral_records.status=PENDING`** |
| `SUBSCRIBED_PENDING` | 已订阅(待结算) | **`QUALIFIED`** 且奖励 **`ACCRUED`/`PAYABLE`** |
| `SETTLED` | 已结算 | 奖励 **`PAID`** |

被推荐人手机号：取 **`referee_tenant_id`** 对应最早 **`ADMIN`** 用户 **`phone`**，中间 4 位掩码（如 **`138****5678`**）。

### 2.9 单据状态机与精准库存同步（2026-05-25）

#### 2.9.1 设计原则

- **物流与财务解耦**：**D010/D011/D012** 驱动出入库与明细处理；**D015/D016** 描述收付款进度；二者可异步组合（如「已发货未收款」「已入库未付款」）。
- **幂等库存**：仅对 **`is_processed=false`** 的明细行执行 **`ship`** / **`inbound`**；处理完成后写 **`is_processed=true`**、**`processed_at`**、**`processed_qty`**，避免重复扣减/加库存。
- **子仓为准**：库存变更统一经 **`InventoryService.adjust`**（RDService）写 **`warehouse_stock`**，并 **`syncProductTotalStock`** 汇总至 **`products.stock`**。
- **默认仓库**：单仓小商户可不选手工仓库；服务侧 **`resolveDefaultWarehouseId`** 取租户首个仓库（仍须至少存在一个仓库记录）。

#### 2.9.2 销售订单（RDService）

| 物流码（存储） | dict_code | 含义 | 库存 |
| --- | --- | --- | --- |
| D010001 | ALLOCATING | 待配货 | 无 |
| D010002 | PICKING | 拣货中 | 无 |
| D010003 | SHIPPED | 已发货 | **`ship`** 扣减发出仓 |
| D010004 | RECEIVED | 已签收 | 无（出库已在发货完成） |
| D010005 | RETURNED | 退货 | 逆向入库（后续迭代） |

- **进行中定义**（**`OrderStatusCodes.isInProgress`**）：**D010001 + D010002 + D010003**（待配货 / 拣货中 / 已发货）；**D010004/D010005** 为终态，从工作台进行中列表移除。
- **发货**：**`POST /api/v1/rd/orders/{id}/ship`** — Body 可选 **`warehouseId`**、**`itemIds`**（部分发货）；未传仓库则用订单 **`warehouse_id`** 或租户默认仓。
- **收款**：**`POST /api/v1/rd/orders/{id}/record-payment`** — Body **`accountId`**、**`amount`**、可选 **`txnTime`**、**`bizTypeCode`**；**`fin_status`** 由 **`FinStatusCodes.computeFromAmounts(received_amount, total_amount)`** 计算。

#### 2.9.3 进货单（SuppService）

| 物流码 | dict_code | 含义 | 库存 |
| --- | --- | --- | --- |
| D012001 | DRAFT | 草稿 | 无 |
| D012002 | PENDING_REVIEW | 待审核 | 无 |
| D012003 | APPROVED | 审核通过 | 无 |
| D012004 | PARTIAL_INBOUND | 部分入库 | **`inbound`** 增量 |
| D012005 | FULL_INBOUND | 全部入库 | **`inbound`** 全量 |
| D012006 | VOIDED | 作废 | 已入库则 **`reverseInbound`** |

- **入库**：**`POST /api/v1/supp/purchases/{id}/inbound`** — Body 可选 **`targetStatus`**（`PARTIAL_INBOUND`/`FULL_INBOUND`）、**`warehouseId`**、**`itemIds`**（部分入库必填）；**`warehouse_id` 可空**（前端允许不选，后端落默认仓）。
- **付款**：**`POST /api/v1/supp/purchases/{id}/record-payment`** — 与订单对称，更新 **`paid_amount`** 与 **`fin_status`**（D016）。

#### 2.9.4 存量迁移（内置于 `db/schema-production.sql`）

- 历史增量脚本（**`migrations/legacy/*`**）已废弃并删除；存量升级依赖 **`db/schema-production.sql`** 内 **`ALTER TABLE … ADD COLUMN IF NOT EXISTS`** 与下列 **`UPDATE`**（仅影响匹配旧码的行）：
- 进货中文状态 **「已入库」→ `FULL_INBOUND`**；已入库明细标记 **`is_processed=true`**。
- 订单 **`COMPLETED`/`D010003` → `D010004`（已签收）**；**`PENDING`/`PROCESSING` → D010001/D010002**。
- 已签收且绑定了账户的历史订单：**`fin_status` 置 `SETTLED`**（仅当原值为 `UNPAID`）。

---

## 3. 模块功能列表

### 3.1 前端模块

#### 3.1.0 商户类型与壳层扩展（跨模块）

- **意图入口**：`register.html?merchantType=ECOM` 等；登录页 / 注册页加载 `main-app.js` → `tm-ui-loader.js` → `auth.js`。
- **主壳**：`index-app.html` 在 `ui-components.js` 之后加载 `tm-ui-loader.js`，模块内容由 `ui-main.js` 注入后在 **`view-dashboard` / `view-supply`** 根节点上调用 `injectSlots`。
- **约定**：不在 `modules/` 下按行业拆分物理目录；行业差异 HTML 放在 **`/fragments/`**。

**主壳布局（`index-app.html`，对齐 UI 工程）**：

| 区域 | PC（≥768px） | 移动（&lt;768px） |
| --- | --- | --- |
| 导航 | 左侧 `aside`（含用户区 + **退出**） | 底部 **`#tm-app-tabbar`**（`mobile-nav-btn`） |
| 顶栏 `#tm-app-header` | 搜索框、`#page-title` 胶囊、通知 | **`tm-app-header-brand`**（图标 + **商贸智脑**）、通知、会员、**退出** |
| 顶栏去重（2026-05-24） | **无**顶栏「新手引导」、**无**顶栏退出（避免与侧栏/FAB 重复） | 保留顶栏退出（无侧栏）；导览入口为悬浮 **功能导览 FAB**（§3.1.6） |
| 内容 | `#content-area` / `.tm-app-content-area` | **唯一滚动区**（`100dvh - header - tabbar`，`overflow-y-auto`）；底栏留白由 **`tm-layout-engine.css`** / **`tm-shell-insets.js`** 计算 |
| 嵌入模块 | `biz`/`crm`/`supplier` 以 **iframe** 加载；子页 `html.tm-embedded` 隐藏自身 header（`ui-main.js` **`TM_mountEmbeddedFrame`**） | 顶栏仅主壳一层，避免双层「商贸智脑」 |
| 弹窗 | 业务 Modal 经 **`TM_applyDialogShell(modal, { variant: 'sheet'|'center' })`** | 移动默认 **Bottom Sheet**（圆角 **`rounded-[2.5rem]`**）；PC 居中对话框 |

**样式与脚本（2026-05-25 布局引擎）**：

- **权威壳层**：**`/assets/css/tm-layout-engine.css`**（由 **`common.css`** `@import`；**`auth.js`** 对独立页动态注入）；取代 **`MobileAdapt/mobile.css`** / **`ui-mobile.css`** 中重复的 fixed/h-screen 规则（后者标记 **`@deprecated`**，仅保留兼容引用）。
- **壳层度量**：**`/assets/js/tm-shell-insets.js`** — **`TM_ShellInsets.sync()`** 写入 **`--tm-header-h`** / **`--tm-tabbar-h`** / **`--tm-content-pad-b`**；弹窗 **`applyModalRoot`**、嵌入页 **`initEmbeddedDocument`**。
- **弹窗适配**：**`ui-main.js`** 导出 **`TM_applyDialogShell`**；模块切换时 **`TM_ShellInsets.sync()`** 重置滚动位置。
- **响应式**：**`/MobileAdapt/TM_Responsive.js`** — **`body.tm-layout-mobile`**（断点 **&lt;768px**）；与 Tailwind `md` 对齐时自定义 CSS 使用 **`max-width: 767px`**。
- **备案信息**：各业务模块 **禁止** 重复内联 ICP；统一由主壳或 **`tm-layout-engine`** 规则控制（避免双层 footer）。

#### 3.1.1 工作台（Dashboard）

- **路径**：`/modules/dashboard/dashboard.html`
- **功能**：
  - 系统概览展示
  - **左栏·待确认单据**：`GET /api/v1/ai/records`，展示 AI 识别完成（`SUCCESS`）且用户未确认入库的草稿；点击打开核对弹窗
  - **右栏·进行中业务单据**：
    - 数据：**`GET /api/v1/rd/orders/in-progress`**（物流态 **D010001 待配货 + D010002 拣货中 + D010003 已发货**；接口不可用时回退全量订单客户端筛选）
    - **双维筛选**：单个「筛选」按钮弹出面板，可按 **D010 物流状态** + **D015 财务状态** 组合过滤（客户端 **`filterInProgressOrders`**）
    - **列表摘要**：展示 **`dict_name`** 物流态、**D015** 财务态、**「剩 ¥xxx」** 剩余应收（`total_amount - received_amount`）
    - **详情/编辑**：客户名称、**D010 物流状态**（下拉展示 **`dictname`**，非 `D010001` 码）、交货日期、**收款账户**（下拉 **`biz_accounts.account_name`**）、**收款状态与本次收款金额**；底部与「返回工作台」平级的 **「保存」** 按钮；保存调用 **`PUT /api/v1/rd/orders/{id}/save`** 或 **`POST .../record-payment`**（有收款金额时）
    - **终态移除**：保存为 **D010004 已签收** 或 **D010005 退货** 后从进行中列表移除
    - **添加订单**弹窗：字段与详情对齐；状态下拉加载 **D010 全部子项**；底栏按钮样式与详情一致
  - 核对确认后：`POST /api/v1/rd/orders` 默认 **D010001（待配货）**，删除对应 AI 记录，右栏刷新
  - 核对弹窗支持多个 `new_products_found` 时分项 Tab 保存新产品
  - 待办事项提醒、快捷操作入口、数据统计卡片
  - **商户片段插槽**：`data-tm-fragment-scope="dashboard"`、`data-tm-slot="workspace-banner"`（按租户业态加载横幅片段）

#### 3.1.2 客户关系（CRM）

- **路径**：`/modules/crm/crm.html`
- **功能**：
  - 客户联系信息增删改查（姓名、手机、邮箱、地区、地址、摘要）
  - **系统双标签**（§1.2.2）：列表/详情只读展示 **Badge 1 价值** + **Badge 2 特色**，最多 2 个；**不在**新增/编辑弹窗中出现
  - 客户搜索和 A–Z 索引
  - 交互时间轴、AI 营销建议（读取订单与标签上下文）

#### 3.1.3 产品中心（Product Center）

- **路径**：`/modules/product-center/product-center.html`；弹窗片段 **`product-overlays.html`**
- **前端脚本**：`/assets/js/ui-product-center.js`、**`/assets/js/ui-product-center-enhance.js`**
- **功能**：
  - 产品信息增删改查（真实API对接）
  - 产品分类管理（真实API对接）；**新增/编辑时类别非必填**（与 DB **`category_id` 可空** 一致）
  - 仓库管理（真实API对接）
  - 库存管理
  - **单位换算**：弹窗默认展示已有配置；无配置时展示 **1 行**待填行；**「+」最多增至 2 行**；支持删除行（至少保留 1 行）；保存经 **`POST /api/v1/rd/products/save`**
  - **高级配置**：折叠区 **`#product-advanced-drawer`**；使用 **`ProductModule.toggleAdvanced`**（全局 **`toggleProductAdvanced`**），避免被 dashboard 内联脚本覆盖导致无法展开
  - 库存预警提醒
  - 产品列表筛选和搜索
  - 桌面端表格和移动端卡片双布局
  - 仓库调拨功能
  - 产品/供应商弹窗经 **`TM_applyDialogShell(..., { variant: 'sheet' })`** 适配移动 Bottom Sheet
- **技术实现**：
  - 使用`window.wrappedFetch()`进行API请求
  - 使用`window.handleApiResponse()`统一响应处理
  - 自动JWT认证和租户隔离
  - 完整错误处理和用户反馈
- **后端接口**：
  - `GET /api/v1/rd/products` - 获取产品列表
  - `GET /api/v1/rd/products/{id}` - 获取产品详情
  - `POST /api/v1/rd/products` - 创建产品
  - `PUT /api/v1/rd/products/{id}` - 更新产品
  - `DELETE /api/v1/rd/products/{id}` - 删除产品
  - `POST /api/v1/rd/products/save` - 保存产品（含单位换算）
  - `GET /api/v1/rd/products/categories` - 获取分类列表
  - `POST /api/v1/rd/products/categories/save` - 保存分类
  - `GET /api/v1/rd/products/warehouses` - 获取仓库列表
  - `POST /api/v1/rd/products/warehouses/save` - 保存仓库
  - `DELETE /api/v1/rd/products/warehouses/{id}` - 删除仓库
  - `POST /api/v1/rd/products/transfer` - 仓库调拨产品
  - `GET /api/v1/rd/products/restock/suggestions` - 获取进货建议列表
  - `GET /api/v1/rd/products/{id}/warehouse-stocks` - 获取产品各仓库库存
  - `GET /api/v1/rd/products/stocks/by-warehouse/{warehouseId}` - 按仓库获取库存列表
  - `GET /api/v1/rd/products/unit-conversions/all` - 获取租户全部单位换算
  - `DELETE /api/v1/rd/products/categories/{id}` - 删除产品分类
  - `PUT /api/v1/rd/products/stock/batch-update` - 批量更新产品库存

#### 3.1.4 供应链管理（Supply Chain）

- **路径**：`/modules/supply-chain/supply-chain.html`
- **前端脚本**：`/assets/js/ui-supplier.js`
- **功能**：
  - 供应商管理（三 Tab：供应商 / 进货单 / 建议）
  - 进货单管理
  - 进货明细管理
  - **弹窗 UI（2026-05-25）**：供应商编辑、进货单编辑/新增弹窗对齐产品中心 **Sheet 壳层**（**`TM_applyDialogShell` variant `sheet`**）；进货内容区为主，**接收仓库**与**付款/账务**压缩为底部次要区块（可折叠 **`tm-purchase-footer`**）
  - **进货编辑**：**接收仓库**、**付款状态（D016）** 与 **本次付款金额** 置于表单底部；已部分付款时提示剩余货款；**仓库可选**（单仓商户可不选，后端默认仓）
  - **库存入库联动**：经 **`POST /api/v1/supp/purchases/{id}/inbound`** 增量入库，非简单改状态加 **`products.stock`**
  - **独立记账**：**`POST /api/v1/supp/purchases/{id}/record-payment`**

#### 3.1.5 智能经营（Smart Ops）

- **路径**：`/modules/smart-ops/smart-ops.html`
- **功能**：
  - 订单管理
  - 生产管理
  - AI智能处理
  - 报表分析展示

#### 3.1.6 新手导览（Onboarding）

- **范围**：当前自动导览仅 **`WHOLESALE`** 业态（`tm-onboarding.js` **`shouldRun()`**）；运维账号不进商户导览。
- **脚本**：`/assets/js/tm-onboarding-registry.js`（步骤/角色必学路径、`targets.desktop` / `targets.mobile`）、`/assets/js/tm-onboarding.js`（引擎）、`/assets/js/tm-onboarding-sync.js`（服务端同步）、`/assets/js/ui-permissions.js`（`TM_ROLE_SCHEMA` / 菜单可见性）。
- **样式**：`/assets/css/tm-onboarding.css`。
- **角色必学（批发商示例）**：`ADMIN`/`SALES` 含工作台介绍 + 语音首单（阻塞导航）；`FINANCE`/`WAREHOUSE`/`READONLY` 见 registry **`MANDATORY_PROFILES`**。
- **流程**：
  1. 登录成功 → 可选缓存 **`onboarding`** 摘要 → 进入 **`index-app.html`**；
  2. **`GET /api/v1/tenant/onboarding/state`**（`markFirstLogin=true` 时写入 **`first_login_at`**）并与本地 merge；
  3. **`isFirstLogin && !welcomed`** → 欢迎弹窗；**`!mandatoryDone`** → 每次登录续做必学（含 **`mandatoryStepIndex`**）；
  4. 必学完成后 → 可选 **功能导览 FAB** + 清单面板（可「不再提示」）；**不**在 PC 顶栏重复「新手引导」按钮。
- **与子账号**：`sessionStorage.tm_auth_subuser_id` 存在时 **`subjectType=SUBUSER`**，与主账号分表存储。
- **公开 API**：`window.TmOnboarding`（`openChecklist`、`restart`、`onVoiceComplete` 等）；工作台语音完成回调 **`TmOnboarding.onVoiceComplete()`**。

#### 3.1.7 会员中心与推荐 UI

- **弹窗壳**：
  - 主壳内置 **`#member-modal`**（`index-app.html`）；
  - 独立模块页由 **`auth.js`** 注入 **`#subscription-modal`**（`MODAL_TEMPLATE`）。
- **数据填充**：**`tmHydrateMemberCenter(modal)`** — `GET /subscription/plans`、`GET /subscription/me`、`GET /referral/summary`；套餐卡片 **`tmRenderPlanCard`**；状态条 **`#tm-member-status-strip`**。
- **推荐官条（对齐 UI 工程 · 品牌青）**：
  - 片段文件 **`/modules/membership/member-referral-banner-snippet.html`**（`member-referral-hero` 渐变样式，与 **`referral-rewards-modal.html`** hero 一致）；
  - 占位 **`[data-tm-member-referral-slot]`**，由 **`tmInjectMemberReferralBanner()`** 在打开弹窗/壳层启动时 fetch 注入；
  - 含 **专属推荐码**（`#referral-code`）、**推荐名单**（`openReferralListModal`）、**生成海报**（`showPoster`）。
  - **已废弃**：旧版金色 **`gold-referral-card`**（琥珀渐变 + 火箭图标）不再作为主路径。
- **推荐奖励详情**：**`/modules/membership/referral-rewards-modal.html`** + **`referral-rewards.js`**（名单脱敏、提现收款信息）；由 **`injectMemberAuxModals()`** 注入。
- **支付回站**：`sessionStorage.tm_pending_subscription_pay_txnOrderId`；轮询 **`/subscription/payment/status`** 成功后 **`openMemberModal()`**。

#### 3.1.8 推广员移动门户（promoter-portal.html）

- **入口 URL**：生产 **`https://trademind.com.cn/promoter-portal.html`**；本地 **`http://localhost:9013/promoter-portal.html`**；微信公众号自定义菜单指向该 H5。
- **布局**：顶部姓名 + **`JY` 推广码**；三卡片（累计收益 / 待结算 / 有效推荐）；Tab「推荐流水」「收款账户」。
- **Token**：**`localStorage.tm_promoter_token`**（与商户 **`token`** 隔离）。
- **登录**：
  - 非微信：账号 + 密码 → **`POST /api/v1/tenant/login`**，校验 **`roleType=ROLE_PROMOTER`**；
  - 微信内：OAuth **`snsapi_userinfo`** → **`POST /api/v1/promoter/wechat/login`**；未绑定则账号密码 **`POST /api/v1/promoter/wechat/bind`** 或登录后 **`/wechat/bind-current`**。
- **收款**：**`GET/POST /api/v1/promoter/payout-profile`**，字段与商户 **`referral-rewards.js`** 一致（微信/支付宝/银行卡）。

**微信公众号 OAuth 配置流程（运维/运营）**：

1. 登录 [微信公众平台](https://mp.weixin.qq.com/) → **设置与开发** → **账号开发信息**，记录 **AppID**、**AppSecret**。
2. **设置与开发** → **功能设置** → **网页授权域名**：填写 **`trademind.com.cn`**（不含协议与路径）；按提示上传校验文件至静态站点根目录。
3. 部署环境变量（TenantService）：
   - **`WECHAT_MP_APP_ID`**、**`WECHAT_MP_APP_SECRET`**
   - **`WECHAT_MP_OAUTH_REDIRECT_URI=https://trademind.com.cn/promoter-portal.html`**
4. 公众号 **自定义菜单** 添加链接：`https://trademind.com.cn/promoter-portal.html`（建议菜单名「推广中心」）。
5. 运维 **`POST /api/v1/ops/promoters`** 为推广员开号；推广员首次在微信内打开 → OAuth → 账号密码绑定 → 之后静默登录。
6. 联调：微信内访问门户，确认 **`/api/v1/promoter/wechat/config`** 返回 **`oauthEnabled:true`**，授权回调 URL 带 **`code`** 后可进入主页。

### 3.2 后端服务模块

#### 3.2.1 租户服务（TenantService）

**主要接口**：


| 接口路径               | 方法   | 说明                |
| ------------------ | ---- | ----------------- |
| `/health`          | GET  | 健康检查              |
| `/info/{tenantId}` | GET  | 获取租户信息            |
| `/create`          | POST | 创建租户              |
| `/register`        | POST | 租户注册（Body 含 `smsToken`、`smsCode`、**`merchantType`**（可选）、**`referralCode`**（可选）；注册成功后开通 **D001/TRIAL 对应试用** 与 `subscription_plans` 中该业态试用方案；`dysms.enabled=true` 时须先 `send-code`） |
| `/login`           | POST | 用户登录（JWT 含 **`merchantType`**、**`accessMode`**、**`subscriptionTier`**、**`subEndMs`**；响应体可含 `merchantType`、`accessMode`、`referralCode`、**`onboarding`** 摘要 `{ isFirstLogin, mandatoryDone }`） |
| `/onboarding/state` | GET | 拉取导览快照；Query `industry`、`roleType`、`subjectType`、`subjectId`、`markFirstLogin`；首次 GET 可写入 **`first_login_at`**（需 Bearer） |
| `/onboarding/state` | PUT | 保存导览 **`snapshot`** JSONB（需 Bearer） |
| `/send-code`       | POST | 发送注册短信验证码（阿里云 Dysms SendSms：返回 `smsToken` 票据；未开启时为开发占位） |
| `/subscription/me` | GET  | 当前租户订阅摘要（含 **`userSeatMax`/`userSeatUsed`**、**`canManageUsers`**、**`pricingHints`**；需 Bearer） |
| `/subscription/plans` | GET | 某业态可售方案列表；Query `merchantType`（默认 `WHOLESALE`）；**网关可免 JWT**（见网关白名单） |
| `/referral/validate` | POST | Body `{ "code": "JYxxxxxx" }` 校验推荐码；**网关可免 JWT** |
| `/referral/summary` | GET  | 当前用户推荐码、有效推荐数、奖励累计（需 Bearer） |
| `/referral/invites` | GET | 邀请记录分页；Query `page`/`size`（需 Bearer） |
| `/referral/qualified` | GET | 有效推荐分页，`page`/`size`（需 Bearer） |
| `/referral/rewards` | GET | 当前用户奖励明细分页（需 Bearer） |
| `/referral/save-payee` | POST | 保存推荐收款人信息（需 Bearer） |
| `/subscription/renew` | POST | 续费当前方案；Body 可选 `pricePaid`、`externalOrderId`；返回 **`newToken`** |
| `/subscription/upgrade` | POST | 升级订阅档；Body **`targetTierCode`**、可选 `pricePaid`、`externalOrderId`；返回 **`newToken`** |
| `/user/payout-profile` | GET | 获取提现资料（需 Bearer） |
| `/user/payout-profile` | PUT/POST | 维护推荐奖励提现账户（需 Bearer，与 `biz_accounts` 经营账户分离） |
| `/referral/payout-profile` | POST | 同 **`/user/payout-profile`** 的 POST 别名 |
| `/users` | GET | 租户子账号列表（含席位 **`seatUsed`/`seatMax`**、**`canManage`**）；需 Bearer |
| `/users` | POST | 创建子账号（主管理员）；Body `userName`、`password`（MD5）、`roleType`、`realName`、`email`、`phone` |
| `/users/{userId}` | PUT | 更新子账号角色/密码/姓名 |
| `/subscription/payment/create` | POST | 会员订阅杭州银行统一收银台下支付单；Body：`action`（`NEW`/`RENEW`/`UPGRADE`）、`targetTierCode`；需 Bearer；`custom.payment.hccb.enabled=false` 时返回 **503** + `code=PAYMENT_DISABLED` |
| `/subscription/payment/status` | GET | Query `txnOrderId`；支付单状态（需 Bearer，且须本租户订单） |
| `/payout/callback` | POST | **杭州银行异步通知**（JSON 或表单）；**无 JWT**；验签与幂等履约后响应纯文本 **`Success`**；网关 **auth-whitelist** 须包含该路径 |
| `/internal/subscription/activate-paid` | POST | 内部/支付回调开通付费档；Header **`X-Internal-Token`**（与 `custom.security.internal-token` 一致）；Body：`tenantId`、`tierCode`、`months`、`pricePaid`、`externalOrderId`；**网关路径免 JWT**，仅靠内部令牌 |

**上下文与实现备注**（相对网关：`/api/v1/tenant`）：路径为服务 **context-path** 后的相对路径；会员类接口需在请求头携带 **`Authorization: Bearer`** + 登录返回的 **JWT**（网关已对白名单路径 **`/referral/validate`、`/subscription/plans`、`/v1/tenant/payout/callback`、`/internal/*`** 等放行 JWT 校验）。**`mock-token`** 联调时网关 **`UserInfo.accessMode`** 为 **`FULL`**。

#### 3.2.2 初始化配置服务（InitCfgService）

应用启动时 **`DatabaseInitService.initProductionBaseline()`** 按序幂等执行：

1. **`db/schema-production.sql`** — 33 张表（L1 基础设施 → L5 运营管理）、索引、存量列 **`ALTER`**
2. **`db/seed-data.sql`** — **`SYSTEM_OPS`** / **`ops_admin`**、字典 **D001–D017**（**D014** 客户特色标签固定码）、**`subscription_plans`** 16 行（含 WHOLESALE 定价覆盖）
3. **`validateCoreSchema()`** — Java 校验表存在性、关键列（如 **`orders.fin_status`**、**`production`**）、字典大类、**`uq_products_tenant_sku`** 等

初始化失败则 **InitCfgService 终止启动**。手工自检：**`db/check_schema.sql`**；清库重建流程：**`docs/Database_Deployment_Guide.md`**。

**已废弃**：**`production-schema-v1.sql`**、**`production-seed-v1.sql`**、**`migrations/legacy/`** 增量脚本、**`DictionaryInitService`** Java 字典写入、**`TenantService.SubscriptionPlanSeedService`**。

**主要接口**：


| 接口路径               | 方法  | 说明            |
| ------------------ | --- | ------------- |
| `/config/rds`      | GET | 获取RDS配置       |
| `/config/oss`      | GET | 获取OSS配置       |
| `/config/ai`       | GET | 获取AI大模型配置     |
| `/config/gateway`  | GET | 获取Web网关配置     |
| `/config/all`      | GET | 获取所有配置（含 `data.dysms`：短信 SendSms 相关参数） |
| `/config/dysms`    | GET | 获取短信（Dysms）配置 |
| `/config/oss/sts`  | GET | 获取OSS STS临时授权 |
| `/config/oss/base` | GET | 获取基础OSS配置     |
| `/config/auth`     | GET | 获取认证配置        |


#### 3.2.3 客户关系服务（CRMService）

**主要接口**：


| 接口路径              | 方法     | 说明              |
| ----------------- | ------ | --------------- |
| `/customers`      | GET    | 获取客户列表（支持关键词搜索） |
| `/customers/{id}` | GET    | 根据ID获取客户详情      |
| `/customers`      | POST   | 新增客户            |
| `/customers/save` | POST   | 保存客户（用于AI提取数据）  |
| `/customers/{id}` | PUT    | 更新客户信息          |
| `/customers/{id}` | DELETE | 删除客户            |
| `/customers/tags/recalc` | POST | 手动重算标签（`scope`: `CUSTOMER` \| `TENANT`；**ADMIN**） |

**客户 JSON 响应扩展**（`GET /customers`、`GET /customers/{id}`，向后兼容）：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `status` / `custStatus` | string | Badge 1，`cust_status`，字典 **D009** |
| `statusName` | string | Badge 1 展示名（服务端解析字典） |
| `custSegment` | string | Badge 2 存储码（`PC:{id}` / `MIXED` / `GENERAL` / `PENDING`） |
| `segmentName` | string | Badge 2 展示名（`PC:*` 解析为分类名） |
| `tagsComputedAt` | string | ISO 时间，对应 `tags_computed_at` |
| `source` | string | 获客来源 **D008**；可选于详情区，**不作为列表 Badge** |

**写接口约束**：`POST /customers`、`PUT /customers/{id}`、`POST /customers/save` **忽略**请求体中的 `custStatus`、`custSegment`；保存联系信息后触发单客户打标（或依赖订单事件）。`source` 仅 **AI 建客 / 首单渠道** 可写。

**打标服务**（实现名 **`CustomerTaggingService`**）：`recalcCustomer(tenantId, custId)`；日批生命周期；月批特色标签；规则见 §1.2.2。

**字典接口**（context-path 下）：

| 接口路径 | 方法 | 说明 |
| --- | --- | --- |
| `/dictionaries/list/{parentId}` | GET | 按父级 ID 获取字典子项 |
| `/dictionary/{dictCode}` | GET | 按 dict_code 查询字典项（Badge 1 用 **D009**，固定特色码用 **D014**） |

**TradeMind-Web CRM交互约束（2026-05-31）**：

1. CRM页面采用「客户列表 + 客户详情」双栏结构，移动端按一级/二级页面切换。
2. 客户列表右侧提供26字母索引（A-Z），点击后滚动到对应首字母客户分组。
3. 客户新增/编辑统一使用 **`tm-customer-registry-form`** 弹窗；仅联系信息可编辑；保存调用 `POST /customers`、`PUT /customers/{id}`；**标签不在表单内**。
4. 列表/详情 **仅 2 个标签 Badge**：**价值**（`statusName` / D009）+ **特色**（`segmentName`）；**禁止**用 `source`（D008）作第二 Badge。
5. 客户删除由前端调用RDService桥接接口（`DELETE /api/v1/rd/customers/{id}`）执行，删除前校验当前租户下是否存在关联订单。
6. 客户详情右侧电话按钮弹出轻量电话卡片；**交互时间轴**（2026-05-25）：按时间倒序展示订单项摘要（`产品名*数量 单位`，多项 **`, `** 分隔，超 **28 字符**或超过 **2 个 SKU** 以 **`...`** 省略）、双状态 Badge（**D010 物流 `dictname` | D015 财务 `dictname`**，品牌色 `#14B8A6` 浅底）、订单金额；进入 CRM 时 **`ui-crm.js`** 各拉取一次全量 **products** 索引与 **D010/D015** 字典。

#### 3.2.4 进销存服务（RDService）

**主要接口 - 产品管理**：


| 接口路径                                                      | 方法     | 说明           |
| --------------------------------------------------------- | ------ | ------------ |
| `/api/v1/rd/products`                                     | POST   | 创建产品         |
| `/api/v1/rd/products/{id}`                                | GET    | 根据ID获取产品     |
| `/api/v1/rd/products`                                     | GET    | 获取产品列表       |
| `/api/v1/rd/products/stocks/by-warehouse/{warehouseId}`   | GET    | 按仓库获取库存列表    |
| `/api/v1/rd/products/{id}/warehouse-stocks`               | GET    | 获取产品各仓库库存    |
| `/api/v1/rd/products/unit-conversions/all`                | GET    | 获取租户全部单位换算   |
| `/api/v1/rd/products/list/{tenantId}`                     | GET    | 根据租户ID获取产品列表 |
| `/api/v1/rd/products/list/{tenantId}/category/{category}` | GET    | 根据分类获取产品列表   |
| `/api/v1/rd/products/{id}`                                | PUT    | 更新产品         |
| `/api/v1/rd/products/delete/{id}`                         | DELETE | 删除产品（旧接口）    |
| `/api/v1/rd/products/{id}`                                | DELETE | 删除产品（新接口）    |
| `/api/v1/rd/products/low-stock/{tenantId}`                | GET    | 获取库存不足产品列表   |
| `/api/v1/rd/products/top-selling/{tenantId}/{limit}`      | GET    | 获取销量排名产品列表   |
| `/api/v1/rd/products/{id}/units`                          | GET    | 获取产品的单位换算列表  |
| `/api/v1/rd/products/save`                                | POST   | 保存产品及其单位换算信息 |
| `/api/v1/rd/products/restock/suggestions`                 | GET    | 获取进货建议列表     |
| `/api/v1/rd/products/stock/batch-update`                  | PUT    | 批量更新产品库存     |


**主要接口 - 分类管理**：


| 接口路径                                  | 方法   | 说明     |
| ------------------------------------- | ---- | ------ |
| `/api/v1/rd/products/categories`      | GET  | 获取分类列表 |
| `/api/v1/rd/products/categories/save` | POST | 保存分类信息 |
| `/api/v1/rd/products/categories/{id}` | DELETE | 删除分类   |


**主要接口 - 仓库管理**：


| 接口路径                                  | 方法     | 说明     |
| ------------------------------------- | ------ | ------ |
| `/api/v1/rd/products/warehouses`      | GET    | 获取仓库列表 |
| `/api/v1/rd/products/warehouses/save` | POST   | 保存仓库信息 |
| `/api/v1/rd/products/warehouses/{id}` | DELETE | 删除仓库   |


**主要接口 - 仓库调拨**：


| 接口路径                           | 方法   | 说明         |
| ------------------------------ | ---- | ---------- |
| `/api/v1/rd/products/transfer` | POST | 仓库调拨产品（批量） |


**主要接口 - 订单管理**：


| 接口路径                                  | 方法     | 说明                      |
| ------------------------------------- | ------ | ----------------------- |
| `/api/v1/rd/orders`                   | POST   | 创建订单                    |
| `/api/v1/rd/orders/confirm`           | POST   | 确认订单（用于AI提取数据）          |
| `/api/v1/rd/orders/{id}`              | GET    | 根据订单ID查询订单              |
| `/api/v1/rd/orders/code/{orderCode}`  | GET    | 根据订单编号查询订单              |
| `/api/v1/rd/orders`                   | GET    | 根据租户ID查询订单列表            |
| `/api/v1/rd/orders/in-progress`       | GET    | 查询进行中订单（**D010001 待配货 + D010002 拣货中 + D010003 已发货**；含 legacy `PENDING`/`PROCESSING` 兼容码） |
| `/api/v1/rd/orders/{id}/save`         | PUT    | 保存订单元数据（物流/财务状态、账户、交货日；不改 `received_amount`、不写流水） |
| `/api/v1/rd/orders/{orderId}/ship`    | POST   | 确认发货：扣减发出仓库存，明细 `is_processed` |
| `/api/v1/rd/orders/{orderId}/record-payment` | POST | 销售收款记账：写流水 + 更新 `received_amount`/`fin_status` |
| `/api/v1/rd/inventory/adjust`         | POST   | 通用库存调整（`InventoryService.adjust`，供发货/入库内部或扩展调用） |
| `/api/v1/rd/orders/latest`            | GET    | 查询最新的10条订单              |
| `/api/v1/rd/orders/{id}/status`       | PUT    | 更新订单状态                  |
| `/api/v1/rd/orders/{id}/items`        | GET    | 查询订单详情                  |
| `/api/v1/rd/orders/customer/{custId}` | GET    | 根据客户ID查询订单              |
| `/api/v1/rd/orders/sales-sum-by-products` | POST | 按产品 ID 列表汇总销量/金额      |
| `/api/v1/rd/customers/{id}`           | DELETE | 删除客户（CRM删除桥接接口，含订单关联校验） |


**主要接口 - 生产管理**（双路径 **`/productions`** 与 **`/api/v1/rd/productions`**）：

| 接口路径 | 方法 | 说明 |
| --- | --- | --- |
| `.../create` | POST | 创建生产计划 |
| `.../get/{prodId}` | GET | 按 ID 获取 |
| `.../get/{tenantId}/{prodId}` | GET | 租户内按 ID 获取 |
| `.../list/{tenantId}` | GET | 租户生产列表 |
| `.../list/{tenantId}/product/{productId}` | GET | 按产品筛选 |
| `.../list/{tenantId}/risk/{riskLevel}` | GET | 按风险等级筛选 |
| `.../list/{tenantId}/progress/{progress}` | GET | 进度低于阈值 |
| `.../upcoming/{tenantId}/{days}` | GET | 临近交货 |
| `.../pending/{tenantId}` | GET | 待开工（progress=0） |
| `.../update` | PUT | 更新 |
| `.../delete/{prodId}` | DELETE | 删除 |

**主要接口 - 字典管理**（双路径 **`/dictionaries`** 与 **`/api/v1/rd/dictionaries`**）：CRUD 与批量创建（`/create`、`/get/{dictId}`、`/list/{parentId}`、`/update`、`/delete/{dictId}`、`/batch-create` 等）。


#### 3.2.5 供应商服务（SuppService）

**主要接口 - 供应商管理**：


| 接口路径（兼容）                               | 方法     | 说明        |
| -------------------------------------- | ------ | --------- |
| `/supp/suppliers` 或 `/api/v1/supp/suppliers`           | GET    | 获取供应商列表   |
| `/supp/suppliers/{id}` 或 `/api/v1/supp/suppliers/{id}` | GET    | 根据ID获取供应商 |
| `/supp/suppliers` 或 `/api/v1/supp/suppliers`           | POST   | 创建供应商     |
| `/supp/suppliers/{id}` 或 `/api/v1/supp/suppliers/{id}` | PUT    | 更新供应商     |
| `/supp/suppliers/{id}` 或 `/api/v1/supp/suppliers/{id}` | DELETE | 删除供应商     |
| `/supp/suppliers/save` 或 `/api/v1/supp/suppliers/save` | POST | 保存供应商（统一 save） |


**主要接口 - 进货单管理**：


| 接口路径（兼容）                                              | 方法     | 说明              |
| ----------------------------------------------------- | ------ | --------------- |
| `/supp/purchases` 或 `/api/v1/supp/purchases`                    | GET    | 获取进货单列表（支持状态筛选） |
| `/supp/purchases/summary` 或 `/api/v1/supp/purchases/summary`    | GET    | 进货单汇总统计 |
| `/supp/purchases/suggestions/generation` 或 `.../suggestions/generation` | GET | 进货建议生成 |
| `/supp/purchases/{id}` 或 `/api/v1/supp/purchases/{id}`          | GET    | 根据ID获取进货单       |
| `/supp/purchases` 或 `/api/v1/supp/purchases`                    | POST   | 创建进货单（含明细）      |
| `/supp/purchases/{id}` 或 `/api/v1/supp/purchases/{id}`          | PUT    | 更新进货单           |
| `/supp/purchases/{id}` 或 `/api/v1/supp/purchases/{id}`          | DELETE | 删除进货单（含库存回滚）    |
| `/supp/purchases/{id}/status` 或 `/api/v1/supp/purchases/{id}/status` | PATCH  | 更新进货单状态         |
| `/supp/purchases/{id}/items` 或 `/api/v1/supp/purchases/{id}/items`  | GET    | 获取进货单明细         |
| `/supp/purchases/{id}/status` 或 `/api/v1/supp/purchases/{id}/status` | PUT    | 更新进货单状态（含库存联动）  |
| `/supp/purchases/save` 或 `/api/v1/supp/purchases/save`          | POST   | 保存进货单（含明细，统一 save） |
| `/supp/purchases/in-progress` 或 `/api/v1/supp/purchases/in-progress` | GET | 进行中进货单（非终态物流态） |
| `/supp/purchases/{id}/inbound` 或 `/api/v1/supp/purchases/{id}/inbound` | POST | 增量/全量入库（明细 `is_processed` 幂等） |
| `/supp/purchases/{id}/record-payment` 或 `/api/v1/supp/purchases/{id}/record-payment` | POST | 采购付款记账 |

**字典接口**（双路径）：

| 接口路径 | 方法 | 说明 |
| --- | --- | --- |
| `/supp/dictionaries/{parentId}` 或 `/api/v1/supp/dictionaries/{parentId}` | GET | 按父级获取字典 |
| `/supp/purchase_orders/statuses` 或 `/api/v1/supp/purchase_orders/statuses` | GET | 进货单状态字典（D012） |


#### 3.2.6 AI智能服务（AIService）

**主要接口**：


| 接口路径（网关入口）                  | 方法   | 说明         |
| --------------------------- | ---- | ---------- |
| `/api/v1/ai/process`        | POST | 处理AI请求     |
| `/api/v1/ai/execute`        | POST | 执行AI任务（异步） |
| `/api/v1/ai/status/{requestId}` | GET  | 查询任务状态     |
| `/api/v1/ai/records`        | GET  | 获取待确认单据列表  |
| `/api/v1/ai/records/{recordId}/result` | PUT | 更新 AI 提取结果（用户确认/修正） |
| `/api/v1/ai/records/{recordId}` | DELETE | 删除 AI 操作记录 |


#### 3.2.7 智能报表服务（IMService）

**主要接口**：


| 接口路径                                 | 方法     | 说明              |
| ------------------------------------ | ------ | --------------- |
| `/api/v1/im/report/revenue`          | GET    | 营收报表            |
| `/api/v1/im/report/inventory-health` | GET    | 库存健康报表          |
| `/api/v1/im/report/profit`           | GET    | 销售盈利报表          |
| `/api/v1/im/report/accounts`         | GET    | 往来账务报表          |
| `/api/v1/im/report/efficiency`       | GET    | 核心效率监控报表        |
| `/api/v1/im/accounts`                | GET    | 获取账户列表（租户隔离）    |
| `/api/v1/im/accounts/{id}`           | GET    | 获取账户详情          |
| `/api/v1/im/accounts/save`           | POST   | 新增/更新账户（统一保存接口） |
| `/api/v1/im/accounts/{id}`           | DELETE | 删除账户（逻辑删除）      |
| `/api/v1/im/accounts/{id}/ledger`    | GET    | 分页查询账户流水（支持 startDate/endDate） |
| `/api/v1/im/accounts/{id}/ledger/export` | GET | 导出当前筛选结果为 Excel（单次最多 10000 条） |


#### 3.2.8 运维中台服务（OpsService）

> 网关入口前缀 **`/api/v1/ops`**；须 **`SYSTEM_OPS`** 租户 + **`ROLE_OPS_ADMIN`** JWT（§2.4.5）。

**主要接口**：

| 接口路径 | 方法 | 说明 |
| --- | --- | --- |
| `/api/v1/ops/health` | GET | 健康检查 |
| `/api/v1/ops/dashboard/summary` | GET | 运维大盘摘要（租户数、AI 用量等） |
| `/api/v1/ops/tenants` | GET | 租户分页列表；Query `page`/`size` |
| `/api/v1/ops/tenants/tree` | GET | 租户树；Query `industry`、`sort`（默认 `aiTokensMonth`）、`page`/`size` |
| `/api/v1/ops/tenants/{tenantId}` | GET | 租户详情（含订阅与资源快照） |
| `/api/v1/ops/tenant/extend-subscription` | POST | 延长租户订阅；Body `tenantId`、`extendDays`、`reason`；写 **`ops_subscription_logs`** |
| `/api/v1/ops/referrals/rewards` | GET | 推荐奖励列表；Query `status` 可选 |
| `/api/v1/ops/referrals/tree` | GET | 推荐关系树；Query **`rootUserId`** 必填 |
| `/api/v1/ops/referrals/rewards/{id}/mark-paid` | POST | 标记奖励已发放 |
| `/api/v1/ops/promoters` | POST | 手动创建推广员；Body `userName`、`password`（MD5）、`realName`、`phone`、可选 `email`；转发 TenantService **`/internal/promoters`** |
| `/api/v1/ops/ai-usage/stats` | GET | AI Token 统计；Query `range`（默认 `week`）、`topN` |
| `/api/v1/ops/announcements` | GET | 全站公告列表 |
| `/api/v1/ops/announcements` | POST | 创建公告；Body `title`、`bodyMd`、`priority`、`activeFrom`/`activeUntil` |
| `/api/v1/ops/announcements/{id}` | PUT | 更新公告 |
| `/api/v1/ops/announcements/{id}` | DELETE | 删除公告 |

#### 3.2.9 推广员门户 API（TenantService / PromoterController）

> 网关入口 **`/api/v1/promoter/**`**；须 **`ROLE_PROMOTER`** + **`tenantId=SYSTEM_OPS`** JWT（微信 OAuth 登录/绑定路径见 §2.4.7 白名单）。

| 接口路径 | 方法 | 说明 |
| --- | --- | --- |
| `/api/v1/promoter/stats` | GET | 累计收益、待结算、有效推荐数、姓名、推广码 |
| `/api/v1/promoter/records` | GET | 推荐流水；Query `page`/`size`；手机号中间 4 位掩码 |
| `/api/v1/promoter/payout-profile` | GET | 收款资料 |
| `/api/v1/promoter/payout-profile` | POST | 保存收款资料（微信/支付宝/银行卡） |
| `/api/v1/promoter/wechat/config` | GET | OAuth 是否启用、appId（公开） |
| `/api/v1/promoter/wechat/oauth-url` | GET | 返回微信授权 URL；Query 可选 `state`（公开） |
| `/api/v1/promoter/wechat/login` | POST | Body `{ "code" }`；已绑定 openid 则返回 JWT（公开） |
| `/api/v1/promoter/wechat/bind` | POST | Body `bindToken`、`userName`、`password`（MD5）；首次绑定（公开） |
| `/api/v1/promoter/wechat/bind-current` | POST | 已登录推广员绑定 pending openid |
| `/api/v1/tenant/internal/promoters` | POST | 内部开号；Header **`X-Internal-Token`**；Body 同运维开号 |

---

## 4. 数据库ER图（文字描述）

### 4.1 核心实体关系

```
tenants (租户)
   ├─ 1:N ──> users (用户)
   ├─ 1:N ──> balanceChgDetails (能量变动记录)
   ├─ 1:N ──> customers (客户)
   ├─ 1:N ──> supplier (供应商)
   ├─ 1:N ──> product_categories (产品分类)
   ├─ 1:N ──> warehouse (仓库)
   ├─ 1:N ──> products (产品)
   ├─ 1:N ──> orders (订单)
   ├─ 1:N ──> production (生产)
   ├─ 1:N ──> purchases (进货单)
   ├─ 1:N ──> biz_accounts (账户信息)
   ├─ 1:N ──> ai_operation_records (AI操作记录)
   ├─ 1:N ──> ops_tenant_snapshot (运维资源快照)
   ├─ 1:N ──> ai_usage_stats (AI Token 计量)
   ├─ 1:N ──> ops_subscription_logs (订阅延期审计，target)
   └─ 1:N ──> dictionary (字典表)

users (用户)
   ├─ 1:N ──> customers (客户)
   ├─ 1:N ──> supplier (供应商)
   ├─ 1:N ──> products (产品)
   ├─ 1:N ──> product_categories (产品分类)
   ├─ 1:N ──> orders (订单)
   ├─ 1:N ──> production (生产，历史表)
   ├─ 1:N ──> purchases (进货单)
   ├─ 1:N ──> biz_accounts (账户信息)
   ├─ 1:N ──> ai_operation_records (AI操作记录)
   ├─ 1:N ──> ops_subscription_logs (运维操作人)
   └─ 1:N ──> system_announcements (公告创建人)

customers (客户)
   └─ 1:N ──> orders (订单)

supplier (供应商)
   ├─ 1:N ──> products (产品)
   └─ 1:N ──> purchases (进货单)

warehouse (仓库)
   └─ 1:N ──> warehouse_stock (仓库库存)

product_categories (产品分类)
   └─ 1:N ──> products (产品)

products (产品)
   ├─ 1:N ──> order_items (订单明细)
   ├─ 1:N ──> production (生产)
   ├─ 1:N ──> unitConversion (单位换算)
   ├─ 1:N ──> purchase_items (进货明细)
   └─ 1:N ──> warehouse_stock (仓库库存)

biz_accounts (经营账户)
   └─ 1:N ──> biz_account_ledger (账户流水)

orders (订单)
   ├─ N:1 ──> biz_accounts (结算账户)
   ├─ N:1 ──> warehouse (发出仓库，可选)
   └─ 1:N ──> order_items (订单明细)

purchases (进货单)
   ├─ N:1 ──> biz_accounts (付款账户)
   ├─ N:1 ──> warehouse (入库仓库，可选)
   └─ 1:N ──> purchase_items (进货明细)

dictionary (字典表)
   └─ 1:N ──> dictionary (子级字典)
```

### 4.2 外键关系说明

- **tenants**是所有业务表的父表，通过`tenant_id`实现多租户隔离
- **tenants.merchant_type** 存字典 **D013** 子项 `dict_code`（应用层校验；是否建 DB 外键视部署规范而定）
- **users**与**tenants**多对一关系
- 所有业务表都通过`tenant_id`关联到租户
- 所有业务表都通过`user_id`关联到创建用户
- **products**通过`supplier_id`关联到supplier
- **products**通过`category_id`关联到product_categories
- **warehouse_stock**通过product_id和warehouse_id关联到products和warehouse
- **orders**通过cust_id关联到customers
- **purchases**通过supplier_id关联到supplier

---

## 5. 技术栈总结

### 5.1 前端技术栈

- **框架**：原生HTML + JavaScript
- **UI框架**：Tailwind CSS 3.x
- **图标库**：Phosphor Icons
- **HTTP客户端**：原生Fetch API

### 5.2 后端技术栈

- **语言**：Java 17+
- **框架**：Spring Boot 3.2.x
- **ORM**：
  - Spring Data JPA（多数服务）
  - MyBatis（SuppService）
- **数据库**：PostgreSQL
- **连接池**：HikariCP
- **认证**：JWT（JSON Web Token）
- **异步处理**：Spring @Async
- **日志**：SLF4J + Logback

### 5.3 云服务集成

- **对象存储**：阿里云OSS
- **AI大模型**：阿里云通义千问 / 其他大模型
- **数据库**：阿里云RDS PostgreSQL（可选）

### 5.4 部署技术

- **容器化**：Docker + Docker Compose
- **环境配置**：.env文件

---

## 6. 关键业务流程说明

### 6.1 用户认证流程

1. 用户输入用户名密码（密码前端 MD5 后与现网 TenantService 约定一致）
2. 前端经网关调用 `POST /api/v1/tenant/login`
3. TenantService 验证用户信息，读取租户 **`merchant_type`**
4. 生成 JWT（有效期以 `InitCfgService` `/config/auth` 中 `jwtTtl` 为准；Claims 含 **`merchantType`**）
5. 前端将 Token 存入 `localStorage`，后续请求 **`Authorization: Bearer <token>`** 访问网关
6. 网关校验 JWT 后 **保留** `Authorization` 并注入身份头 **`X-User-Id`、`X-Tenant-Id`、`X-User-Role`、`X-Merchant-Type`**（客户端不应伪造后者；策略逻辑以服务端租户库为准）

### 6.2 AI订单提取流程

1. 用户上传订单图片/语音/输入文本
2. 前端调用AIService`/ai/execute`接口
3. AIService生成requestId，保存记录到数据库（状态：EXTRACTING）
4. AIService异步调用大模型API
5. 大模型返回提取结果，更新数据库状态（SUCCESS/FAILED）
6. 前端轮询`/ai/status/{requestId}`接口获取处理状态
7. 处理成功后，用户确认保存数据

### 6.3 订单创建与履约流程

1. 用户选择客户，添加订单明细
2. 前端调用 RDService **`POST /api/v1/rd/orders`**
3. RDService 开启事务：保存 **`orders`**（默认物流 **D010001 待配货**、财务 **UNPAID**）与 **`order_items`**
4. **创建时不扣减库存**（出库点在 **`ship`**）
5. 提交事务，返回结果

#### 6.3.1 销售发货流程

1. 用户在工作台或订单详情触发发货（或调用 **`POST /api/v1/rd/orders/{id}/ship`**）
2. 选择发出仓库（可省略，用订单仓或租户默认仓）
3. **`InventoryService.adjust`** 扣减 **`warehouse_stock`**，明细 **`is_processed=true`**
4. 订单物流态更新为 **D010003 已发货**

#### 6.3.2 销售收款流程

1. 用户选择收款账户并填写本次收款金额
2. 调用 **`POST /api/v1/rd/orders/{id}/record-payment`**
3. 写入 **`biz_account_ledger`**（`SALES_INCOME`），累加 **`received_amount`**，重算 **`fin_status`（D015）**

### 6.4 进货单创建与入库流程

1. 用户选择供应商，添加进货明细
2. 前端调用 SuppService **`POST /api/v1/supp/purchases`**
3. SuppService 开启事务：保存 **`purchases`**（默认物流 **DRAFT**、财务 **UNPAID**）与 **`purchase_items`**
4. 提交事务

#### 6.4.1 进货入库与付款

1. **入库**：调用 **`POST /api/v1/supp/purchases/{id}/inbound`**（可选 **`itemIds`** 部分入库）；增量更新 **`warehouse_stock`**，主表物流态 **PARTIAL_INBOUND / FULL_INBOUND**
2. **付款**：调用 **`POST /api/v1/supp/purchases/{id}/record-payment`**；写 **`PURCHASE_EXPENSE`** 流水，更新 **`paid_amount`** 与 **`fin_status`（D016）**
3. 编辑界面底部可选仓库（**可空**）与付款区块，不以大块 UI 抢占明细编辑区

### 6.5 仓库调拨流程

1. 用户选择源仓库和目标仓库，添加调拨产品
2. 前端调用RDService`/api/v1/rd/products/transfer`接口
3. RDService开启事务
4. 验证源仓库和目标仓库是否存在
5. 对每个调拨产品，验证库存是否充足
6. 扣减源仓库库存，增加目标仓库库存
7. 更新warehouse_stock表记录
8. 提交事务

---

## 7. 系统特性总结

### 7.1 多租户架构

- 所有业务表都包含`tenant_id`字段
- 租户间数据完全隔离
- 支持租户级别的配置管理

### 7.2 微服务设计

- 各服务职责单一，独立部署
- 通过API网关统一入口
- 服务间通过HTTP API通信

### 7.3 AI智能化

- 支持订单智能提取（图片/语音/文本）
- AI处理过程异步化，不阻塞用户
- 完整的AI操作记录和状态跟踪

### 7.4 报表分析

- 实时营收报表
- 库存健康监控
- 销售盈利分析
- 往来账务管理
- 核心效率指标（库存周转率、回款周期）

### 7.5 移动端适配

- **三段式布局引擎**（2026-05-25）：**Header（文档流固定）+ Main（唯一滚动，`100dvh`）+ Bottom Nav（fixed）**；权威样式 **`/assets/css/tm-layout-engine.css`**
- 主壳 **`index-app.html`** 在 **&lt;768px** 使用底栏 Tab + 顶栏 **`tm-app-header-brand`（商贸智脑）**（§3.1.0）
- **`TM_applyDialogShell` / `TM_ShellInsets`**：业务弹窗移动态 Bottom Sheet（**`rounded-[2.5rem]`**），与产品中心/供应链/工作台详情对齐
- 独立模块页经 **`injectCommonUI`** 可注入 **`tm-mobile-header`**；**主壳页禁止重复注入**（避免双层顶栏）
- 移动端优化的弹窗 UI（会员中心 sheet、推荐奖励弹窗等）
- **`MobileAdapt/TM_Responsive.js`**：`isMobile()` / **`isMobileView()`**、`body.tm-layout-mobile`；样式分界与 Tailwind `md`（768px）对齐时，自定义 CSS 建议使用 **`max-width: 767px`**
- **`MobileAdapt/mobile.css`**、**`ui-mobile.css`**：壳层规则已迁移至 **`tm-layout-engine.css`**，保留 **`@deprecated`** 兼容引用

### 7.6 多商户类型（业态）

- 字典 **D013** 为商户类型唯一字典来源；持久化字段 **`tenants.merchant_type`**。
- 运行时身份：**JWT `merchantType`** → 网关 **`X-Merchant-Type`** → 各服务 **`UserContext`**（或等价上下文）。
- 前端按业态加载 **`/fragments/...`**，根节点 **`data-merchant-type`** 驱动主题令牌（见 `theme.css`）。

---

## 8. 文件目录结构

```
TM_Project/
├── docs/
│   └── Database_Deployment_Guide.md   # 清库重置与自检流程
├── TenantService/              # 租户服务
│   └── 结构同其他服务
├── InitCfgService/             # 初始化配置服务（唯一 DDL 入口）
│   └── src/main/resources/
│       └── db/
│           ├── schema-production.sql   # 生产基线 DDL（33 表 + 索引 + 存量 ALTER）
│           ├── seed-data.sql           # 运维租户、字典、订阅方案
│           └── check_schema.sql        # 手工自检
├── CRMService/                 # 客户关系服务
│   └── 结构同其他服务
├── RDService/                  # 进销存服务
│   └── 结构同其他服务
├── SuppService/                # 供应商服务
│   └── 结构同其他服务
├── AIService/                  # AI智能服务
│   └── 结构同其他服务
├── IMService/                  # 智能报表服务
│   └── 结构同其他服务
├── OpsService/                 # 运维中台服务
│   └── 结构同其他服务
├── scripts/
│   └── postgresql/            # 运维/验收手工脚本（非自动启动；DDL 权威在 InitCfgService/db/）
└── TradeMind-Web/              # 前端Web应用
    ├── index-app.html         # 商户主壳（侧栏/顶栏/底栏、member-modal）
    ├── docs/
    │   └── Framework_Guide.md # 目录职能、fragments、tm-ui-loader、D013 对齐说明
    ├── fragments/             # 按业态目录存放 HTML 片段（wholesale/foreign/ecom/factory）
    │   └── …                  # 例：dashboard/workspace-banner.html
    ├── MobileAdapt/
    │   ├── TM_Responsive.js   # 响应式：isMobile / isMobileView、tm-layout-mobile
    │   └── mobile.css         # @deprecated，壳层已迁至 tm-layout-engine.css
    ├── assets/
    │   ├── css/
    │   │   ├── tm-layout-engine.css  # 手机端三段式壳层 + Bottom Sheet（权威）
    │   │   ├── tm-onboarding.css
    │   │   ├── ui-mobile.css         # @deprecated 兼容
    │   │   └── product-center.css
    │   └── js/
    │       ├── auth.js              # 认证、会员中心、布局 CSS 注入
    │       ├── tm-ui-loader.js      # TM_UI_CONTEXT、injectSlots、tm-role-ui-ready
    │       ├── tm-onboarding.js / tm-onboarding-registry.js / tm-onboarding-sync.js
    │       ├── ui-permissions.js    # TM_ROLE_SCHEMA
    │       ├── tm-shell-insets.js   # 壳层 safe-area / header-tabbar 高度、弹窗 sheet
    │       ├── main-app.js
    │       ├── ui-main.js           # switchTab、iframe 嵌入、TM_applyDialogShell
    │       ├── ui-product-center.js / ui-product-center-enhance.js
    │       ├── ui-crm.js / ui-supplier.js
    │       └── env-config.js
    ├── modules/
    │   ├── membership/
    │   │   ├── member-referral-banner-snippet.html
    │   │   ├── referral-rewards-modal.html
    │   │   └── referral-rewards.js
    │   ├── CSS/
    │   │   └── common.css     # @import tm-layout-engine；顶栏、会员推荐 hero
    │   ├── dashboard/
    │   ├── crm/
    │   ├── product-center/
    │   │   └── product-overlays.html  # 产品弹窗 HTML 片段
    │   ├── supply-chain/
    │   └── smart-ops/
    ├── promoter-portal.html   # 推广员移动 H5（微信 OAuth + 收益/流水/收款）
```

---

## 9. 安全设计要点

### 9.1 认证与授权

- JWT Token 认证机制；Claims 含 **`merchantType`**（与租户库一致）、**`accessMode`**、**`subscriptionTier`**、**`subEndMs`**；网关据此执行订阅访问策略（§2.4.4）与运维 RBAC（§2.4.5）
- Token 有效期以配置中心 `jwtTtl` 为准（文档示例常为 24 小时）
- 经网关访问时：下游业务服务通过 **`Authorization: Bearer`**（TenantService 等二次解析）及 **`X-Tenant-Id`、`X-User-Id`、`X-User-Role`、`X-Merchant-Type`** 获取用户与租户上下文（身份头由网关注入，勿信任浏览器随意伪造 Header）
- **`/api/v1/ops/**`** 仅限 **`tenantId=SYSTEM_OPS`** 且 **`roleType=ROLE_OPS_ADMIN`**
- **`ROLE_PROMOTER`** 仅可访问 **`/api/v1/promoter/**`** 与 **`POST /api/v1/tenant/login`**；**禁止**访问运维与商户业务 API（§2.4.7）
- 服务间通过内部 Token 验证；**`/internal/subscription/activate-paid`**、**`/internal/promoters`** 依赖 **`X-Internal-Token`**（与 **`TenantService`** 配置一致），**不得**暴露给浏览器

### 9.2 数据隔离

- 多租户通过`tenant_id`实现数据隔离
- 所有查询都强制校验租户权限
- 用户只能访问自己租户的数据

### 9.3 密码安全

- 密码使用哈希存储（不保存明文）
- 登录时验证密码哈希

### 9.4 CORS处理

- API网关统一处理跨域请求
- 配置允许的源地址和请求方法

---

## 10. 更新历史记录


| 版本    | 日期         | 更新内容                                                                                                                                                                                |
| ----- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.24 | 2026-06-01 | **独立推广员系统**：§1.1.2 **`wechat_mp_openid`**；§2.4.7 推广员网关白名单；§2.8.6–§2.8.7 开号/奖励 150/流水状态；§3.1.8 **`promoter-portal.html`** 与微信公众号 OAuth 流程；§3.2.8 **`POST /ops/promoters`**；§3.2.9 推广员 API；**`PromoterController`**、**`InternalPromoterController`**、网关 **`RewritePath`** |
| v1.23 | 2026-05-31 | **CRM 客户双标签**：§1.2.1 增补 `cust_segment`、`tags_computed_at`；§1.2.2 价值+特色打标规则；**D009** 扩展 `NEW`/`HIGH_VALUE`；启用 **D014** `CUSTOMER_SEGMENT`；§3.1.2、§3.2.3 API 响应与写约束、`/customers/tags/recalc` |
| v1.22 | 2026-05-28 | **数据库初始化引擎规整**：废弃 **`production-schema-v1.sql`** / **`production-seed-v1.sql`** / **`migrations/legacy/`**；统一为 **`InitCfgService/db/schema-production.sql`**（33 表，含 **`production`**、双维度状态列、**`uq_products_tenant_sku`**）+ **`seed-data.sql`** + **`validateCoreSchema()`**；字典/订阅种子迁入 SQL；**`DictionaryInitService`**、**`SubscriptionPlanSeedService`** 废弃；新增 **`docs/Database_Deployment_Guide.md`**、**`db/check_schema.sql`**；§1 文首、§2.8.3–§2.8.4、§2.9.4、§3.2.2、§8 同步 |
| v1.21 | 2026-05-25 | **单据状态机与库存**：§1 增补 `orders`/`order_items`/`purchases`/`purchase_items` 财务与 **`is_processed`** 列、**`biz_account_ledger.biz_type_code`**；**`alter_document_status_inventory.sql`**；字典 **D010–D012** 物流重构、**D015–D017** 全表；§1.4.4 入账规则改为 **`record-payment`/`ship`/`inbound`** 双线解耦；§2.9 状态机与迁移。**前端**：§3.1.0 **`tm-layout-engine.css`** 三段式壳层 + **`TM_applyDialogShell`** Sheet；§3.1.1 工作台进行中单据双维筛选/详情编辑/终态移除；§3.1.3 产品类别可空、单位换算最多 2 行、高级配置展开修复；§3.1.4 供应链弹窗 Sheet 与进货底部仓库/付款区；§3.2.3 CRM 时间轴 Badge；§3.2.4–3.2.5 新 API；§6.3–§6.4 流程；§7.5、§8 目录树 |
| v1.20 | 2026-05-24 | **新手导览**：§1.1.2.1 **`user_onboarding_state`** 快照字段与双写策略；**`InitCfgService.applyIncrementalMigrations()`**；§3.1.6、`OnboardingController`；§3.2.1 **`/onboarding/state`**、登录 **`onboarding`** 摘要。**会员/壳层 UI**：§3.1.0 主壳顶栏表、§3.1.7 会员中心（**`member-referral-banner-snippet`** 品牌青 hero，废弃主路径 **`gold-referral-card`**）；PC 顶栏去重新手引导/退出；移动 **`tm-app-header-brand`** 固定「商贸智脑」。§8 目录树同步 |
| v1.19 | 2026-05-20 | DDL 权威切换至 **`production-schema-v1.sql`** / **`production-seed-v1.sql`**；§1.1.2 **`last_login_ip`**；§1.6 运维表（**`ops_tenant_snapshot`、`ai_usage_stats`、`ops_subscription_logs`、`system_announcements`**）；新增 **OpsService** 与网关 **`/api/v1/ops/**`** RBAC（§2.4.5）；§3.2.1 子账号/续费升级/推荐扩展接口；§3.2.4–3.2.6 补齐 RD/Supp/AI 接口；§3.2.8 运维 API；网关 **保留 Authorization** 转发说明 |
| v1.18 | 2026-05-12 | §1 与 **`InitCfgService/create_tables.sql`** 对齐：`tenant_subscriptions` 日期约束；**`subscription_payment_orders` / `subscription_payment_events`** 全列与索引（§1.1.4.1–1.1.4.2）；**`balanceChgDetails`、`customers`、`orders`、`order_items`、`dictionary`、`ai_operation_records`** 物理蛇形列名；**`biz_account_ledger`** 索引与幂等唯一索引；**`production`** 标注当前 DDL 未含；§3.2.2 / 初始化说明列举 **`alter_subscription_payment.sql`** 等 |
| v1.17 | 2026-05-08 | **`biz_accounts.balance`**、**`biz_account_ledger`** 及索引；订单「已完成」入账（RDService）、进货 **`paid_amount`** 差额入账（SuppService）、IMService 手动余额轧差；IMService **`/accounts/{id}/ledger`** 与 Excel 导出（≤10000 条）；智能经营前端列表/详情/流水与 §3.2.7 接口说明 |
| v1.16 | 2026-05-07 | **商业化订阅与推荐奖励落地对齐文档**：§1 增补 **`tenants`/`users`** 字段及 **`subscription_plans`、`tenant_subscriptions`、`referral_records`、`referral_rewards`**；§1.5.3 种子与配额说明；§2.1–§2.4 网关 **`accessMode`** 与白名单 / **`subscription-bypass-path-fragments`**；§2.7–§2.8 注册试用、内部付费、达标奖励与 **`§2.8.4` 实现对照**；§3.2.1、§9.1 同步；**`alter_subscription_referral.sql`** |
| v1.15 | 2026-05-06 | 多商户类型：`tenants.merchant_type`；字典 **D013**；JWT **`merchantType`** 与网关 **`X-Merchant-Type`**；AIService 等下游上下文透传；前端 **`/fragments/`**、`tm-ui-loader.js`、`TM_UI_CONTEXT`、注册意图 **`tmResolveMerchantIntent`**；§2.7、§3.1.0、§7.6、§8、§9.1 增补；网关服务列表修正为 Spring Cloud Gateway |
| v1.14 | 2026-02-05 | 产品中心：类别/供应商筛选按 `category_id`、`supplier_id` 生效；§1.3.1–1.3.6 表结构与 `create_tables.sql` 对齐；搜索框图标与占位避让 |
| v1.13 | 2026-02-05 | 供应链：`purchases`/`purchase_items`/`biz_accounts` 表结构说明与 `InitCfgService/create_tables.sql` 物理列名对齐（蛇形命名）；进货单保存关联 `account_id`；前端进货弹窗付款账户与日期绑定说明 |
| v1.12 | 2026-05-01 | 租户注册短信：`InitCfgService` 提供 `custom.aliyun.dysms` 与 `GET /config/dysms`、`/config/all` 含 `dysms`；`TenantService` 使用 Dysmsapi SendSms + 服务端票据校验，`POST /send-code` 与注册 `registerTenant` 联调；网关白名单放行 `/v1/tenant/send-code` |
| v1.11 | 2026-04-30 | 网关与模块路由拉齐：新增网关统一入口/CORS/白名单规范；补充生产域名跨域白名单与预检处理策略；明确DedupeResponseHeader防重复CORS头；记录RDService与SuppService兼容式双路径策略（旧路径+`/api/v1/...`）；更新AIService网关入口接口说明 |
| v1.10 | 2026-04-22 | 客户CRM模块重构：TradeMind-Web页面与UI工程拉齐（双栏布局、统一客户弹窗、电话卡片、A-Z索引）；客户新增/编辑改为CRMService真实CRUD；客户删除改为调用RDService桥接接口`DELETE /api/v1/rd/customers/{id}`并增加“存在订单不可删”校验；交易时间轴按倒序展示订单摘要（超16字符省略）及金额 |
| v1.9  | 2026-04-22 | 智能经营模块重构：对齐UI工程布局；新增账户信息表`biz_accounts`；订单表`orders`与进货单表`purchases`新增`account_id`外键；IMService新增账户CRUD接口（`/api/v1/im/accounts*`）并接入网关统一鉴权头（X-Tenant-Id/X-User-Id）；完善文档ER关系与接口说明      |
| v1.8  | 2026-04-19 | 完成供应商管理模块全链路重构：新增进货单状态字典接口（/api/v1/supp/purchase_orders/statuses），完善供应商和进货单的save接口，重构前端UI为三Tab布局，实现完整的供应商和进货单CRUD功能，包含状态Badge显示和移动端适配                                               |
| v1.7  | 2026-04-19 | 更新产品表category字段为category_id，添加外键关联product_categories表；完善后端Product相关接口；重构前端产品中心交互；更新概要设计文档                                                                                           |
| v1.6  | 2026-04-19 | 更新文档至最新表结构；补充product_categories、warehouse_stock表完整字段；更新product分类字段说明；补充完整的RDService接口列表，包含分类、仓库、调拨等接口；更新前端路径为modules目录                                                              |
| v1.5  | 2026-04-16 | 新增仓库库存表（warehouse_stock）完整字段说明；更新数据库ER图，加入warehouse_stock表及其与warehouse、products的关系；在产品中心模块补充仓库调拨功能说明                                                                                |
| v1.4  | 2026-04-16 | 更新字典表设计，修正12个字典大类的dict_code字段；补充D012进货单据状态的7个子项；同步更新DictionaryInitService.java中的字典初始化数据                                                                                             |
| v1.3  | 2026-04-16 | 更新表结构设计，补充仓库表（warehouse）和产品分类表（product_categories）的完整定义；更新后端接口列表，补充产品分类和仓库管理接口；更新数据库ER图，完善实体关系描述；更新前端目录结构（历史版本曾描述 modules-ui；现行方案见 §8、`Framework_Guide.md`，行业片段使用 **`/fragments/`**） |
| v1.2  | 2026-04-15 | 产品中心模块完成真实数据交互对接，产品、仓库、分类管理功能全部对接RDService API                                                                                                                                      |
| v1.1  | 2026-04-14 | 首次系统概要设计文档发布                                                                                                                                                                        |


---

**文档版本**：v1.23
**最后更新**：2026-05-31
**维护者**：TradeMind开发团队