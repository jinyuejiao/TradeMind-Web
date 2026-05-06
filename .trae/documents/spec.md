# 商贸智脑（TradeMind）系统概要设计文档

## 概述

商贸智脑是一个面向中小微企业的智能经营一体化平台，提供客户管理、产品管理、订单管理、供应商管理、生产管理、AI智能处理、报表分析等一站式解决方案。

系统支持**多商户类型（业态）**SaaS 扩展：租户具有字典 **D013** 定义的 `merchant_type`，登录 JWT 与 API 网关向下游透传 **`X-Merchant-Type`**；前端通过 **`/fragments/<业态目录>/`** 与 **`tm-ui-loader.js`** 实现行业片段注入（详见 §3.1、§2.7）。

## 系统架构

采用微服务架构，由多个独立服务组成，通过API网关统一对外提供服务；网关在校验 JWT 后剥离 `Authorization`，并向业务服务注入 **`X-User-Id`、`X-Tenant-Id`、`X-User-Role`、`X-Merchant-Type`**（见 §2.7）。

---

## 1. 数据库表结构设计

### 1.1 核心业务表

#### 1.1.1 租户表（tenants）


| 字段名              | 类型        | 长度  | 可空  | 默认值              | 说明      |
| ---------------- | --------- | --- | --- | ---------------- | ------- |
| tenantid         | VARCHAR   | 32  | 否   | -                | 租户ID，主键 |
| tenantname       | VARCHAR   | 100 | 否   | -                | 租户名称    |
| phone            | VARCHAR   | 20  | 否   | -                | 联系电话，唯一 |
| email            | VARCHAR   | 120 | 是   | NULL             | 邮箱地址    |
| tenantcode       | VARCHAR   | 50  | 是   | -                | 租户代码    |
| subscriptiontype | VARCHAR   | 50  | 否   | -                | 订阅类型    |
| energybalance    | INT       | 否   | 0   | 能量余额             |         |
| substarttime     | TIMESTAMP | -   | 否   | -                | 订阅开始时间  |
| subendtime       | TIMESTAMP | -   | 否   | -                | 订阅结束时间  |
| tenantstatus     | VARCHAR   | 50  | 否   | NORMAL           | 租户状态    |
| merchant_type    | VARCHAR   | 50  | 否   | WHOLESALE        | 商户类型（字典 **D013** 子项 `dict_code`：`WHOLESALE` / `FOREIGN_TRADE` / `ECOM` / `FACTORY_TRADE`），与 JWT `merchantType`、网关 `X-Merchant-Type` 一致 |
| createtime       | TIMESTAMP | -   | 是   | CURRENTTIMESTAMP | 创建时间    |
| updatetime       | TIMESTAMP | -   | 是   | CURRENTTIMESTAMP | 更新时间    |


#### 1.1.2 用户表（users）


| 字段名          | 类型        | 长度  | 可空  | 默认值              | 说明      |
| ------------ | --------- | --- | --- | ---------------- | ------- |
| userid       | SERIAL    | -   | 否   | -                | 用户ID，主键 |
| tenantid     | VARCHAR   | 32  | 否   | -                | 租户ID，外键 |
| username     | VARCHAR   | 50  | 否   | -                | 用户名，唯一  |
| realname     | VARCHAR   | 50  | 是   | -                | 真实姓名    |
| passwordhash | VARCHAR   | 256 | 否   | -                | 密码哈希    |
| email        | VARCHAR   | 120 | 是   | NULL             | 邮箱地址    |
| phone        | VARCHAR   | 20  | 否   | -                | 联系电话，唯一 |
| roletype     | VARCHAR   | 50  | 否   | -                | 角色类型    |
| userstatus   | VARCHAR   | 50  | 否   | NORMAL           | 用户状态    |
| createtime   | TIMESTAMP | -   | 是   | CURRENTTIMESTAMP | 创建时间    |
| updatetime   | TIMESTAMP | -   | 是   | CURRENTTIMESTAMP | 更新时间    |


#### 1.1.3 能量变动记录表（balanceChgDetails）


