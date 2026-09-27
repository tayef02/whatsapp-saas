-- কাস্টমার "কবে পাবো?" জিজ্ঞেস করলে বট যেন "কোনো তথ্য নেই" এর বদলে workspace-এর
-- সাধারণ ডেলিভারি সময় (ফ্রি-টেক্সট, যেমন "৩-৫ কার্যদিবস") দিয়ে স্বাভাবিক উত্তর দিতে পারে

alter table public.workspace_ai_settings
  add column typical_delivery_time text;

grant update (typical_delivery_time) on public.workspace_ai_settings to authenticated;
grant insert (typical_delivery_time) on public.workspace_ai_settings to authenticated;
