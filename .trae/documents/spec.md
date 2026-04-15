# 商贸智脑（TradeMind）系统概要设计文档

## 概述

### 系统简介

商贸智脑是一个面向中小微企业的智能经营一体化平台，提供客户管理、产品管理、订单管理、供应商管理、生产管理、AI智能处理、报表分析等一站式解决方案。

### 系统架构

采用微服务架构，由多个独立服务组成，通过API网关统一对外提供服务。

***

## 1. 数据库表结构设计

### 1.1 核心业务表

#### 1.1.1 租户表（tenants）

| 字段名                | 类型        | 长度  | 可空 | 默认值                | 说明      |
| ------------------ | --------- | --- | -- | ------------------ | ------- |
| tenant\_id         | VARCHAR   | 32  | 否  | -                  | 租户ID，主键 |
| tenant\_name       | VARCHAR   | 100 | 否  | -                  | 租户名称    |
| phone              | VARCHAR   | 20  | 否  | -                  | 联系电话，唯一 |
| email              | VARCHAR   | 120 | 是  | NULL               | 邮箱地址    |
| tenant\_code       | VARCHAR   | 50  | 是  | -                  | 租户代码    |
| subscription\_type | VARCHAR   | 50  | 否  | -                  | 订阅类型    |
| energy\_balance    | INT       | 否   | 0  | 能量余额               | <br />  |
| sub\_start\_time   | TIMESTAMP | -   | 否  | -                  | 订阅开始时间  |
| sub\_end\_time     | TIMESTAMP | -   | 否  | -                  | 订阅结束时间  |
| tenant\_status     | VARCHAR   | 50  | 否  | NORMAL             | 租户状态    |
| create\_time       | TIMESTAMP | -   | 是  | CURRENT\_TIMESTAMP | 创建时间    |
| update\_time       | TIMESTAMP | -   | 是  | CURRENT\_TIMESTAMP | 更新时间    |

#### 1.1.2 用户表（users）

| 字段名            | 类型        | 长度  | 可空 | 默认值                | 说明      |
| -------------- | --------- | --- | -- | ------------------ | ------- |
| user\_id       | SERIAL    | -   | 否  | -                  | 用户ID，主键 |
| tenant\_id     | VARCHAR   | 32  | 否  | -                  | 租户ID，外键 |
| user\_name     | VARCHAR   | 50  | 否  | -                  | 用户名，唯一  |
| real\_name     | VARCHAR   | 50  | 是  | -                  | 真实姓名    |
| password\_hash | VARCHAR   | 256 | 否  | -                  | 密码哈希    |
| email          | VARCHAR   | 120 | 是  | NULL               | 邮箱      |
| phone          | VARCHAR   | 20  | 否  | -                  | 手机号，唯一  |
| role\_type     | VARCHAR   | 50  | 否  | -                  | 角色类型    |
| user\_status   | VARCHAR   | 50  | 否  | NORMAL             | 用户状态    |
| create\_time   | TIMESTAMP | -   | 是  | CURRENT\_TIMESTAMP | 创建时间    |
| update\_time   | TIMESTAMP | -   | 是  | CURRENT\_TIMESTAMP | 更新时间    |

#### 1.1.3 能量变动记录表（balanceChgDetails）

| 字段名             | 类型        | 长度  | 可空 | 默认值                | 说明      |
| --------------- | --------- | --- | -- | ------------------ | ------- |
| record\_id      | VARCHAR   | 32  | 否  | -                  | 记录ID，主键 |
| tenant\_id      | VARCHAR   | 32  | 否  | -                  | 租户ID    |
| user\_id        | INT       | 否   | -  | 用户ID               | <br />  |
| change\_type    | VARCHAR   | 50  | 否  | -                  | 变动类型    |
| consume\_type   | VARCHAR   | 50  | 是  | -                  | 消费类型    |
| change\_points  | INT       | 否   | -  | 变动点数               | <br />  |
| balance\_before | INT       | 否   | -  | 变动前余额              | <br />  |
| balance\_after  | INT       | 否   | -  | 变动后余额              | <br />  |
| related\_order  | VARCHAR   | 50  | 是  | -                  | 关联订单    |
| remark          | VARCHAR   | 200 | 是  | -                  | 备注      |
| create\_time    | TIMESTAMP | -   | 是  | CURRENT\_TIMESTAMP | 创建时间    |
| update\_time    | TIMESTAMP | -   | 是  | CURRENT\_TIMESTAMP | 更新时间    |

### 1.2 CRM模块表

#### 1.2.1 客户表（customers）

| 字段名          | 类型        | 长度  | 可空 | 默认值                | 说明      |
| ------------ | --------- | --- | -- | ------------------ | ------- |
| cust\_id     | SERIAL    | -   | 否  | -                  | 客户ID，主键 |
| tenant\_id   | VARCHAR   | 32  | 否  | -                  | 租户ID    |
| user\_id     | INT       | 否   | -  | 用户ID               | <br />  |
| name         | VARCHAR   | 100 | 否  | -                  | 客户名称    |
| phone        | VARCHAR   | 20  | 否  | -                  | 电话，唯一   |
| email        | VARCHAR   | 120 | 是  | NULL               | 邮箱      |
| source       | VARCHAR   | 50  | 是  | -                  | 来源      |
| cust\_status | VARCHAR   | 50  | 是  | -                  | 客户状态    |
| summary      | TEXT      | -   | 是  | -                  | 摘要      |
| region       | VARCHAR   | 50  | 是  | -                  | 区域      |
| address      | VARCHAR   | 200 | 是  | -                  | 地址      |
| create\_time | TIMESTAMP | -   | 是  | CURRENT\_TIMESTAMP | 创建时间    |
| update\_time | TIMESTAMP | -   | 是  | CURRENT\_TIMESTAMP | 更新时间    |

