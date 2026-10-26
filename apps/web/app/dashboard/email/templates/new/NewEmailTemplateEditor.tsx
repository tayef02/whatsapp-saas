"use client";

import EmailTemplateForm from "../EmailTemplateForm";

type EditorProps = Omit<React.ComponentProps<typeof EmailTemplateForm>, "mode" | "templateId" | "initial">;

// পেজের (সার্ভার কম্পোনেন্ট) পাশের ফোল্ডারেই থাকা পাতলা ক্লায়েন্ট র‍্যাপার — সার্ভার শুধু এই (একই ফোল্ডারের)
// ফাইলকে ক্লায়েন্ট-রেফারেন্স হিসেবে চেনে, আসল এডিটর (../EmailTemplateForm) ক্লায়েন্ট থেকে ক্লায়েন্টে import হয়।
// ইমেইলের বাকি সব ক্লায়েন্ট ফর্মও (কন্টাক্ট, ইম্পোর্ট) একই কাঠামোয় — পেজের পাশের ফাইল।
export default function NewEmailTemplateEditor(props: EditorProps) {
  return <EmailTemplateForm mode="create" {...props} />;
}
