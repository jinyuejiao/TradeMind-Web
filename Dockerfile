# 第一阶段：构建阶段
FROM node:18-alpine AS build

# 设置工作目录
WORKDIR /app

# 拷贝项目文件
COPY . .

# 配置淘宝/阿里云 NPM 镜像加速
RUN npm config set registry https://registry.npmmirror.com

# 安装依赖
RUN npm install

# 第二阶段：托管阶段
FROM nginx:alpine

# 拷贝静态文件到 Nginx 目录
COPY --from=build /app /usr/share/nginx/html

# 内层 Nginx：/api 反代网关（正式默认 gateway:8080；测试 build-arg / environment 覆盖）
ARG TM_GATEWAY_HOST=gateway
ARG TM_GATEWAY_PORT=8080
ENV TM_GATEWAY_HOST=${TM_GATEWAY_HOST}
ENV TM_GATEWAY_PORT=${TM_GATEWAY_PORT}
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY deploy/docker-entrypoint.d/40-tm-nginx-render.sh /docker-entrypoint.d/40-tm-nginx-render.sh
RUN chmod +x /docker-entrypoint.d/40-tm-nginx-render.sh \
    && rm -f /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80