| 字段名           | 类型        | 长度  | 可空  | 默认值              | 说明      |
| ------------- | --------- | --- | --- | ---------------- | ------- |
| recordid      | VARCHAR   | 32  | 否   | -                | 记录ID，主键 |
| tenantid      | VARCHAR   | 32  | 否   | -                | 租户ID    |
| userid        | INT       | 否   | -   | 用户ID             |         |
| changetype    | VARCHAR   | 50  | 否   | -                | 变动类型    |
| consumetype   | VARCHAR   | 50  | 是   | -                | 消费类型    |
| changepoints  | INT       | 否   | -   | 变动点数             |         |
| balancebefore | INT       | 否   | -   | 变动前余额            |         |
| balanceafter  | INT       | 否   | -   | 变动后余额            |         |
| relatedorder  | VARCHAR   | 50  | 是   | -                | 关联订单    |
| remark        | VARCHAR   | 200 | 是   | -                | 备注      |
| createtime    | TIMESTAMP | -   | 是   | CURRENTTIMESTAMP | 创建时间    |
| updatetime    | TIMESTAMP | -   | 是   | CURRENTTIMESTAMP | 更新时间    |


### 1.2 CRM模块表

#### 1.2.1 客户表（customers）


| 字段名        | 类型        | 长度  | 可空  | 默认值              | 说明      |
| ---------- | --------- | --- | --- | ---------------- | ------- |
| custid     | SERIAL    | -   | 否   | -                | 客户ID，主键 |
| tenantid   | VARCHAR   | 32  | 否   | -                | 租户ID    |
| userid     | INT       | 否   | -   | 用户ID             |         |
| name       | VARCHAR   | 100 | 否   | -                | 客户名称    |
| phone      | VARCHAR   | 20  | 否   | -                | 联系电话，唯一 |
| email      | VARCHAR   | 120 | 是   | NULL             | 邮箱地址    |
| source     | VARCHAR   | 50  | 是   | -                | 来源      |
| custstatus | VARCHAR   | 50  | 是   | -                | 客户状态    |
| summary    | TEXT      | -   | 是   | -                | 摘要      |
| region     | VARCHAR   | 50  | 是   | -                | 区域      |
| address    | VARCHAR   | 200 | 是   | -                | 地址      |
| createtime | TIMESTAMP | -   | 是   | CURRENTTIMESTAMP | 创建时间    |
| updatetime | TIMESTAMP | -   | 是   | CURRENTTIMESTAMP | 更新时间    |


### 1.3 产品与订单模块表

> **命名说明**：下列「字段名」与 `InitCfgService/create_tables.sql` 中 **PostgreSQL 物理列名（蛇形）** 一致；Java/JSON 为驼峰映射。

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
| category_id   | INT       | -    | 是   | NULL             | 分类ID（`product_categories.category_id`）    |
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


| 字段名          | 类型        | 长度   | 可空  | 默认值              | 说明                                  |
| ------------ | --------- | ---- | --- | ---------------- | ----------------------------------- |
| orderid      | SERIAL    | -    | 否   | -                | 订单ID，主键                             |
| tenantid     | VARCHAR   | 32   | 否   | -                | 租户ID                                |
| userid       | INT       | -    | 否   | -                | 用户ID                                |
| custid       | INT       | -    | 否   | -                | 客户ID                                |
| accountid    | INT       | -    | 是   | NULL             | 结算账户ID（外键关联biz_accounts.account_id） |
| ordercode    | VARCHAR   | 50   | 否   | -                | 订单编号，唯一                             |
| totalamount  | DECIMAL   | 12,2 | 否   | 0                | 总金额                                 |
| orderstatus  | VARCHAR   | 50   | 否   | -                | 订单状态                                |
| deliverydate | TIMESTAMP | -    | 是   | CURRENTTIMESTAMP | 交付日期                                |
| createtime   | TIMESTAMP | -    | 是   | CURRENTTIMESTAMP | 创建时间                                |
| updatetime   | TIMESTAMP | -    | 是   | CURRENTTIMESTAMP | 更新时间                                |


#### 1.3.8 订单详情表（order_items）


| 字段名          | 类型        | 长度   | 可空  | 默认值              | 说明      |
| ------------ | --------- | ---- | --- | ---------------- | ------- |
| itemid       | SERIAL    | -    | 否   | -                | 明细ID，主键 |
| orderid      | INT       | -    | 否   | -                | 订单ID    |
| productid    | INT       | -    | 否   | -                | 产品ID    |
| quantity     | INT       | -    | 否   | -                | 数量      |
| unitprice    | DECIMAL   | 10,2 | 否   | -                | 单价      |
| totalamount  | DECIMAL   | 12,2 | 否   | -                | 总金额     |
| itemstatus   | VARCHAR   | 50   | 否   | -                | 明细状态    |
| deliverydate | TIMESTAMP | -    | 是   | CURRENTTIMESTAMP | 交付日期    |
| createtime   | TIMESTAMP | -    | 是   | CURRENTTIMESTAMP | 创建时间    |
| updatetime   | TIMESTAMP | -    | 是   | CURRENTTIMESTAMP | 更新时间    |


#### 1.3.9 生产表（production）


