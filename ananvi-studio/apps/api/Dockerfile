FROM node:20-alpine
RUN apk add --no-cache ffmpeg python3 py3-pip && pip3 install --break-system-packages yt-dlp
WORKDIR /app
COPY package.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN npm install --workspaces --include-workspace-root=false -w @ananvi/shared -w @ananvi/api \
 && npm run build -w @ananvi/shared && npm run build -w @ananvi/api
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/main"]
