-- Phase ২: WhatsApp গ্রুপ টুলস, ধাপ ৪ — মেসেজ লগ/আর্কাইভ সম্প্রসারণ: মিডিয়া সাপোর্ট +
-- বট নিজের পাঠানো (outbound) গ্রুপ মেসেজের ডেলিভারি স্ট্যাটাস ট্র্যাকিং

alter table public.group_messages
  alter column content drop not null,
  add column media_type text check (media_type in ('image', 'document', 'video', 'audio', 'sticker')),
  -- মিডিয়া ফাইল আসলেই ডাউনলোড/স্টোরেজে সেভ করার সঠিক পদ্ধতি এখনো লাইভ payload দেখে যাচাই
  -- করা হয়নি (Evolution base64 media ঠিক কোন ফিল্ডে পাঠায় নিশ্চিত না) — কলামটা এখনই রাখা
  -- হলো, পরের ধাপে পপুলেট হবে; আপাতত media_type + caption (content) সেভ হয়
  add column media_url text,
  add column provider_message_id text,
  add column status text not null default 'received' check (status in ('received', 'sent', 'delivered', 'read', 'failed'));

create unique index group_messages_provider_msg_idx
  on public.group_messages (provider_message_id)
  where provider_message_id is not null;
