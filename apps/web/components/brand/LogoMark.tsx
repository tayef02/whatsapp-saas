// Gen Z CRM লোগো — "কাস্টমার রিলেশনশিপ নেটওয়ার্ক": মাঝখানে একটা কন্টাক্ট, তাকে ঘিরে তিনটা
// সংযুক্ত কন্টাক্ট। আগের চ্যাট-বাবল আইকন WhatsApp-এর মতো লাগত, তাই CRM-ভিত্তিক চিহ্ন।
// মার্কেটিং হেডার/ফুটার, লগইন/সাইনআপ, লিগ্যাল, ড্যাশবোর্ড সাইডবার — সব জায়গায় এই একটাই
// কম্পোনেন্ট (favicon আলাদা SVG ফাইল: app/icon.svg, একই আকৃতি)
export default function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center bg-gradient-to-br from-purple-400 to-purple-700 ${className}`}
      style={{ width: size, height: size, borderRadius: size * 0.27 }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.7} height={size * 0.7} fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round">
        <line x1="12" y1="12" x2="5.5" y2="6.5" />
        <line x1="12" y1="12" x2="18.5" y2="7.5" />
        <line x1="12" y1="12" x2="12" y2="19.5" />
        <circle cx="12" cy="12" r="3.2" fill="#fff" stroke="none" />
        <circle cx="5.5" cy="6.5" r="2" fill="#fff" stroke="none" />
        <circle cx="18.5" cy="7.5" r="2" fill="#fff" stroke="none" />
        <circle cx="12" cy="19.5" r="2" fill="#fff" stroke="none" />
      </svg>
    </span>
  );
}
