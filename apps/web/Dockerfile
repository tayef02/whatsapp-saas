# প্রোডাকশন ইমেজ — multi-stage, শেষ ইমেজে শুধু Next.js standalone output থাকে
# (পুরো node_modules/সোর্স না, তাই ইমেজ ছোট আর কম RAM লাগে)
# বিল্ড context হলো monorepo root (docker-compose.production.yml এ context: . দেওয়া আছে)

FROM node:24-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/core/package.json packages/core/package.json
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* ভ্যারিয়েবল Next.js build-time এ client বান্ডেলে বসে যায় (রানটাইমে env_file
# দিয়ে দিলে কাজ করে না) — .env.production ইচ্ছাকৃতভাবে .dockerignore এ থাকায় (secret leak
# ঠেকাতে) build context এও যায় না, তাই docker-compose.production.yml থেকে build arg হয়ে
# এখানে আসতে হবে
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_MESSENGER_ENABLED
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_MESSENGER_ENABLED=$NEXT_PUBLIC_MESSENGER_ENABLED
RUN npm run build --workspace=apps/web

FROM node:24-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
# পরে public/ ফোল্ডার যোগ হলে এখানে একটা লাইন যোগ করতে হবে:
# COPY --from=builder /repo/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/web/server.js"]
