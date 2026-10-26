"use client";

import EmailTemplateForm from "../EmailTemplateForm";

type EditorProps = Omit<React.ComponentProps<typeof EmailTemplateForm>, "mode">;

// পেজের পাশের ফোল্ডারেই থাকা পাতলা ক্লায়েন্ট র‍্যাপার (কারণ new/NewEmailTemplateEditor.tsx এর কমেন্টে)
export default function EditEmailTemplateEditor(props: EditorProps) {
  return <EmailTemplateForm mode="edit" {...props} />;
}