### 1.3 产品与订单模块表

#### 1.3.1 供应商表（supplier）

| 字段名            | 类型        | 长度  | 可空 | 默认值                | 说明       |
| -------------- | --------- | --- | -- | ------------------ | -------- |
| supplier\_id   | SERIAL    | -   | 否  | -                  | 供应商ID，主键 |
| tenant\_id     | VARCHAR   | 32  | 否  | -                  | 租户ID     |
| user\_id       | INT       | 否   | -  | 用户ID               | <br />   |
| name           | VARCHAR   | 100 | 否  | -                  | 供应商名称    |
| contact        | VARCHAR   | 50  | 是  | -                  | 联系人      |
| phone          | VARCHAR   | 20  | 是  | -                  | 电话       |
| address        | VARCHAR   | 200 | 是  | -                  | 地址       |
| rating         | DECIMAL   | 2,1 | 是  | 0                  | 评分       |
| delivery\_rate | DECIMAL   | 5,2 | 是  | 0                  | 交付率      |
| status         | SMALLINT  | -   | 否  | 1                  | 状态       |
| create\_time   | TIMESTAMP | -   | 是  | CURRENT\_TIMESTAMP | 创建时间     |
| update\_time   | TIMESTAMP | -   | 是  | CURRENT\_TIMESTAMP | 更新时间     |

#### 1.3.2 产品表（products）

| 字段名            | 类型        | 长度   | 可空   | 默认值                | 说明      |
| -------------- | --------- | ---- | ---- | ------------------ | ------- |
| product\_id    | SERIAL    | -    | 否    | -                  | 产品ID，主键 |
| tenant\_id     | VARCHAR   | 32   | 否    | -                  | 租户ID    |
| user\_id       | INT       | 否    | -    | 用户ID               | <br />  |
| supplier\_id   | INT       | 是    | NULL | 供应商ID              | <br />  |
| name           | VARCHAR   | 100  | 否    | -                  | 产品名称    |
| category       | VARCHAR   | 50   | 是    | -                  | 分类      |
| description    | TEXT      | -    | 是    | -                  | 描述      |
| sku            | VARCHAR   | 50   | 否    | -                  | SKU编码   |
| price          | DECIMAL   | 10,2 | 否    | 0                  | 价格      |
| stock          | INT       | 否    | 0    | 库存                 | <br />  |
| warning\_stock | INT       | 是    | 0    | 预警库存               | <br />  |
| sales\_volume  | INT       | 是    | 0    | 销量                 | <br />  |
| region         | VARCHAR   | 50   | 是    | -                  | 区域      |
| base\_unit     | VARCHAR   | 20   | 是    | -                  | 基础单位    |
| sales\_unit    | VARCHAR   | 20   | 是    | -                  | 销售单位    |
| purchase\_unit | VARCHAR   | 20   | 是    | -                  | 采购单位    |
| create\_time   | TIMESTAMP | -    | 是    | CURRENT\_TIMESTAMP | 创建时间    |
| update\_time   | TIMESTAMP | -    | 是    | CURRENT\_TIMESTAMP | 更新时间    |

#### 1.3.3 单位换算表（unitConversion）

| 字段名            | 类型        | 长度   | 可空 | 默认值                | 说明      |
| -------------- | --------- | ---- | -- | ------------------ | ------- |
| conversion\_id | SERIAL    | -    | 否  | -                  | 换算ID，主键 |
| tenant\_id     | VARCHAR   | 32   | 否  | -                  | 租户ID    |
| product\_id    | INT       | 否    | -  | 产品ID               | <br />  |
| unit\_name     | VARCHAR   | 20   | 否  | -                  | 单位名称    |
| ratio          | DECIMAL   | 10,2 | 否  | -                  | 换算比率    |
| is\_default    | BOOLEAN   | -    | 是  | FALSE              | 是否默认    |
| create\_time   | TIMESTAMP | -    | 是  | CURRENT\_TIMESTAMP | 创建时间    |
| update\_time   | TIMESTAMP | -    | 是  | CURRENT\_TIMESTAMP | 更新时间    |

#### 1.3.4 订单表（orders）

