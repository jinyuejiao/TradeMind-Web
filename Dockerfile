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

# 同源反代 /api → gateway（ECS 若仅暴露 web 容器时必需）
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80