| 字段名          | 类型        | 长度  | 可空  | 默认值              | 说明      |
| ------------ | --------- | --- | --- | ---------------- | ------- |
| prodid       | SERIAL    | -   | 否   | -                | 生产ID，主键 |
| tenantid     | VARCHAR   | 32  | 否   | -                | 租户ID    |
| userid       | INT       | -   | 否   | -                | 用户ID    |
| productid    | INT       | -   | 否   | -                | 产品ID    |
| quantity     | INT       | -   | 否   | -                | 生产数量    |
| deliverydate | TIMESTAMP | -   | 是   | CURRENTTIMESTAMP | 交付日期    |
| progress     | INT       | -   | 是   | 0                | 进度      |
| risklevel    | VARCHAR   | 50  | 是   | -                | 风险等级    |
| notes        | TEXT      | -   | 是   | -                | 备注      |
| createtime   | TIMESTAMP | -   | 是   | CURRENTTIMESTAMP | 创建时间    |
| updatetime   | TIMESTAMP | -   | 是   | CURRENTTIMESTAMP | 更新时间    |


### 1.4 供应链模块表

> **命名说明**：下列「字段名」与 `InitCfgService` 中 `create_tables.sql` 的 **PostgreSQL 物理列名（蛇形）** 一致。Java 实体 / JSON 侧为 **驼峰**（如 `purchase_id` → `purchaseId`），由 MyBatis `map-underscore-to-camel-case` 与 Jackson 默认策略映射。

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
| purchase_status | VARCHAR   | 20   | 否   | -                | 进货状态（字典D012）                        |
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
| purchase_status | VARCHAR   | 20   | 否   | -                | 状态（字典D012） |
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
| is_default_receive | BOOLEAN   | -   | 是   | FALSE            | 是否默认收款账户          |
| is_default_pay    | BOOLEAN   | -   | 是   | FALSE            | 是否默认付款账户          |
| status            | SMALLINT  | -   | 否   | 1                | 状态（1有效，0删除）       |
| create_time       | TIMESTAMP | -   | 是   | CURRENT_TIMESTAMP | 创建时间              |
| update_time       | TIMESTAMP | -   | 是   | CURRENT_TIMESTAMP | 更新时间              |


### 1.5 系统表

#### 1.5.1 字典表（dictionary）


| 字段名        | 类型        | 长度  | 可空  | 默认值              | 说明      |
| ---------- | --------- | --- | --- | ---------------- | ------- |
| dictid     | VARCHAR   | 32  | 否   | -                | 字典ID，主键 |
| parentid   | VARCHAR   | 32  | 是   | -                | 父级ID    |
| dictcode   | VARCHAR   | 50  | 否   | -                | 字典编码    |
| dictname   | VARCHAR   | 50  | 否   | -                | 字典名称    |
| dictlevel  | SMALLINT  | -   | 否   | -                | 字典层级    |
| sort       | INT       | -   | 是   | 0                | 排序      |
| remark     | VARCHAR   | 200 | 是   | -                | 备注      |
| status     | SMALLINT  | -   | 否   | 1                | 状态      |
| createtime | TIMESTAMP | -   | 是   | CURRENTTIMESTAMP | 创建时间    |
| updatetime | TIMESTAMP | -   | 是   | CURRENTTIMESTAMP | 更新时间    |


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
| D009   | NULL     | CUSTOMERSTATUS      | 客户状态     | 1         | 9    | 客户全生命周期状态分类                 |
| D010   | NULL     | ORDERSTATUS         | 订单状态     | 1         | 10   | 商贸订单全生命周期状态分类               |
| D011   | NULL     | ITEMSTATUS          | 商品明细状态   | 1         | 11   | 订单内单项单品的核心状态分类              |
| D012   | NULL     | PURCHASEORDERSTATUS | 进货单据状态   | 1         | 12   | 进货单据全生命周期状态枚举，包含草稿、审核、入库等状态 |
| D013   | NULL     | MERCHANT_TYPE       | 商户类型     | 1         | 13   | SaaS 多业态：批发 / 外贸 / 电商 / 工贸；子项 `dict_code` 写入 `tenants.merchant_type` 与 JWT |


##### 1.5.2.2 字典子项详细列表

> **实现说明**：`InitCfgService` 中 `DictionaryInitService` 物理写入的 `dict_code` 为大写下划线风格（如 `SUBSCRIPTION_TYPE`、`MERCHANT_TYPE`）；下表与 **代码初始化保持一致** 时可对照源码。本节大类列历史上存在连写写法，新建字典以 **`DictionaryInitService.java`** 为准。

**D001 - 订阅类型**