| 字段名            | 类型        | 长度   | 可空 | 默认值                | 说明      |
| -------------- | --------- | ---- | -- | ------------------ | ------- |
| order\_id      | SERIAL    | -    | 否  | -                  | 订单ID，主键 |
| tenant\_id     | VARCHAR   | 32   | 否  | -                  | 租户ID    |
| user\_id       | INT       | 否    | -  | 用户ID               | <br />  |
| cust\_id       | INT       | 否    | 否  | -                  | 客户ID    |
| order\_code    | VARCHAR   | 50   | 否  | -                  | 订单编号，唯一 |
| total\_amount  | DECIMAL   | 12,2 | 否  | 0                  | 总金额     |
| order\_status  | VARCHAR   | 50   | 否  | -                  | 订单状态    |
| delivery\_date | TIMESTAMP | -    | 是  | CURRENT\_TIMESTAMP | 交付日期    |
| create\_time   | TIMESTAMP | -    | 是  | CURRENT\_TIMESTAMP | 创建时间    |
| update\_time   | TIMESTAMP | -    | 是  | CURRENT\_TIMESTAMP | 更新时间    |

#### 1.3.5 订单详情表（order\_items）

| 字段名            | 类型        | 长度   | 可空 | 默认值                | 说明      |
| -------------- | --------- | ---- | -- | ------------------ | ------- |
| item\_id       | SERIAL    | -    | 否  | -                  | 明细ID，主键 |
| order\_id      | INT       | 否    | -  | 订单ID               | <br />  |
| product\_id    | INT       | 否    | -  | 产品ID               | <br />  |
| quantity       | INT       | 否    | -  | 数量                 | <br />  |
| total\_amount  | DECIMAL   | 12,2 | 否  | -                  | 总金额     |
| item\_status   | VARCHAR   | 50   | 否  | -                  | 明细状态    |
| delivery\_date | TIMESTAMP | -    | 是  | CURRENT\_TIMESTAMP | 交付日期    |
| create\_time   | TIMESTAMP | -    | 是  | CURRENT\_TIMESTAMP | 创建时间    |
| update\_time   | TIMESTAMP | -    | 是  | CURRENT\_TIMESTAMP | 更新时间    |

#### 1.3.6 生产表（production）

| 字段名            | 类型        | 长度 | 可空 | 默认值                | 说明      |
| -------------- | --------- | -- | -- | ------------------ | ------- |
| prod\_id       | SERIAL    | -  | 否  | -                  | 生产ID，主键 |
| tenant\_id     | VARCHAR   | 32 | 否  | -                  | 租户ID    |
| user\_id       | INT       | 否  | -  | 用户ID               | <br />  |
| product\_id    | INT       | 否  | -  | 产品ID               | <br />  |
| quantity       | INT       | 否  | -  | 生产数量               | <br />  |
| delivery\_time | TIMESTAMP | -  | 是  | CURRENT\_TIMESTAMP | 交付时间    |
| progress       | INT       | 是  | 0  | 进度                 | <br />  |
| risk\_level    | VARCHAR   | 50 | 是  | -                  | 风险等级    |
| notes          | TEXT      | -  | 是  | -                  | 备注      |
| create\_time   | TIMESTAMP | -  | 是  | CURRENT\_TIMESTAMP | 创建时间    |
| update\_time   | TIMESTAMP | -  | 是  | CURRENT\_TIMESTAMP | 更新时间    |

### 1.4 供应链模块表

#### 1.4.1 进货单主表（purchases）

| 字段名              | 类型        | 长度   | 可空 | 默认值                | 说明       |
| ---------------- | --------- | ---- | -- | ------------------ | -------- |
| purchase\_id     | SERIAL    | -    | 否  | -                  | 进货单ID，主键 |
| tenant\_id       | VARCHAR   | 32   | 否  | -                  | 租户ID     |
| user\_id         | INT       | 否    | -  | 用户ID               | <br />   |
| purchase\_code   | VARCHAR   | 50   | 是  | -                  | 进货单号     |
| supplier\_id     | INT       | 否    | -  | 供应商ID              | <br />   |
| total\_amount    | DECIMAL   | 12,2 | 否  | -                  | 总金额      |
| paid\_amount     | DECIMAL   | 12,2 | 否  | -                  | 已付金额     |
| purchase\_status | VARCHAR   | 20   | 否  | -                  | 进货状态（字典D012） |
| purchase\_date   | TIMESTAMP | -    | 否  | -                  | 进货日期     |
| create\_time     | TIMESTAMP | -    | 是  | CURRENT\_TIMESTAMP | 创建时间     |
| update\_time     | TIMESTAMP | -    | 是  | CURRENT\_TIMESTAMP | 更新时间     |

#### 1.4.2 进货明细表（purchase\_items）

| 字段名              | 类型        | 长度   | 可空 | 默认值                | 说明      |
| ---------------- | --------- | ---- | -- | ------------------ | ------- |
| p\_item\_id      | SERIAL    | -    | 否  | -                  | 明细ID，主键 |
| purchase\_id     | INT       | 否    | -  | 进货单ID              | <br />  |
| product\_id      | INT       | 否    | -  | 产品ID               | <br />  |
| quantity         | INT       | 是    | 0  | 数量                 | <br />  |
| unit\_price      | DECIMAL   | 10,2 | 否  | -                  | 单价      |
| unit\_name       | VARCHAR   | 20   | 是  | -                  | 单位名称    |
| batch\_no        | VARCHAR   | 50   | 是  | -                  | 批次号     |
| purchase\_status | VARCHAR   | 20   | 否  | -                  | 状态（字典D012） |
| purchase\_date   | TIMESTAMP | -    | 否  | -                  | 日期      |
| create\_time     | TIMESTAMP | -    | 是  | CURRENT\_TIMESTAMP | 创建时间    |
| update\_time     | TIMESTAMP | -    | 是  | CURRENT\_TIMESTAMP | 更新时间    |

