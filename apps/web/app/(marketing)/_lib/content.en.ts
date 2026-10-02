// মার্কেটিং সাইটের সব লেখা — English (ডিফল্ট)। বাংলা সংস্করণ content.bn.ts এ, একই কাঠামো
// (Content টাইপ এই ফাইলের `en` থেকেই আসে, তাই কোনো key বাদ পড়লে TypeScript ধরে ফেলে)।
// নিয়ম: নকল রিভিউ/গ্রাহক সংখ্যা/লোগো নয় — শুধু যা সত্যিই কাজ করে তাই লেখা।
export const en = {
  meta: {
    homeTitle: "Gen Z CRM — WhatsApp marketing CRM for Bangladesh",
    homeDescription:
      "Send WhatsApp campaigns, reply to customers with AI, and track orders — all in one place. Built for small and medium businesses in Bangladesh.",
    template: "%s | Gen Z CRM",
    features: { title: "Features", description: "WhatsApp campaigns, AI chatbot, shared inbox, order tracking and group tools — everything that works in Gen Z CRM today." },
    pricing: { title: "Pricing", description: "7-day free trial, then simple monthly plans paid with bKash or Nagad. Pick a plan by message and contact limits." },
    about: { title: "About", description: "Gen Z CRM is a product of Gen Z IT Zone, built to make WhatsApp marketing simple for small and medium businesses in Bangladesh." },
    contact: { title: "Contact", description: "Questions about Gen Z CRM? Reach us directly on WhatsApp or email." },
    faq: { title: "FAQ", description: "Answers about number bans, the AI bot, payments and Messenger for Gen Z CRM." },
  },

  nav: {
    solutions: "Solutions",
    features: "Features",
    pricing: "Pricing",
    support: "Support",
    login: "Log in",
    start: "Start free",
    dashboard: "Go to dashboard",
    menu: "Menu",
    closeMenu: "Close menu",
    language: "Language",
    live: "Live",
    soon: "Soon",
    whatsapp: "WhatsApp",
    messenger: "Messenger",
    mega: ["AI chatbot", "Campaigns", "Contacts & templates", "Group automation", "Order management", "Shared inbox", "Number warm-up", "Delivery reports"],
  },

  common: {
    home: "Home",
    startTrial: "Start your 7-day free trial",
    startTrialShort: "Start free trial",
    dashboard: "Go to dashboard",
    noCard: "7 days free · No card needed · Cancel anytime",
    sample: "Sample",
    illustrative: "Illustrative preview",
    seeAllFeatures: "See all features",
    seeAllQuestions: "See all questions",
    seeAllPlans: "See all plans and compare",
  },

  hero: {
    eyebrow: "WhatsApp marketing CRM for Bangladesh",
    title: "Send campaigns, reply with AI, and run every chat from one place.",
    body: "Gen Z CRM sends your WhatsApp campaigns, answers customers with AI trained on your own documents, and tracks orders from the chat — so you stop juggling six different apps.",
    secondary: "See how it works",
    pill: "Campaign running",
    mock: {
      title: "Dashboard",
      subtitle: "Campaigns, inbox and orders at a glance",
      tiles: ["AI bot", "Orders", "Groups", "Reports"],
      campaign: "Active campaign",
      running: "Running",
      inbox: "Inbox",
      needsAgent: "Needs agent",
      chatTitle: "AI reply",
      chatCustomer: "Do you deliver to Sylhet?",
      chatAi: "Yes! Delivery takes 3–5 working days. Want to place an order?",
    },
  },

  pillars: {
    title: "Everything your customer conversations need.",
    body: "Gen Z CRM brings campaigns, AI replies, your inbox and orders together, so nothing gets lost between chats.",
    items: [
      { title: "Send campaigns", desc: "Text, images or PDFs, scheduled with templates and safe random delays." },
      { title: "Reply with AI", desc: "Answers from your own knowledge base — no hardcoded rules." },
      { title: "One shared inbox", desc: "Every conversation in one place. Jump in whenever you want." },
      { title: "Track orders", desc: "Confirm orders in chat; status changes notify the customer automatically." },
    ],
  },

  problem: {
    title: "You know you should reply faster.",
    body: "Customers message at all hours. Replies pile up, orders hide inside chats, and the same questions come back every single day.",
    bullets: [
      "Typing the same answer 50 times isn't your job.",
      "Hunting for orders in old chats isn't your job.",
      "Guessing who replied and who didn't isn't your job.",
    ],
    chips: ["How much is it?", "Is it in stock?", "Delivery to Sylhet?", "I want to order", "Do you have a catalogue?", "Is cash on delivery available?", "Please confirm my order"],
    chipsLabel: "Sample customer questions",
    highlight: "Reply with AI…",
    caption: "Answered from your knowledge base",
  },

  aiCards: {
    eyebrow: "How replies look",
    title: "AI replies that sound like your business.",
    body: "Upload your price list or FAQ, write a short instruction, and the AI answers from your own content. When it isn't sure, it hands the chat to you.",
    cards: [
      { tag: "Answers from your documents", customer: "Do you have size M in stock?", ai: "Yes, size M is available. Want me to reserve one for you?" },
      { tag: "Takes the order", customer: "I'll take two.", ai: "Great! Please send your name, phone number and delivery address to confirm." },
      { tag: "Hands off to you", customer: "Can I get a bulk discount?", ai: "I'm not sure about that — I'm passing this chat to a human agent.", badge: "Needs agent" },
    ],
  },

  why: {
    title: "Why automate customer chats?",
    body: "Gen Z CRM handles the repetitive work so you can focus on running your business.",
    cards: [
      { title: "Take repetitive replies off your plate.", points: ["AI answers common questions", "Templates with names and spintax", "Scheduled campaigns"] },
      { title: "Keep every conversation organized.", points: ["Shared inbox with filters", "Needs-agent flag when AI hands off", "Full history in one place"] },
      { title: "Never lose an order in the chat.", points: ["Orders saved with readable IDs", "Status updates sent to the customer", "Cancel reasons recorded"] },
    ],
    closing: "Keep your business moving while you run it.",
  },

  band: {
    eyebrow: "WHAT GEN Z CRM HANDLES",
    titleWithPrice: "Your conversations stay active every day. Plans from ৳{price}/month.",
    titleNoPrice: "Your conversations stay active every day. Simple monthly plans.",
    items: [
      { title: "Campaigns & scheduling", desc: "Send text, images and PDFs to the audience you choose, on your schedule." },
      { title: "Safe sending", desc: "Daily limits per number, warm-up for new numbers and random delays between messages." },
      { title: "Opt-out handling", desc: "Customers who reply STOP are never messaged by a campaign again." },
    ],
    priceLabel: "Starting at",
    perMonth: "/month",
    priceNote: "Pay with bKash or Nagad. No card needed.",
  },

  how: {
    title: "How Gen Z CRM works for your business.",
    body: "Connect your number, teach the AI, then send and reply from one dashboard.",
    link: "Read all features",
    rows: [
      { label: "Connect", title: "Start by connecting your number.", body: "Scan a QR code to link your WhatsApp number. New numbers go through warm-up mode with gentle daily limits.", link: "See safety features" },
      { label: "Teach the AI", title: "Then teach the AI your business.", body: "Upload PDF, Excel, CSV or text files and write a short instruction. The AI answers only from what you give it.", link: "See the AI chatbot" },
      { label: "Campaigns", title: "Send campaigns that feel personal.", body: "Use {{name}} variables and spintax so every message is slightly different, with random delays between sends.", link: "See campaign features" },
      { label: "Inbox", title: "Reply from one inbox.", body: "See AI and human replies side by side. Filter the chats that need a person and answer them yourself.", link: "See inbox features" },
      { label: "Orders", title: "Track every order.", body: "Orders confirmed in chat are saved automatically. Change the status and the customer is notified on WhatsApp.", link: "See order tracking" },
    ],
    mock: {
      connectTitle: "WhatsApp number",
      connected: "Connected",
      warmup: "Warm-up mode on",
      dailyLimit: "Today's sending limit",
      botOn: "AI bot on",
      botOnDesc: "Replying to customers",
      kbTitle: "Knowledge base",
      ready: "Ready",
      processing: "Processing…",
      promptLabel: "Instruction",
      prompt: "You are a friendly shop assistant. Answer briefly and politely. If you're unsure, say so.",
      campaignName: "Eid offer",
      sent: "Sent",
      delivered: "Delivered",
      read: "Read",
      failed: "Failed",
      delay: "Random delay between messages",
      inboxTitle: "Inbox",
      all: "All",
      unanswered: "Unanswered",
      agent: "Agent",
      customer: "Customer",
      thread: ["Do you have this in black?", "Yes, black is in stock. Shall I note an order?"],
      orderTitle: "Order",
      orderProduct: "Leather wallet × 2",
      pending: "Pending",
      confirmed: "Confirmed",
      shipped: "Shipped",
      notified: "Customer notified on WhatsApp",
    },
  },

  grid: [
    { title: "Customers message you where they already are.", desc: "WhatsApp is live today, with Messenger on the way." },
    { title: "Run your groups on autopilot.", desc: "Keyword replies, welcome messages, spam filters and scheduled announcements for your WhatsApp groups." },
    { title: "Built for Bangladesh.", desc: "Bangla interface, bKash and Nagad payments, and phone numbers auto-formatted to 8801XXXXXXXXX." },
    { title: "Honest by design.", desc: "We don't show fake customer counts or reviews. Everything on this page is a feature that works today." },
  ],

  channels: {
    title: "One CRM for every channel you sell on.",
    body: "WhatsApp is live. More channels are on the way.",
    items: [
      { name: "WhatsApp", desc: "Campaigns, AI chatbot, groups and orders", status: "live" },
      { name: "Facebook Messenger", desc: "Inbox, AI replies and orders", status: "soon" },
      { name: "Comment automation", desc: "Auto-reply to post comments", status: "soon" },
      { name: "Post scheduler", desc: "Schedule posts to your page", status: "soon" },
    ],
    live: "Live",
    soon: "Coming soon",
  },

  start: {
    title: "Get started with Gen Z CRM.",
    bodyWithPrice: "Plans from ৳{price}/month. Start with a 7-day free trial and pay later with bKash or Nagad.",
    bodyNoPrice: "Start with a 7-day free trial and pay later with bKash or Nagad.",
    bullets: ["AI replies from your own documents", "Campaigns with safe sending limits", "Shared inbox and order tracking", "Group tools for WhatsApp groups"],
    cardLabel: "7-day free trial",
    from: "From",
    perMonth: "/mo",
    cardNote: "bKash / Nagad · manual payment",
    cta: "Start your free trial",
    cardFoot: "No card needed · Cancel anytime",
  },

  faqSection: { title: "Frequently asked questions" },

  finalCta: {
    title: "Automate.",
    body: "Save hours, reply faster and stay organized.",
  },

  footer: {
    tagline: "Built to make WhatsApp marketing simple for small and medium businesses in Bangladesh.",
    product: "A product of Gen Z IT Zone",
    productHeading: "Product",
    companyHeading: "Company",
    legalHeading: "Legal",
    features: "Features",
    pricing: "Pricing",
    faq: "FAQ",
    about: "About",
    contact: "Contact",
    whatsappSupport: "WhatsApp support",
    terms: "Terms",
    privacy: "Privacy policy",
    dataDeletion: "Data deletion",
    copyright: "Gen Z CRM · Gen Z IT Zone · Bangladesh",
  },

  features: {
    eyebrow: "Features",
    title: "Everything you can do, in detail.",
    body: "Only features that genuinely work today — no false claims.",
    categories: [
      {
        title: "Campaigns & messaging",
        items: [
          { title: "Connect your number", desc: "Scan a QR code to connect your WhatsApp number and watch the connection status live." },
          { title: "Contact import", desc: "Import from CSV or Excel in one click, with duplicates removed and numbers auto-formatted (01XXX → 8801XXX)." },
          { title: "Templates", desc: "Use {{name}} variables and spintax so every message is slightly different." },
          { title: "Campaigns", desc: "Text plus image or PDF, audience selection, scheduling and random delays." },
          { title: "Delivery reports", desc: "Sent, delivered, read and failed — and retry the failed ones." },
        ],
      },
      {
        title: "AI chatbot & inbox",
        items: [
          { title: "Answers from your knowledge base", desc: "Upload PDF, Excel, CSV or TXT files. The AI answers from them with no hardcoded rules." },
          { title: "Multi-turn conversations", desc: "Remembers the last 10 messages and works through complex questions step by step." },
          { title: "Hand-off to a human agent", desc: "When the AI isn't sure it says so, and you can reply yourself." },
          { title: "Shared inbox", desc: "Every conversation in one place — AI and agent replies, with media thumbnails." },
        ],
      },
      {
        title: "Group tools",
        items: [
          { title: "Group sync", desc: "Names, members, admin lists, plus invite links you can generate or rotate." },
          { title: "Keyword and @mention replies", desc: "Fixed text or AI replies, with a cooldown per rule." },
          { title: "Welcome messages", desc: "Greet new members automatically, with the group name or link filled in." },
          { title: "Spam and link filter", desc: "Auto-delete when the bot is an admin; otherwise you get a dashboard notification." },
          { title: "Scheduled announcements", desc: "Post to several groups with staggered delays, within daily limits." },
        ],
      },
      {
        title: "Orders & safety",
        items: [
          { title: "Automatic order capture", desc: "When an order is confirmed in chat it's saved with a short, readable order ID." },
          { title: "Status updates", desc: "Change the status in the dashboard and the customer is told on WhatsApp." },
          { title: "Number ban protection", desc: "Daily limits, warm-up mode, random delays and automatic STOP opt-out." },
        ],
      },
    ],
    soonTitle: "Coming soon",
    soon: ["Messenger comment automation", "Messenger post scheduler", "Team assignment", "Number checker", "Bangla template library"],
    ctaTitle: "Start today with 7 days free",
  },

  pricing: {
    eyebrow: "Pricing",
    title: "Pay only for what you send.",
    body: "Pay manually with bKash or Nagad — no hidden costs.",
    trialTitle: "{days} days completely free",
    trialBody: "{messages} messages, {contacts} contacts, up to {numbers} number(s) — no card needed.",
    trialCta: "Start free trial",
    popular: "Most popular",
    perMonth: "/month",
    validity: "{days} days validity",
    choose: "Get started",
    perks: ["{messages} messages per month", "Up to {contacts} contacts", "{numbers} WhatsApp number(s)", "AI chatbot & group tools", "bKash / Nagad payment"],
    howToPayTitle: "How do I pay?",
    howToPay:
      "Pay manually with bKash or Nagad — there are no international cards and no auto-renewing subscriptions. After you pay, confirm inside the app and your plan switches on.",
    ctaTitle: "Not sure which plan to pick?",
    ctaButton: "Contact us",
  },

  about: {
    eyebrow: "About",
    title: "Built for Bangladeshi businesses, from Bangladesh.",
    p1: "Most small and medium businesses in Bangladesh still send WhatsApp messages by hand, stay up late answering customers, and have no simple place to manage sales, orders and customers together.",
    p2: "Gen Z CRM was built to fix that — one all-in-one place where you can talk to customers, sell, and manage orders, all in Bangla. It is a product of",
    brand: "Gen Z IT Zone",
    values: [
      { title: "Honesty first", desc: "We don't show fake customer counts or fake reviews. We only say what's true." },
      { title: "Bangladesh-first", desc: "A full Bangla interface and bKash/Nagad payments — no hassle with foreign tools." },
      { title: "Number safety", desc: "Instead of risking your number for fast sales, we help you scale slowly and safely." },
      { title: "Simplicity", desc: "Usable without technical skills — no complicated setup or coding." },
    ],
    ctaTitle: "Make it work for your business too",
  },

  contact: {
    eyebrow: "Contact",
    title: "Have a question?",
    body: "Write to us directly on WhatsApp or email — we try to answer quickly.",
    whatsappTitle: "Message us on WhatsApp",
    whatsappDesc: "The fastest way to get an answer",
    whatsappCta: "Start chat",
    emailTitle: "Send an email",
    emailCta: "Write an email",
    responseLabel: "Response time: ",
    response: "We usually try to reply within the same working day.",
    faqTitle: "Common questions are already answered",
    faqLink: "See the FAQ page",
  },

  faq: {
    eyebrow: "FAQ",
    title: "Frequently asked questions",
    unanswered: "Didn't find your answer?",
    contactLink: "Contact us",
    items: [
      { q: "Will my WhatsApp number get banned?", a: "A daily limit per number, warm-up mode for new numbers (limits rise gradually) and random delays between messages together lower the risk a lot. But nobody can promise 100% — it depends on WhatsApp's own policies." },
      { q: "Which number can I connect?", a: "Any active WhatsApp number — scan a QR code to connect. Both WhatsApp Business and regular WhatsApp work." },
      { q: "How does the AI bot answer?", a: "Replies come from the knowledge base you provide (PDF/Excel/CSV) and your system prompt — there are no pre-written hardcoded answers. If it isn't sure, it hands the chat over to a human agent." },
      { q: "How many numbers can I run at once?", a: "It depends on your plan — the pricing page shows the number limit for each plan." },
      { q: "When is Messenger coming?", a: "The Messenger channel (including comment automation and a post scheduler) is in testing and will launch soon." },
      { q: "How do I pay?", a: "Manually with bKash or Nagad — no international card needed." },
      { q: "What do I get in the free trial?", a: "You can use the features for 7 days with no card details. When it ends you can choose a plan if you want to continue." },
      { q: "Is my customers' data safe?", a: "Every workspace's data is separate and protected (row-level security) — it never mixes with another business." },
      { q: "Can I use it without technical skills?", a: "Yes — the interface is available in Bangla and there is no coding or complicated setup." },
    ],
  },
};

export type Content = typeof en;
