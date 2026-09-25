# প্রোডাকশন ডিপ্লয়মেন্ট গাইড (Hostinger VPS)

এই গাইড ধরে নিচ্ছে VPS এ আগে থেকে Traefik (host network, letsencrypt certresolver), n8n, আর
Evolution API (পোর্ট 8080, নিজস্ব postgres) চলছে। আমরা শুধু নতুন `web`, `worker`, `redis` — এই
তিনটা সার্ভিস যোগ করব, কোনো পোর্ট বাইরে খুলব না, আর বিদ্যমান কোনো কিছু বদলাব না।

- সার্ভার: `187.53.140.120` (Ubuntu, 3.8 GB RAM + 4 GB swap)
- ডোমেইন: `wa.srv1980546.hstgr.cloud`
- অ্যাপ ফোল্ডার: `/docker/whatsapp-saas`

---

## ধাপ ১: SSH দিয়ে ঢোকা

```bash
ssh root@187.53.140.120
```

(আপনার SSH key বা পাসওয়ার্ড দিয়ে — Hostinger প্যানেল থেকে যেভাবে সবসময় ঢোকেন)

---

## ধাপ ২: GitHub Deploy Key বানানো (একবারই)

Private repo থেকে কোড আনতে একটা read-only SSH key লাগবে (আপনার নিজের GitHub পাসওয়ার্ড/টোকেন VPS এ রাখার দরকার নেই)।

```bash
mkdir -p /docker/whatsapp-saas
ssh-keygen -t ed25519 -C "vps-deploy-whatsapp-saas" -f ~/.ssh/whatsapp_saas_deploy -N ""
cat ~/.ssh/whatsapp_saas_deploy.pub
```

এই পাবলিক কী কপি করুন। তারপর ব্রাউজারে:

**GitHub → tayef02/whatsapp-saas → Settings → Deploy keys → Add deploy key**
- Title: `hostinger-vps`
- Key: (কপি করা পাবলিক কী পেস্ট করুন)
- **Allow write access ঠিক করবেন না** (read-only রাখুন — VPS থেকে কখনো push হবে না)

SSH config এ এই কী ব্যবহার করার জন্য একটা এন্ট্রি যোগ করুন:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github-whatsapp-saas
  HostName github.com
  User git
  IdentityFile ~/.ssh/whatsapp_saas_deploy
  IdentitiesOnly yes
EOF
```

---

## ধাপ ৩: কোড ক্লোন করা

```bash
git clone github-whatsapp-saas:tayef02/whatsapp-saas.git /docker/whatsapp-saas
cd /docker/whatsapp-saas
```

---

## ধাপ ৪: `.env.production` বানানো

```bash
cp .env.production.example .env.production
nano .env.production
```

প্রতিটা মান বসান:

| ভ্যারিয়েবল | কোথায় পাবেন |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | একই পেজ, "service_role" — কখনো কাউকে দেখাবেন না |
| `REDIS_PASSWORD` | নিজে জেনারেট করুন: `openssl rand -hex 32` |
| `APP_URL` | `https://wa.srv1980546.hstgr.cloud` (.env.production.example এ আগে থেকেই আছে) |
| `BKASH_RECEIVE_NUMBER` / `NAGAD_RECEIVE_NUMBER` | আপনার bKash/Nagad নাম্বার |

ফাইল সেভ করুন। (এই ফাইল `.gitignore` তে আছে, কখনো git এ যাবে না)

---

## ধাপ ৫: লাইভ Supabase এ migration চালানো (Supabase CLI দিয়ে)

এখন পর্যন্ত প্রতিটা migration আপনি SQL Editor এ কপি-পেস্ট করে ম্যানুয়ালি চালিয়েছেন। এখন থেকে
CLI দিয়ে এক কমান্ডে সব migration ট্র্যাক করে চালানো যাবে — ভবিষ্যতে নতুন migration আসলে আর
কপি-পেস্ট করা লাগবে না।

**৫.১ — CLI ইনস্টল (VPS এ, একবারই):**
```bash
npm install -g supabase
```