### 1.5 系统表

#### 1.5.1 字典表（dictionary）

| 字段名          | 类型        | 长度  | 可空 | 默认值                | 说明      |
| ------------ | --------- | --- | -- | ------------------ | ------- |
| dict\_id     | VARCHAR   | 32  | 否  | -                  | 字典ID，主键 |
| parent\_id   | VARCHAR   | 32  | 是  | -                  | 父级ID    |
| dict\_code   | VARCHAR   | 50  | 否  | -                  | 字典编码    |
| dict\_name   | VARCHAR   | 50  | 否  | -                  | 字典名称    |
| dict\_level  | SMALLINT  | -   | 否  | -                  | 字典层级    |
| sort         | INT       | 是   | 0  | 排序                 | <br />  |
| remark       | VARCHAR   | 200 | 是  | -                  | 备注      |
| status       | SMALLINT  | -   | 否  | 1                  | 状态      |
| create\_time | TIMESTAMP | -   | 是  | CURRENT\_TIMESTAMP | 创建时间    |
| update\_time | TIMESTAMP | -   | 是  | CURRENT\_TIMESTAMP | 更新时间    |

#### 1.5.2 字典初始化内容

##### 1.5.2.1 字典大类列表

| dict_id | parent_id | dict_code | dict_name | dict_level | sort | remark |
|---------|-----------|------------|-----------|------------|------|--------|
| D001 | NULL | D001 | 订阅类型 | 1 | 1 | 商户订阅类型 |
| D002 | NULL | D002 | 租户状态 | 1 | 2 | 商户租户状态 |
| D003 | NULL | D003 | 角色类型 | 1 | 3 | 用户角色类型 |
| D004 | NULL | D004 | 用户状态 | 1 | 4 | 用户账号状态 |
| D005 | NULL | D005 | 变动类型 | 1 | 5 | 能量点变动类型 |
| D006 | NULL | D006 | 消费类型 | 1 | 6 | 能量点消费类型 |
| D007 | NULL | D007 | 风险等级 | 1 | 7 | 生产风险等级 |
| D008 | NULL | D008 | 客户来源 | 1 | 8 | 客户获取来源 |
| D009 | NULL | D009 | 客户状态 | 1 | 9 | 客户活跃状态 |
| D010 | NULL | D010 | 订单状态 | 1 | 10 | 订单处理状态 |
| D011 | NULL | D011 | 商品状态 | 1 | 11 | 订单商品状态 |
| D012 | NULL | PURCHASE_ORDER_STATUS | 进货单据状态 | 1 | 12 | 进货单据全生命周期状态枚举，包含草稿、审核、入库等状态 |

##### 1.5.2.2 字典子项详细列表

**D001 - 订阅类型**

| dict_id | parent_id | dict_code | dict_name | dict_level | sort | remark |
|---------|-----------|------------|-----------|------------|------|--------|
| D001_001 | D001 | TRIAL | 试用版 | 2 | 1 | 试用版本，有效期较短 |
| D001_002 | D001 | BASIC | 基础版 | 2 | 2 | 基础功能版本 |
| D001_003 | D001 | PREMIUM | 高级版 | 2 | 3 | 高级功能版本 |
| D001_004 | D001 | ENTERPRISE | 企业版 | 2 | 4 | 企业级功能版本 |

**D002 - 租户状态**

| dict_id | parent_id | dict_code | dict_name | dict_level | sort | remark |
|---------|-----------|------------|-----------|------------|------|--------|
| D002_001 | D002 | NORMAL | 正常 | 2 | 1 | 租户状态正常 |
| D002_002 | D002 | EXPIRED | 过期 | 2 | 2 | 租户订阅已过期 |
| D002_003 | D002 | SUSPENDED | 暂停 | 2 | 3 | 租户账号已暂停 |
| D002_004 | D002 | TERMINATED | 终止 | 2 | 4 | 租户账号已终止 |

**D003 - 角色类型**

| dict_id | parent_id | dict_code | dict_name | dict_level | sort | remark |
|---------|-----------|------------|-----------|------------|------|--------|
| D003_001 | D003 | ADMIN | 管理员 | 2 | 1 | 系统管理员角色 |
| D003_002 | D003 | USER | 普通用户 | 2 | 2 | 普通用户角色 |
| D003_003 | D003 | OPERATOR | 操作员 | 2 | 3 | 系统操作员角色 |

**D004 - 用户状态**

| dict_id | parent_id | dict_code | dict_name | dict_level | sort | remark |
|---------|-----------|------------|-----------|------------|------|--------|
| D004_001 | D004 | NORMAL | 正常 | 2 | 1 | 用户状态正常 |
| D004_002 | D004 | LOCKED | 锁定 | 2 | 2 | 用户账号已锁定 |
| D004_003 | D004 | DISABLED | 禁用 | 2 | 3 | 用户账号已禁用 |