| dictid  | parentid | dictcode   | dictname | dictlevel | sort | remark     |
| ------- | -------- | ---------- | -------- | --------- | ---- | ---------- |
| D001001 | D001     | TRIAL      | 试用版      | 2         | 1    | 试用版本，有效期较短 |
| D001002 | D001     | BASIC      | 基础版      | 2         | 2    | 基础功能版本     |
| D001003 | D001     | PREMIUM    | 高级版      | 2         | 3    | 高级功能版本     |
| D001004 | D001     | ENTERPRISE | 企业版      | 2         | 4    | 企业级功能版本    |


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


**D009 - 客户状态**


| dictid  | parentid | dictcode | dictname | dictlevel | sort | remark |
| ------- | -------- | -------- | -------- | --------- | ---- | ------ |
| D009001 | D009     | ACTIVE   | 活跃       | 2         | 1    | 客户状态活跃 |
| D009002 | D009     | SLEEPING | 沉睡       | 2         | 2    | 客户状态沉睡 |
| D009003 | D009     | LOST     | 流失       | 2         | 3    | 客户状态流失 |


**D010 - 订单状态**


| dictid  | parentid | dictcode   | dictname | dictlevel | sort | remark  |
| ------- | -------- | ---------- | -------- | --------- | ---- | ------- |
| D010001 | D010     | PENDING    | 待支付      | 2         | 1    | 订单待支付状态 |
| D010002 | D010     | PROCESSING | 待出货      | 2         | 2    | 订单出货中状态 |
| D010003 | D010     | COMPLETED  | 已完成      | 2         | 3    | 订单已完成状态 |
| D010004 | D010     | CANCELLED  | 已取消      | 2         | 4    | 订单已取消状态 |


**D011 - 商品明细状态**


| dictid  | parentid | dictcode  | dictname | dictlevel | sort | remark  |
| ------- | -------- | --------- | -------- | --------- | ---- | ------- |
| D011001 | D011     | PENDING   | 待发货      | 2         | 1    | 商品待发货状态 |
| D011002 | D011     | SHIPPED   | 已发货      | 2         | 2    | 商品已发货状态 |
| D011003 | D011     | DELIVERED | 已送达      | 2         | 3    | 商品已送达状态 |
| D011004 | D011     | RETURNED  | 已退货      | 2         | 4    | 商品已退货状态 |


**D012 - 进货单据状态**


| dictid  | parentid | dictcode  | dictname | dictlevel | sort | remark    |
| ------- | -------- | --------- | -------- | --------- | ---- | --------- |
| D012001 | D012     | DRAFT     | 草稿       | 2         | 1    | 进货单据草稿状态  |
| D012002 | D012     | SUBMITTED | 已提交      | 2         | 2    | 进货单据已提交状态 |
| D012003 | D012     | APPROVED  | 已审核      | 2         | 3    | 进货单据已审核状态 |
| D012004 | D012     | STOCKED   | 已入库      | 2         | 4    | 进货单据已入库状态 |
| D012005 | D012     | CANCELLED | 已取消      | 2         | 5    | 进货单据已取消状态 |


**D013 - 商户类型（与 `TenantService` / JWT / 网关一致）**


| dictid   | parentid | dictcode       | dictname | dictlevel | sort | remark      |
| -------- | -------- | -------------- | -------- | --------- | ---- | ----------- |
| D013_001 | D013     | WHOLESALE      | 批发       | 2         | 1    | 默认业态      |
| D013_002 | D013     | FOREIGN_TRADE  | 外贸       | 2         | 2    | 外贸业态      |
| D013_003 | D013     | ECOM           | 电商       | 2         | 3    | 电商业态      |
| D013_004 | D013     | FACTORY_TRADE  | 工贸       | 2         | 4    | 工贸业态      |


**片段目录映射（TradeMind-Web）**：`WHOLESALE→wholesale`，`FOREIGN_TRADE→foreign`，`ECOM→ecom`，`FACTORY_TRADE→factory`（见 `/fragments/`）。

#### 1.5.3 AI操作记录表（ai_operation_records）


| 字段名          | 类型        | 长度  | 可空  | 默认值              | 说明      |
| ------------ | --------- | --- | --- | ---------------- | ------- |
| recordid     | SERIAL    | -   | 否   | -                | 记录ID，主键 |
| tenantid     | VARCHAR   | 32  | 否   | -                | 租户ID    |
| userid       | INT       | -   | 否   | -                | 用户ID    |
| requestid    | VARCHAR   | 50  | 否   | -                | 请求ID    |
| optype       | VARCHAR   | 50  | 否   | -                | 操作类型    |
| airesult     | TEXT      | -   | 否   | -                | AI结果    |
| status       | VARCHAR   | 16  | 否   | -                | 状态      |
| inputcontent | TEXT      | -   | 是   | -                | 输入内容    |
| createtime   | TIMESTAMP | -   | 是   | CURRENTTIMESTAMP | 创建时间    |
| updatetime   | TIMESTAMP | -   | 是   | CURRENTTIMESTAMP | 更新时间    |