**৫.২ — লগইন:**

Supabase Dashboard → Account (উপরে ডানে প্রোফাইল আইকন) → Access Tokens → Generate new token
(নাম দিন যেমন `vps-cli`, কপি করুন)

```bash
supabase login --token আপনার-টোকেন-এখানে-পেস্ট-করুন
```

**৫.৩ — প্রজেক্টের সাথে লিংক:**

প্রজেক্ট রেফ পাবেন Supabase Dashboard → Settings → General → "Reference ID"

```bash
cd /docker/whatsapp-saas
supabase link --project-ref আপনার-প্রজেক্ট-রেফ
```

**৫.৪ — গুরুত্বপূর্ণ: পুরনো ১৪টা migration "already applied" মার্ক করা**

যেহেতু `0001` থেকে `0014` পর্যন্ত সব migration আপনি আগেই ম্যানুয়ালি SQL Editor এ চালিয়েছেন,
CLI কে বলে দিতে হবে এগুলো আবার না চালাতে (নাহলে "table already exists" এরর দেবে):

```bash
supabase migration repair --linked --status applied 0001 0002 0003 0004 0005 0006 0007 0008 0009 0010 0011 0012 0013 0014
```

**৫.৫ — যাচাই:**
```bash
supabase migration list
```
সব কটা migration এর remote কলামে টিক/ভার্সন দেখাবে।

এখন থেকে নতুন migration ফাইল `supabase/migrations/` এ যোগ হলে শুধু এটা চালালেই হবে:
```bash
git pull
supabase db push --linked
```

---

## ধাপ ৬: VPS এর Evolution সার্ভার ডাটাবেসে যোগ করা

Supabase SQL Editor এ (একবারই) — এই SQL টা `evolution_servers` টেবিলে VPS এর Evolution
সার্ভারের এন্ট্রি বসাবে, যাতে নতুন WhatsApp নাম্বার কানেক্ট হলে অ্যাপ জানে কোথায় instance বানাতে হবে:

```sql
insert into public.evolution_servers (name, api_url, api_key, capacity, is_active)
values (
  'VPS Evolution',
  'http://host.docker.internal:8080',
  'এখানে VPS এর Evolution এর আসল AUTHENTICATION_API_KEY বসান',
  30,
  true
);
```

- `api_url` এ `host.docker.internal:8080` ব্যবহার করা হয়েছে কারণ আমাদের `web`/`worker`
  কন্টেইনার থেকে এভাবেই VPS এর হোস্টে চলা বিদ্যমান Evolution পর্যন্ত পৌঁছানো যায়
  (`docker-compose.production.yml` এ `extra_hosts` দিয়ে এই নাম রেজিস্টার করা আছে)।
- `capacity: 30` একটা রক্ষণশীল শুরু — Evolution সার্ভারটা `genzitzone` ইনস্ট্যান্স আর অন্য
  কিছুর সাথেও শেয়ার করা, তাই RAM/লোড দেখে পরে বাড়ানো-কমানো যাবে।
- `api_key` টা VPS এর Evolution কন্টেইনারের `AUTHENTICATION_API_KEY` এনভ ভ্যারিয়েবলের
  আসল মান (`docker inspect` বা VPS এর Evolution compose ফাইল দেখে বের করুন)।

**নোট:** আমাদের অ্যাপ প্রতিটা নতুন নাম্বারের জন্য instance-লেভেল webhook সেট করে (নিজের
`APP_URL/api/webhooks/evolution` এ) — তাই VPS এর Evolution এর গ্লোবাল webhook কনফিগ বা
`genzitzone` ইনস্ট্যান্স একদমই স্পর্শ হবে না।

---

## ধাপ ৭: বিল্ড ও চালু করা

