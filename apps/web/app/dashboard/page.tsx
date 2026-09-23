import Link from "next/link";

export default function DashboardHome() {
  return (
    <div>
      <h1>ড্যাশবোর্ড</h1>
      <p>
        <Link href="/dashboard/numbers">WhatsApp নাম্বার ম্যানেজ করুন →</Link>
      </p>
      <p>
        <Link href="/dashboard/contacts">কন্টাক্ট ম্যানেজ করুন →</Link>
      </p>
    </div>
  );
}