---

## 2. 微服务架构设计

### 2.1 服务列表

商贸智脑系统由以下多个微服务组成：


| 服务名称    | 服务标识           | 技术栈                       | 主要职责                            |
| ------- | -------------- | ------------------------- | ------------------------------- |
| 租户服务    | TenantService  | Spring Boot 3.x           | 租户管理、用户认证；JWT 含 `merchantType`（来自 `tenants.merchant_type`）；注册受理 `merchantType`（兼容 `industryType`） |
| 初始化配置服务 | InitCfgService | Spring Boot 3.x           | 配置管理、RDS/OSS/AI配置、数据库初始化        |
| 客户关系服务  | CRMService     | Spring Boot 3.x           | 客户信息管理                          |
| 进销存服务   | RDService      | Spring Boot 3.x           | 产品管理、订单管理、生产管理、单位换算、仓库管理、产品分类管理 |
| 供应商服务   | SuppService    | Spring Boot 3.x + MyBatis | 供应商管理、进货单管理                     |
| AI智能服务  | AIService      | Spring Boot 3.x           | AI大模型调用、订单提取、语音处理               |
| 智能报表服务  | IMService      | Spring Boot 3.x           | 营收报表、库存健康、盈利分析、往来账务             |
| API网关   | trademind-gateway | Spring Cloud Gateway    | 服务路由、JWT 校验、注入 `X-User-Id`/`X-Tenant-Id`/`X-User-Role`/`X-Merchant-Type`、CORS、`DedupeResponseHeader` |


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
         │  SuppService    │ │   AIService      │
         │ (供应商/进货)  │ │ (AI处理)        │
         └─────────────────┘ └─────────────────┘
                 │                    │
                 └─────────────────┬─────────────────────────────────────────────┘
                                   │
                           ┌────────┴─────────┐
                           │   IMService      │
                           │   (报表分析)    │
                           └─────────────────┘