**D005 - 变动类型**

| dict_id | parent_id | dict_code | dict_name | dict_level | sort | remark |
|---------|-----------|------------|-----------|------------|------|--------|
| D005_001 | D005 | RECHARGE | 充值 | 2 | 1 | 能量点充值 |
| D005_002 | D005 | CONSUMPTION | 消费 | 2 | 2 | 能量点消费 |
| D005_003 | D005 | GIFT | 赠送 | 2 | 3 | 能量点赠送 |
| D005_004 | D005 | REFUND | 退款 | 2 | 4 | 能量点退款 |

**D006 - 消费类型**

| dict_id | parent_id | dict_code | dict_name | dict_level | sort | remark |
|---------|-----------|------------|-----------|------------|------|--------|
| D006_001 | D006 | AI_EXTRACTION | AI提取 | 2 | 1 | AI信息提取消费 |
| D006_002 | D006 | AI_ANALYSIS | AI分析 | 2 | 2 | AI数据分析消费 |
| D006_003 | D006 | AI_PREDICTION | AI预测 | 2 | 3 | AI预测分析消费 |
| D006_004 | D006 | AI_RECOMMENDATION | AI推荐 | 2 | 4 | AI推荐服务消费 |

**D007 - 风险等级**

| dict_id | parent_id | dict_code | dict_name | dict_level | sort | remark |
|---------|-----------|------------|-----------|------------|------|--------|
| D007_001 | D007 | LOW | 低 | 2 | 1 | 低风险等级 |
| D007_002 | D007 | MEDIUM | 中 | 2 | 2 | 中等风险等级 |
| D007_003 | D007 | HIGH | 高 | 2 | 3 | 高风险等级 |

**D008 - 客户来源**

| dict_id | parent_id | dict_code | dict_name | dict_level | sort | remark |
|---------|-----------|------------|-----------|------------|------|--------|
| D008_001 | D008 | WECHAT | 微信 | 2 | 1 | 微信渠道获取 |
| D008_002 | D008 | ALIPAY | 支付宝 | 2 | 2 | 支付宝渠道获取 |
| D008_003 | D008 | PHONE | 电话 | 2 | 3 | 电话渠道获取 |
| D008_004 | D008 | OTHER | 其他 | 2 | 4 | 其他渠道获取 |

**D009 - 客户状态**

| dict_id | parent_id | dict_code | dict_name | dict_level | sort | remark |
|---------|-----------|------------|-----------|------------|------|--------|
| D009_001 | D009 | ACTIVE | 活跃 | 2 | 1 | 客户状态活跃 |
| D009_002 | D009 | SLEEPING | 沉睡 | 2 | 2 | 客户状态沉睡 |
| D009_003 | D009 | LOST | 流失 | 2 | 3 | 客户状态流失 |

**D010 - 订单状态**

| dict_id | parent_id | dict_code | dict_name | dict_level | sort | remark |
|---------|-----------|------------|-----------|------------|------|--------|
| D010_001 | D010 | PENDING | 待支付 | 2 | 1 | 订单待支付状态 |
| D010_002 | D010 | PROCESSING | 处理中 | 2 | 2 | 订单处理中状态 |
| D010_003 | D010 | COMPLETED | 已完成 | 2 | 3 | 订单已完成状态 |
| D010_004 | D010 | CANCELLED | 已取消 | 2 | 4 | 订单已取消状态 |

**D011 - 商品状态**

| dict_id | parent_id | dict_code | dict_name | dict_level | sort | remark |
|---------|-----------|------------|-----------|------------|------|--------|
| D011_001 | D011 | PENDING | 待发货 | 2 | 1 | 商品待发货状态 |
| D011_002 | D011 | SHIPPED | 已发货 | 2 | 2 | 商品已发货状态 |
| D011_003 | D011 | DELIVERED | 已送达 | 2 | 3 | 商品已送达状态 |
| D011_004 | D011 | RETURNED | 已退货 | 2 | 4 | 商品已退货状态 |

#### 1.5.3 AI操作记录表（ai\_operation\_records）

| 字段名            | 类型        | 长度 | 可空 | 默认值                | 说明      |
| -------------- | --------- | -- | -- | ------------------ | ------- |
| record\_id     | SERIAL    | -  | 否  | -                  | 记录ID，主键 |
| tenant\_id     | VARCHAR   | 32 | 否  | -                  | 租户ID    |
| user\_id       | INT       | 否  | -  | 用户ID               | <br />  |
| request\_id    | VARCHAR   | 50 | 否  | -                  | 请求ID    |
| op\_type       | VARCHAR   | 50 | 否  | -                  | 操作类型    |
| ai\_result     | TEXT      | -  | 否  | -                  | AI结果    |
| status         | VARCHAR   | 16 | 否  | -                  | 状态      |
| input\_content | TEXT      | -  | 是  | -                  | 输入内容    |
| create\_time   | TIMESTAMP | -  | 是  | CURRENT\_TIMESTAMP | 创建时间    |
| update\_time   | TIMESTAMP | -  | 是  | CURRENT\_TIMESTAMP | 更新时间    |

***

## 2. 微服务架构设计

### 2.1 服务列表

商贸智脑系统由以下8个微服务组成：

