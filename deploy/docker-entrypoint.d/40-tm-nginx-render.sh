#!/bin/sh
set -e

: "${TM_GATEWAY_HOST:=gateway}"
: "${TM_GATEWAY_PORT:=8080}"
export TM_GATEWAY_HOST TM_GATEWAY_PORT

CONF="/etc/nginx/conf.d/default.conf"
TEMPLATE="/etc/nginx/templates/default.conf.template"

# 每次启动从模板渲染，覆盖镜像内可能存在的旧版硬编码 gateway 配置
if [ -f "$TEMPLATE" ]; then
    echo "[tm-web] rendering nginx template (gateway=${TM_GATEWAY_HOST}:${TM_GATEWAY_PORT})"
    envsubst '${TM_GATEWAY_HOST} ${TM_GATEWAY_PORT}' < "$TEMPLATE" > "$CONF"
elif [ ! -f "$CONF" ]; then
    echo "[tm-web] FATAL: missing template and ${CONF}"
    exit 1
else
    echo "[tm-web] WARN: using baked-in ${CONF} (no template); ensure TM_GATEWAY_* matches environment"
fi

nginx -t