```bash
cd /docker/whatsapp-saas
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

প্রথমবার বিল্ড হতে কয়েক মিনিট লাগবে (Next.js compile হচ্ছে)।

---

## ধাপ ৮: লগ দেখা / স্বাস্থ্য যাচাই

```bash
docker compose -f docker-compose.production.yml logs -f web
docker compose -f docker-compose.production.yml logs -f worker
```

`worker চালু হয়েছে...` আর Next.js এর `✓ Ready` লাইন দেখলে ঠিক আছে। বন্ধ করতে `Ctrl+C`।

```bash
curl -s https://wa.srv1980546.hstgr.cloud/api/health
```
`{"status":"ok","service":"web"}` আসা উচিত।

Traefik Dashboard এ (যদি চালু থাকে) `wa-web` router "healthy" দেখাচ্ছে কিনা দেখুন। কাজ না করলে:
```bash
docker logs traefik --tail 50 | grep -i wa-web
```

**যদি ডোমেইনে 404/502 আসে (Traefik রাউট খুঁজে পাচ্ছে না):** Traefik host network mode এ চলে,
তাই সাধারণত যেকোনো Docker bridge network এর কন্টেইনারে পৌঁছাতে পারার কথা (n8n এর মতোই)। যদি না
পৌঁছায়, Traefik কে সরাসরি আমাদের নেটওয়ার্কেও জয়েন করিয়ে দেখুন:
```bash
docker network connect whatsapp-saas_wa-net traefik
```
(Traefik কন্টেইনারের আসল নাম `docker ps` দিয়ে যাচাই করে নিন, হয়তো `traefik` না অন্য কিছু)

---

## আপডেট ডিপ্লয় করা (নতুন কোড পুশ করার পর)

```bash
cd /docker/whatsapp-saas
git pull
supabase db push --linked   # নতুন migration থাকলে
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

পুরনো কন্টেইনার বন্ধ হয়ে নতুনটা চালু হবে, ডাউনটাইম কয়েক সেকেন্ডের বেশি হওয়ার কথা না।

---

## ব্যাকআপ

- **বিজনেস ডাটা (Supabase)**: ফ্রি প্ল্যানে Supabase নিজে ব্যাকআপ রাখে না — তাই VPS নিজেই
  প্রতিদিন রাত ৩টায় (Asia/Dhaka) `pg_dump` চালিয়ে `/root/backups` এ ৭ দিনের ব্যাকআপ রাখে
  (cron দিয়ে সেটআপ করা, নিচে "ডাটাবেস ব্যাকআপ (cron)" দেখুন)।
- **WhatsApp সেশন ডাটা**: VPS এর বিদ্যমান Evolution volume এ থাকে — এই ডিপ্লয়মেন্ট সেটা
  টাচ করে না, তাই আলাদা কিছু করার দরকার নেই।
- **Redis**: শুধু queue এর সাময়িক job state রাখে, ব্যাকআপের দরকার নেই (মুছে গেলেও ব্যবসার
  কোনো ডাটা হারাবে না, শুধু চলমান job গুলো আবার শুরু থেকে schedule হবে)।

### ডাটাবেস ব্যাকআপ (cron)

`/root/backups/.dbpass` এ শুধু DB পাসওয়ার্ড (chmod 600), `/root/backups/backup.sh` এ script।
Script এ পাসওয়ার্ড হার্ডকোড না করে ফাইল থেকে পড়ে। Supabase Dashboard → Settings → Database →
Connect → "Session pooler" ট্যাব থেকে HOST/PORT/USER বসানো হয়েছে (transaction pooler না —
সেটা pg_dump এর জন্য উপযুক্ত না, আর direct connection VPS এ IPv6 না থাকলে কাজ নাও করতে পারে)।

`backup.sh`:
```bash
#!/bin/bash
PW=$(cat /root/backups/.dbpass)
docker run --rm -e PGPASSWORD=$PW postgres:15 pg_dump -h HOST -p PORT -U USER -d postgres > /root/backups/db_$(date +%F).sql
find /root/backups -name "db_*.sql" -mtime +7 -delete
```

cron (রোজ রাত ৩টা, Asia/Dhaka):
```
CRON_TZ=Asia/Dhaka
0 3 * * * /root/backups/backup.sh
```

### ব্যাকআপ থেকে রিস্টোর করা