| 服务名称    | 服务标识           | 技术栈                       | 主要职责                     |
| ------- | -------------- | ------------------------- | ------------------------ |
| 租户服务    | TenantService  | Spring Boot 3.x           | 租户管理、用户认证、JWT生成          |
| 初始化配置服务 | InitCfgService | Spring Boot 3.x           | 配置管理、RDS/OSS/AI配置、数据库初始化 |
| 客户关系服务  | CRMService     | Spring Boot 3.x           | 客户信息管理                   |
| 进销存服务   | RDService      | Spring Boot 3.x           | 产品管理、订单管理、生产管理、单位换算      |
| 供应商服务   | SuppService    | Spring Boot 3.x + MyBatis | 供应商管理、进货单管理              |
| AI智能服务  | AIService      | Spring Boot 3.x           | AI大模型调用、订单提取、语音处理        |
| 智能报表服务  | IMService      | Spring Boot 3.x           | 营收报表、库存健康、盈利分析、往来账务      |
| API网关   | Gateway        | 待补充                       | 服务路由、统一认证、CORS处理         |

### 2.2 服务间交互关系

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              前端 (TradeMind-Web)                       │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              API Gateway                                  │
└────────────┬────────────────────────────────┬────────────────────────────┘
             │                                │
    ┌────────┴────────┐              ┌────────┴────────┐
    │  TenantService  │              │  InitCfgService │
    │  (认证/租户)    │              │  (配置管理)     │
    └─────────────────┘              └─────────────────┘
             │                                │
    ┌────────┴────────┐              ┌────────┴────────┐
    │   CRMService    │              │   RDService     │
    │   (客户管理)    │              │ (产品/订单/生产)│
    └─────────────────┘              └─────────────────┘
             │                                │
    ┌────────┴────────┐              ┌────────┴────────┐
    │  SuppService    │              │   AIService     │
    │  (供应商/进货)  │              │   (AI处理)      │
    └─────────────────┘              └─────────────────┘
             │                                │
             └────────────┬───────────────────┘
                          │
                  ┌───────┴────────┐
                  │   IMService     │
                  │   (报表分析)     │
                  └─────────────────┘
