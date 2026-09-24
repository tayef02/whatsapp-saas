# প্রোডাকশন ইমেজ — worker TypeScript সোর্স থেকে সরাসরি চলে (tsx দিয়ে), আলাদা কম্পাইল স্টেপ নেই
# (workspace @whatsapp-saas/core প্যাকেজ raw .ts সোর্স হিসেবে শিপ হয়, tsc দিয়ে আগে কম্পাইল করলে
# সেটা আলাদাভাবে বিল্ড করতে হতো — tsx সরাসরি চালানো সহজ আর কম ঝুঁকিপূর্ণ)
# বিল্ড context হলো monorepo root (docker-compose.production.yml এ context: . দেওয়া আছে)

# apps/web/package.json ইচ্ছাকৃতভাবে কপি হয়নি — npm ci শুধু যে workspace package.json
# গুলো এখানে আছে তার dependency install করে, তাই Next.js/React worker ইমেজে ঢোকে না (~700MB → ~110MB)
FROM node:24-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/core/package.json packages/core/package.json
RUN npm ci

FROM node:24-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S worker -u 1001

COPY --from=deps /repo/node_modules ./node_modules
COPY package.json ./
COPY apps/worker apps/worker
COPY packages/core packages/core

USER worker
WORKDIR /repo/apps/worker
EXPOSE 3100

CMD ["npm", "start"]