**সতর্কতা**: এটা টার্গেট ডাটাবেসে ডাটা বসিয়ে দেয় — লাইভ ডাটাবেসে সরাসরি না চালিয়ে, আগে
Supabase এ একটা নতুন/খালি প্রজেক্ট বা লোকাল postgres এ টেস্ট করে দেখাই ভালো, যদি না সত্যিই
বিপর্যয়কর পরিস্থিতি (ডাটা হারিয়ে গেছে, রিকভারি করাই লাগবে)।

```bash
PW=$(cat /root/backups/.dbpass)
docker run --rm -e PGPASSWORD=$PW -v /root/backups:/backups postgres:15 psql -h HOST -p PORT -U USER -d postgres -f /backups/db_2026-09-25.sql
```
(`db_2026-09-25.sql` এর জায়গায় আসল ফাইলের নাম বসান — `ls /root/backups` দিয়ে দেখুন কী কী আছে)

---

## সমস্যা হলে আগের ভার্সনে ফেরা (rollback)

```bash
cd /docker/whatsapp-saas
git log --oneline -10          # কোন কমিটে ফিরতে চান দেখুন
git checkout <আগের-কমিট-হ্যাশ>
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

DB migration ও রোলব্যাক দরকার হলে (বিরল, সাধারণত migration ফরওয়ার্ড-অনলি রাখাই ভালো) —
Supabase Dashboard → Database → Backups থেকে পুরনো ব্যাকআপ রিস্টোর করুন।

কাজ শেষে আবার লেটেস্ট এ ফিরতে:
```bash
git checkout main
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

---

## লাইভে যাওয়ার আগের চেকলিস্ট

- [ ] **Supabase key বদলানো**: যদি ডেভেলপমেন্টে ব্যবহার করা কোনো key কখনো কোথাও (GitHub,
      স্ক্রিনশট, চ্যাট) এক্সপোজ হয়ে থাকে, Supabase Dashboard → Settings → API থেকে rotate করুন
- [ ] **Confirm email চালু**: Supabase → Authentication → Providers → Email →
      "Confirm email" অন করুন (এখন পর্যন্ত টেস্টের সুবিধার জন্য বন্ধ থাকতে পারে)
- [ ] **Resend SMTP সেটআপ**: Supabase → Authentication → Settings → SMTP Settings এ
      Resend এর ফ্রি টিয়ার (মাসে ৩০০০ ইমেইল) কনফিগার করুন — নাহলে Supabase এর ডিফল্ট
      ইমেইল সার্ভিস রেট-লিমিটেড, প্রোডাকশনের জন্য যথেষ্ট না
- [ ] **Evolution API key শক্ত কিনা**: `AUTHENTICATION_API_KEY` র‍্যান্ডম, লম্বা, অনুমান-অযোগ্য
      কিনা চেক করুন (এটা `genzitzone` সহ পুরো শেয়ার্ড সার্ভারের অ্যাক্সেস কী)
- [ ] **টেস্ট অ্যাকাউন্ট/ডাটা মোছা**: Supabase এ ডেভেলপমেন্টের সময় বানানো টেস্ট ইউজার/workspace/
      payment থাকলে মুছে ফেলুন (Table Editor থেকে সরাসরি, বা `auth.users` থেকে ইউজার ডিলিট করলে
      cascade এ workspace ও মুছে যাবে)
- [ ] **Super admin ঠিক আছে কিনা**: `select u.email from super_admins sa join auth.users u
      on u.id = sa.user_id;` চালিয়ে দেখুন শুধু আপনার আসল অ্যাকাউন্ট আছে, কোনো টেস্ট ইউজার নেই
- [ ] **REDIS_PASSWORD** আর **SUPABASE_SERVICE_ROLE_KEY** যেন কখনো লগ/এরর মেসেজে প্রিন্ট না হয় —
      একবার ব্রাউজারে অ্যাপ খুলে Network ট্যাবে চেক করে নিন কোনো response এ leak হচ্ছে না
- [ ] **evolution_servers এ VPS এন্ট্রি** যোগ হয়েছে কিনা (ধাপ ৬), আর `capacity` বাস্তবসম্মত কিনা