```

### 2.3 数据流向说明

1. **认证流程**：前端 → TenantService → JWT认证
2. **配置获取**：各服务 → InitCfgService → 获取RDS/OSS/AI配置
3. **业务操作**：前端 → API Gateway → 对应业务服务 → 数据库
4. **AI处理**：前端 → AIService → 大模型API → 数据库记录
5. **报表查询**：前端 → IMService → 数据库聚合查询

***

## 3. 模块功能列表

### 3.1 前端模块

#### 3.1.1 工作台（Dashboard）

- **路径**：`/modules/dashboard/dashboard.html`
- **功能**：
  - 系统概览展示
  - 待办事项提醒
  - 快捷操作入口
  - 数据统计卡片

#### 3.1.2 客户CRM（CRM）

- **路径**：`/modules/crm/crm.html`
- **功能**：
  - 客户信息增删改查
  - 客户分类管理
  - 客户状态跟踪
  - 客户搜索和筛选

#### 3.1.3 产品中心（Product Center）

- **路径**：`/modules-ui/product-center/product-center.html`
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
- **技术实现**：
  - 使用 `window.wrappedFetch()` 进行API请求
  - 使用 `window.handleApiResponse()` 统一响应处理
  - 自动JWT认证和租户隔离
  - 完整错误处理和用户反馈
- **后端接口**：
  - `GET /api/v1/rd/products` - 获取产品列表
  - `POST /api/v1/rd/products/save` - 保存产品（含单位换算）
  - `DELETE /api/v1/rd/products/{id}` - 删除产品
  - `GET /api/v1/rd/products/categories` - 获取分类列表
  - `POST /api/v1/rd/products/categories/save` - 保存分类
  - `GET /api/v1/rd/products/warehouses` - 获取仓库列表
  - `POST /api/v1/rd/products/warehouses/save` - 保存仓库

#### 3.1.4 供应链（Supply Chain）

- **路径**：`/modules/supply-chain/supply-chain.html`
- **功能**：
  - 供应商管理
  - 进货单管理
  - 进货明细管理
  - 库存入库联动

#### 3.1.5 智能经营（SmartOps）

- **路径**：`/modules/SmartOps/SmartOps.html`
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
| `/register`        | POST | 租户注册              |
| `/login`           | POST | 用户登录（返回JWT Token） |
| `/send-code`       | POST | 发送验证码             |

#### 3.2.2 初始化配置服务（InitCfgService）

**主要接口**：

| 接口路径               | 方法  | 说明            |
| ------------------ | --- | ------------- |
| `/config/rds`      | GET | 获取RDS配置       |
| `/config/oss`      | GET | 获取OSS配置       |
| `/config/ai`       | GET | 获取AI大模型配置     |
| `/config/gateway`  | GET | 获取Web网关配置     |
| `/config/all`      | GET | 获取所有配置        |
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
| `/api/v1/rd/products/delete/{productId}`                  | DELETE | 删除产品（旧接口）    |
| `/api/v1/rd/products/{id}`                                | DELETE | 删除产品（新接口）    |
| `/api/v1/rd/products/low-stock/{tenantId}`                | GET    | 获取库存不足产品列表   |
| `/api/v1/rd/products/top-selling/{tenantId}/{limit}`      | GET    | 获取销量排名产品列表   |
| `/api/v1/rd/products/{id}/units`                          | GET    | 获取产品的单位换算列表  |
| `/api/v1/rd/products/save`                                | POST   | 保存产品及其单位换算信息 |
| `/api/v1/rd/products/restock/suggestions`                 | GET    | 获取进货建议列表     |
| `/api/v1/rd/products/stock/batch-update`                  | PUT    | 批量更新产品库存     |

**主要接口 - 订单管理**：

| 接口路径                                  | 方法   | 说明             |
| ------------------------------------- | ---- | -------------- |
| `/api/v1/rd/orders`                   | POST | 创建订单           |
| `/api/v1/rd/orders/confirm`           | POST | 确认订单（用于AI提取数据） |
| `/api/v1/rd/orders/{orderId}`         | GET  | 根据订单ID查询订单     |
| `/api/v1/rd/orders/code/{orderCode}`  | GET  | 根据订单编号查询订单     |
| `/api/v1/rd/orders`                   | GET  | 根据租户ID查询订单列表   |
| `/api/v1/rd/orders/latest`            | GET  | 查询最新的10条订单     |
| `/api/v1/rd/orders/{orderId}/status`  | PUT  | 更新订单状态         |
| `/api/v1/rd/orders/{orderId}/items`   | GET  | 查询订单详情         |
| `/api/v1/rd/orders/customer/{custId}` | GET  | 根据客户ID查询订单     |

#### 3.2.5 供应商服务（SuppService）

**主要接口 - 供应商管理**：

| 接口路径                   | 方法     | 说明        |
| ---------------------- | ------ | --------- |
| `/supp/suppliers`      | GET    | 获取供应商列表   |
| `/supp/suppliers/{id}` | GET    | 根据ID获取供应商 |
| `/supp/suppliers`      | POST   | 创建供应商     |
| `/supp/suppliers/{id}` | PUT    | 更新供应商     |
| `/supp/suppliers/{id}` | DELETE | 删除供应商     |

**主要接口 - 进货单管理**：

| 接口路径                          | 方法     | 说明              |
| ----------------------------- | ------ | --------------- |
| `/supp/purchases`             | GET    | 获取进货单列表（支持状态筛选） |
| `/supp/purchases/{id}`        | GET    | 根据ID获取进货单       |
| `/supp/purchases`             | POST   | 创建进货单（含明细）      |
| `/supp/purchases/{id}`        | PUT    | 更新进货单           |
| `/supp/purchases/{id}`        | DELETE | 删除进货单（含库存回滚）    |
| `/supp/purchases/{id}/status` | PATCH  | 更新进货单状态         |
| `/supp/purchases/{id}/items`  | GET    | 获取进货单明细         |
| `/supp/purchases/{id}/status` | PUT    | 更新进货单状态（含库存联动）  |

#### 3.2.6 AI智能服务（AIService）

**主要接口**：

| 接口路径                     | 方法   | 说明         |
| ------------------------ | ---- | ---------- |
| `/ai/process`            | POST | 处理AI请求     |
| `/ai/execute`            | POST | 执行AI任务（异步） |
| `/ai/status/{requestId}` | GET  | 查询任务状态     |
| `/ai/records`            | GET  | 获取待确认单据列表  |

#### 3.2.7 智能报表服务（IMService）

**主要接口**：

| 接口路径                                 | 方法  | 说明     |
| ------------------------------------ | --- | ------ |
| `/api/v1/im/report/revenue`          | GET | 营收报表   |
| `/api/v1/im/report/inventory-health` | GET | 库存健康报表 |
| `/api/v1/im/report/profit`           | GET | 销售盈利表  |
| `/api/v1/im/report/accounts`         | GET | 往来账务表  |
| `/api/v1/im/report/efficiency`       | GET | 核心效率监控 |

***

## 4. 数据库ER图（文字描述）

### 4.1 核心实体关系

```
tenants (租户)
  ├── 1:N → users (用户)
  ├── 1:N → balanceChgDetails (能量变动记录)
  ├── 1:N → customers (客户)
  ├── 1:N → supplier (供应商)
  ├── 1:N → products (产品)
  ├── 1:N → orders (订单)
  ├── 1:N → production (生产)
  ├── 1:N → purchases (进货单)
  ├── 1:N → ai_operation_records (AI操作记录)
  └── 1:N → "unitConversion" (单位换算)

users (用户)
  ├── 1:N → customers (客户)
  ├── 1:N → supplier (供应商)
  ├── 1:N → products (产品)
  ├── 1:N → orders (订单)
  ├── 1:N → production (生产)
  ├── 1:N → purchases (进货单)
  └── 1:N → ai_operation_records (AI操作记录)

customers (客户)
  └── 1:N → orders (订单)

supplier (供应商)
  ├── 1:N → products (产品)
  └── 1:N → purchases (进货单)