```

### 2.3 数据流向说明

1. **认证流程**：前端 → TenantService → 签发 JWT（含 `userId`、`userName`、`tenantId`、`roleType`、`merchantType`）
2. **配置获取**：各服务 → InitCfgService → 获取RDS/OSS/AI配置
3. **业务操作**：前端 → API网关（校验 JWT，注入身份头）→ 对应业务服务 → 数据库；下游可通过 `UserContext.getMerchantType()`（各服务命名略有差异）读取 **`X-Merchant-Type`**
4. **AI处理**：前端 → AIService → 大模型API → 数据库记录
5. **报表查询**：前端 → IMService → 数据库聚合查询

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

#### 2.4.4 模块间路径拉齐策略（兼容优先）

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

- `tenants.merchant_type`：非空，默认 `WHOLESALE`；合法值仅限字典 **D013** 子项 `dict_code`。
- 存量库若未重建表，可执行 `InitCfgService/src/main/resources/alter_tenants_merchant_type.sql` 追加列。

#### 2.7.2 注册与登录（TenantService）

- **注册** `POST /register`：请求体可传 `merchantType`（兼容 `industryType`）；缺省为 `WHOLESALE`；非法编码返回业务错误。
- **登录** `POST /login`：根据用户所属租户读取 `merchant_type` 写入 JWT **`merchantType`** claim；响应体可携带 `merchantType` 便于前端展示。

#### 2.7.3 JWT 与网关

- JWT（HS256）Claims（业务相关）：`userId`、`userName`、`tenantId`、`roleType`、**`merchantType`**（必填；mock-token 联调时为 `WHOLESALE`）。
- 网关 `AuthGlobalFilter`：校验通过后移除 `Authorization`，注入：
  - `X-User-Id`、`X-Tenant-Id`、`X-User-Role`、**`X-Merchant-Type`**
- **AIService** `HeaderInterceptor`：`X-Merchant-Type` 缺失则 **401**（须经网关访问）。
- **CRMService / RDService / SuppService / IMService**：拦截器或上下文对象同步写入 `merchantType`（若请求头存在），供后续策略/License 扩展。

#### 2.7.4 前端（TradeMind-Web）要点

- **注册意图**：`auth.js` 中 `tmResolveMerchantIntent()`，支持 URL 参数 `merchantType`、`industryType`、`industry`、`version`（合法值归一为 D013 `dict_code`），并写入 `sessionStorage`。
- **运行时上下文**：`/assets/js/tm-ui-loader.js` — `TM_UI_CONTEXT.industry`、`TM_UI.applyContextFromToken(token)`、`TM_UI.injectSlots(root)`、`TM_RoleGate.apply(root)`（`data-role`）。
- **行业片段**：`/fragments/{wholesale|foreign|ecom|factory}/{scope}/{slot}.html`；模块 HTML 内预留 `data-tm-fragment-scope` + `data-tm-slot`。
- **样式**：根节点 `data-merchant-type` 与 `theme.css` 中 `--tm-brand-accent-rgb`；详见 `TradeMind-Web/docs/Framework_Guide.md`。

---

## 3. 模块功能列表

### 3.1 前端模块

#### 3.1.0 商户类型与壳层扩展（跨模块）

- **意图入口**：`register.html?merchantType=ECOM` 等；登录页 / 注册页加载 `main-app.js` → `tm-ui-loader.js` → `auth.js`。
- **主壳**：`index-app.html` 在 `ui-components.js` 之后加载 `tm-ui-loader.js`，模块内容由 `ui-main.js` 注入后在 **`view-dashboard` / `view-supply`** 根节点上调用 `injectSlots`。
- **约定**：不在 `modules/` 下按行业拆分物理目录；行业差异 HTML 放在 **`/fragments/`**。

#### 3.1.1 工作台（Dashboard）

- **路径**：`/modules/dashboard/dashboard.html`
- **功能**：
  - 系统概览展示
  - 待办事项提醒
  - 快捷操作入口
  - 数据统计卡片
  - **商户片段插槽**：`data-tm-fragment-scope="dashboard"`、`data-tm-slot="workspace-banner"`（按租户业态加载横幅片段）

#### 3.1.2 客户关系（CRM）

- **路径**：`/modules/crm/crm.html`
- **功能**：
  - 客户信息增删改查
  - 客户分类管理
  - 客户状态跟踪
  - 客户搜索和筛选

#### 3.1.3 产品中心（Product Center）

- **路径**：`/modules/product-center/product-center.html`
- **前端脚本**：`/assets/js/ui-product-center.js`
- **功能**：
  - 产品信息增删改查（真实API对接）
  - 产品分类管理（真实API对接）
  - 仓库管理（真实API对接）
  - 库存管理
  - 单位换算配置
  - 库存预警提醒
  - 产品列表筛选和搜索
  - 桌面端表格和移动端卡片双布局
  - 仓库调拨功能
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
  - `PUT /api/v1/rd/products/stock/batch-update` - 批量更新产品库存

#### 3.1.4 供应链管理（Supply Chain）

- **路径**：`/modules/supply-chain/supply-chain.html`
- **功能**：
  - 供应商管理
  - 进货单管理
  - 进货明细管理
  - 库存入库联动

#### 3.1.5 智能经营（Smart Ops）

- **路径**：`/modules/smart-ops/smart-ops.html`
- **功能**：
  - 订单管理
  - 生产管理
  - AI智能处理
  - 报表分析展示

### 3.2 后端服务模块

#### 3.2.1 租户服务（TenantService）

**主要接口**：


| 接口路径               | 方法   | 说明                |
| ------------------ | ---- | ----------------- |
| `/health`          | GET  | 健康检查              |
| `/info/{tenantId}` | GET  | 获取租户信息            |
| `/create`          | POST | 创建租户              |
| `/register`        | POST | 租户注册（Body 含 `smsToken`、`smsCode`、**`merchantType`**（可选，兼容 `industryType`）；`InitCfgService` 中 `dysms.enabled=true` 时须先 `send-code` 并校验通过） |
| `/login`           | POST | 用户登录（返回 JWT Token，Claims 含 **`merchantType`**；响应体可含 `merchantType`） |
| `/send-code`       | POST | 发送注册短信验证码（阿里云 Dysms SendSms：返回 `smsToken` 票据；未开启时为开发占位） |


#### 3.2.2 初始化配置服务（InitCfgService）

应用启动时可执行字典初始化（含 **D013 商户类型**）；`create_tables.sql` 中 **tenants** 表含 **`merchant_type`** 列。存量库可使用同目录下 **`alter_tenants_merchant_type.sql`** 追加列。

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


**TradeMind-Web CRM交互约束（2026-04-22）**：

1. CRM页面采用「客户列表 + 客户详情」双栏结构，移动端按一级/二级页面切换。
2. 客户列表右侧提供26字母索引（A-Z），点击后滚动到对应首字母客户分组。
3. 客户新增/编辑统一使用同一套弹窗样式与表单结构，保存时调用CRMService真实接口（`POST /customers`、`PUT /customers/{id}`）。
4. 客户删除由前端调用RDService桥接接口（`DELETE /api/v1/rd/customers/{id}`）执行，删除前校验当前租户下是否存在关联订单。
5. 客户详情右侧电话按钮弹出轻量电话卡片；交易时间轴按时间倒序展示订单项摘要（超16字符省略）与订单金额。

#### 3.2.4 进销存服务（RDService）

**主要接口 - 产品管理**：


| 接口路径                                                      | 方法     | 说明           |
| --------------------------------------------------------- | ------ | ------------ |
| `/api/v1/rd/products`                                     | POST   | 创建产品         |
| `/api/v1/rd/products/{id}`                                | GET    | 根据ID获取产品     |
| `/api/v1/rd/products`                                     | GET    | 获取产品列表       |
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
| `/api/v1/rd/orders/latest`            | GET    | 查询最新的10条订单              |
| `/api/v1/rd/orders/{id}/status`       | PUT    | 更新订单状态                  |
| `/api/v1/rd/orders/{id}/items`        | GET    | 查询订单详情                  |
| `/api/v1/rd/orders/customer/{custId}` | GET    | 根据客户ID查询订单              |
| `/api/v1/rd/customers/{id}`           | DELETE | 删除客户（CRM删除桥接接口，含订单关联校验） |


#### 3.2.5 供应商服务（SuppService）

**主要接口 - 供应商管理**：


| 接口路径（兼容）                               | 方法     | 说明        |
| -------------------------------------- | ------ | --------- |
| `/supp/suppliers` 或 `/api/v1/supp/suppliers`           | GET    | 获取供应商列表   |
| `/supp/suppliers/{id}` 或 `/api/v1/supp/suppliers/{id}` | GET    | 根据ID获取供应商 |
| `/supp/suppliers` 或 `/api/v1/supp/suppliers`           | POST   | 创建供应商     |
| `/supp/suppliers/{id}` 或 `/api/v1/supp/suppliers/{id}` | PUT    | 更新供应商     |
| `/supp/suppliers/{id}` 或 `/api/v1/supp/suppliers/{id}` | DELETE | 删除供应商     |


**主要接口 - 进货单管理**：


| 接口路径（兼容）                                              | 方法     | 说明              |
| ----------------------------------------------------- | ------ | --------------- |
| `/supp/purchases` 或 `/api/v1/supp/purchases`                    | GET    | 获取进货单列表（支持状态筛选） |
| `/supp/purchases/{id}` 或 `/api/v1/supp/purchases/{id}`          | GET    | 根据ID获取进货单       |
| `/supp/purchases` 或 `/api/v1/supp/purchases`                    | POST   | 创建进货单（含明细）      |
| `/supp/purchases/{id}` 或 `/api/v1/supp/purchases/{id}`          | PUT    | 更新进货单           |
| `/supp/purchases/{id}` 或 `/api/v1/supp/purchases/{id}`          | DELETE | 删除进货单（含库存回滚）    |
| `/supp/purchases/{id}/status` 或 `/api/v1/supp/purchases/{id}/status` | PATCH  | 更新进货单状态         |
| `/supp/purchases/{id}/items` 或 `/api/v1/supp/purchases/{id}/items`  | GET    | 获取进货单明细         |
| `/supp/purchases/{id}/status` 或 `/api/v1/supp/purchases/{id}/status` | PUT    | 更新进货单状态（含库存联动）  |


#### 3.2.6 AI智能服务（AIService）

**主要接口**：


| 接口路径（网关入口）                  | 方法   | 说明         |
| --------------------------- | ---- | ---------- |
| `/api/v1/ai/process`        | POST | 处理AI请求     |
| `/api/v1/ai/execute`        | POST | 执行AI任务（异步） |
| `/api/v1/ai/status/{requestId}` | GET  | 查询任务状态     |
| `/api/v1/ai/records`        | GET  | 获取待确认单据列表  |


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
   └─ 1:N ──> dictionary (字典表)

users (用户)
   ├─ 1:N ──> customers (客户)
   ├─ 1:N ──> supplier (供应商)
   ├─ 1:N ──> products (产品)
   ├─ 1:N ──> product_categories (产品分类)
   ├─ 1:N ──> orders (订单)
   ├─ 1:N ──> production (生产)
   ├─ 1:N ──> purchases (进货单)
   ├─ 1:N ──> biz_accounts (账户信息)
   └─ 1:N ──> ai_operation_records (AI操作记录)

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

orders (订单)
   ├─ N:1 ──> biz_accounts (结算账户)
   └─ 1:N ──> order_items (订单明细)

purchases (进货单)
   ├─ N:1 ──> biz_accounts (付款账户)
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
6. 网关校验 JWT 后 **移除** `Authorization`，向业务服务注入 **`X-User-Id`、`X-Tenant-Id`、`X-User-Role`、`X-Merchant-Type`**（客户端不应伪造后者；策略逻辑以服务端租户库为准）

### 6.2 AI订单提取流程

1. 用户上传订单图片/语音/输入文本
2. 前端调用AIService`/ai/execute`接口
3. AIService生成requestId，保存记录到数据库（状态：EXTRACTING）
4. AIService异步调用大模型API
5. 大模型返回提取结果，更新数据库状态（SUCCESS/FAILED）
6. 前端轮询`/ai/status/{requestId}`接口获取处理状态
7. 处理成功后，用户确认保存数据

### 6.3 订单创建流程

1. 用户选择客户，添加订单明细
2. 前端调用RDService`/api/v1/rd/orders`接口
3. RDService开启事务
4. 保存orders表记录
5. 批量保存order_items表记录
6. 根据产品ID扣减products表的stock
7. 提交事务，返回结果

### 6.4 进货单创建流程

1. 用户选择供应商，添加进货明细
2. 前端调用SuppService`/supp/purchases`接口
3. SuppService开启事务
4. 保存purchases表记录
5. 批量保存purchase_items表记录
6. 提交事务
7. 进货单状态变更为"已入库"时，增加products表的stock

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

- 响应式设计，支持手机端
- 统一的Header和底部导航
- 移动端优化的弹窗UI
- **`MobileAdapt/TM_Responsive.js`**：`isMobile()` / **`isMobileView()`**；样式分界与 Tailwind `md`（768px）对齐时，自定义 CSS 建议使用 **`max-width: 767px`**

### 7.6 多商户类型（业态）

- 字典 **D013** 为商户类型唯一字典来源；持久化字段 **`tenants.merchant_type`**。
- 运行时身份：**JWT `merchantType`** → 网关 **`X-Merchant-Type`** → 各服务 **`UserContext`**（或等价上下文）。
- 前端按业态加载 **`/fragments/...`**，根节点 **`data-merchant-type`** 驱动主题令牌（见 `theme.css`）。

---

## 8. 文件目录结构

```
TM_Project/
├── TenantService/              # 租户服务
│   └── 结构同其他服务
├── InitCfgService/             # 初始化配置服务
│   └── 结构同其他服务
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
└── TradeMind-Web/              # 前端Web应用
    ├── docs/
    │   └── Framework_Guide.md # 目录职能、fragments、tm-ui-loader、D013 对齐说明
    ├── fragments/             # 按业态目录存放 HTML 片段（wholesale/foreign/ecom/factory）
    │   └── …                  # 例：dashboard/workspace-banner.html
    ├── MobileAdapt/
    │   └── TM_Responsive.js   # 响应式：isMobile / isMobileView
    ├── assets/
    │   └── js/
    │       ├── auth.js        # 认证、tmResolveMerchantIntent、公共 UI
    │       ├── tm-ui-loader.js # TM_UI_CONTEXT、injectSlots、TM_RoleGate（main-app 之后加载）
    │       ├── main-app.js    # TradeMindApp / TM_UI 基础命名空间
    │       ├── ui-main.js     # 主壳模块加载与 injectSlots 钩子
    │       ├── ui-product-center.js  # 产品中心前端逻辑
    │       └── env-config.js # 环境配置
    ├── modules/
    │   ├── dashboard/         # 工作台
    │   │   └── dashboard.html
    │   ├── crm/               # 客户关系管理
    │   │   └── crm.html
    │   ├── product-center/    # 产品中心
    │   │   └── product-center.html
    │   ├── supply-chain/      # 供应链管理
    │   │   └── supply-chain.html
    │   └── smart-ops/         # 智能经营
    │       └── smart-ops.html
```

---

## 9. 安全设计要点

### 9.1 认证与授权

- JWT Token 认证机制；Claims 含 **`merchantType`**（与租户库一致）
- Token 有效期以配置中心 `jwtTtl` 为准（文档示例常为 24 小时）
- 经网关访问时：下游业务服务通过 **`X-Tenant-Id`、`X-User-Id`、`X-User-Role`、`X-Merchant-Type`** 获取用户与租户上下文（由网关注入，勿信任浏览器随意伪造 Header）
- 服务间通过内部Token验证

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

**文档版本**：v1.15
**最后更新**：2026-05-06
**维护者**：TradeMind开发团队