products (产品)
  ├── 1:N → order_items (订单明细)
  ├── 1:N → production (生产)
  ├── 1:N → "unitConversion" (单位换算)
  └── 1:N → purchase_items (进货明细)

orders (订单)
  └── 1:N → order_items (订单明细)

purchases (进货单)
  └── 1:N → purchase_items (进货明细)

dictionary (字典表)
  └── 1:N → dictionary (子级字典)
```

### 4.2 外键关系说明

- **tenants** 是所有业务表的父表，通过 `tenant_id` 实现多租户隔离
- **users** 与 **tenants** 多对一关系
- 所有业务表都通过 `tenant_id` 关联到租户
- 所有业务表都通过 `user_id` 关联到创建用户

***

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

***

## 6. 关键业务流程说明

### 6.1 用户认证流程

1. 用户输入用户名密码
2. 前端调用 TenantService `/login` 接口
3. TenantService 验证用户信息
4. 生成JWT Token（24小时有效期）
5. 前端保存Token，后续请求在Header中携带 `X-Tenant-Id` 和 Token

### 6.2 AI订单提取流程

1. 用户上传订单图片/语音/输入文本
2. 前端调用 AIService `/ai/execute` 接口
3. AIService 生成 requestId，保存记录到数据库（状态：EXTRACTING）
4. AIService 异步调用大模型API
5. 大模型返回提取结果，更新数据库状态（SUCCESS/FAILED）
6. 前端轮询 `/ai/status/{requestId}` 接口获取处理状态
7. 处理成功后，用户确认保存数据

### 6.3 订单创建流程

1. 用户选择客户，添加订单明细
2. 前端调用 RDService `/api/v1/rd/orders` 接口
3. RDService 开启事务
4. 保存 orders 表记录
5. 批量保存 order\_items 表记录
6. 根据产品ID扣减 products 表的 stock
7. 提交事务，返回结果

### 6.4 进货单创建流程

1. 用户选择供应商，添加进货明细
2. 前端调用 SuppService `/supp/purchases` 接口
3. SuppService 开启事务
4. 保存 purchases 表记录
5. 批量保存 purchase\_items 表记录
6. 提交事务
7. 进货单状态变更为"已入库"时，增加 products 表的 stock

***

## 7. 系统特性总结

### 7.1 多租户架构

- 所有业务表都包含 `tenant_id` 字段
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

***

## 8. 文件目录结构

```
TM_Project/
├── AIService/                    # AI智能服务
│   ├── src/main/java/
│   │   └── com/trademind/aiservice/
│   │       ├── controller/      # 控制器
│   │       ├── service/         # 业务逻辑
│   │       ├── model/           # 数据模型
│   │       ├── repository/      # 数据访问
│   │       ├── dto/             # 数据传输对象
│   │       ├── config/          # 配置类
│   │       └── context/         # 用户上下文
│   └── src/main/resources/
│       └── application.yml      # 应用配置
├── CRMService/                   # 客户关系服务
│   └── 结构同AIService
├── IMService/                    # 智能报表服务
│   └── 结构同AIService
├── InitCfgService/               # 初始化配置服务
│   ├── src/main/java/
│   │   └── com/trademind/InitCfgService/
│   │       ├── controller/
│   │       ├── service/
│   │       └── model/
│   └── src/main/resources/
│       └── create_tables.sql     # 数据库初始化脚本
├── RDService/                    # 进销存服务
│   └── 结构同AIService
├── SuppService/                  # 供应商服务（使用MyBatis）
│   ├── src/main/java/
│   │   └── com/trademind/SuppService/
│   │       ├── controller/
│   │       ├── service/
│   │       ├── entity/
│   │       ├── mapper/
│   │       └── dto/
│   └── src/main/resources/
│       └── mapper/               # MyBatis XML映射文件
├── TenantService/                # 租户服务
│   └── 结构同AIService
└── TradeMind-Web/                # 前端Web应用
    ├── assets/
    │   └── js/
    │       ├── auth.js          # 认证和公共UI
    │       └── env-config.js    # 环境配置
    ├── modules/
    │   ├── CSS/
    │   │   └── common.css       # 公共样式
    │   ├── dashboard/            # 工作台
    │   │   └── dashboard.html
    │   ├── crm/                  # 客户CRM
    │   │   └── crm.html
    │   ├── product-center/       # 产品中心
    │   │   └── product-center.html
    │   ├── supply-chain/         # 供应链
    │   │   └── supply-chain.html
    │   └── SmartOps/             # 智能经营
    │       └── SmartOps.html
    └── models/
        └── index.html            # UI参考文件
```

***

## 9. 安全设计要点

### 9.1 认证与授权

- JWT Token认证机制
- Token有效期24小时
- 用户上下文通过请求Header传递
- 服务间通过内部Token验证

### 9.2 数据隔离

- 多租户通过 `tenant_id` 实现数据隔离
- 所有查询都强制校验租户权限
- 用户只能访问自己租户的数据

### 9.3 密码安全

- 密码使用哈希存储（不保存明文）
- 登录时验证密码哈希

### 9.4 CORS处理

- API网关统一处理跨域请求
- 配置允许的源地址和请求方法

***

**文档版本**：v1.1\
**最后更新**：2026-04-11\
**维护者**：TradeMind开发团队
