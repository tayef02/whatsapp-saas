"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Tag, X } from "lucide-react";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell, Badge, Button, useToast } from "@/components/ui";
import { formatDhakaDate } from "@/lib/format-date";
import { bulkAddTag, bulkRemoveTag } from "./actions";

type Contact = {
  id: string;
  phone: string;
  name: string | null;
  tags: string[];
  opted_out: boolean;
  created_at: string;
};

const TAG_VARIANTS: Array<"success" | "warning" | "danger" | "info" | "neutral"> = ["success", "info", "warning", "neutral", "danger"];

// একই ট্যাগ সবসময় একই রঙ পায় (স্ট্রিং হ্যাশ করে ফিক্সড প্যালেট থেকে বাছা) — এলোমেলো রঙ পরিবর্তন এড়াতে
function tagVariant(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) % TAG_VARIANTS.length;
  return TAG_VARIANTS[hash];
}

export default function ContactsTable({ contacts }: { contacts: Contact[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkTag, setBulkTag] = useState("");
  const [busy, setBusy] = useState(false);

  const allSelected = selected.length > 0 && selected.length === contacts.length;

  function toggleAll() {
    setSelected(allSelected ? [] : contacts.map((c) => c.id));
  }

  function toggleOne(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleBulk(action: "add" | "remove") {
    if (!bulkTag.trim()) {
      showToast("error", "ট্যাগ লিখুন");
      return;
    }
    setBusy(true);
    const res = action === "add" ? await bulkAddTag(selected, bulkTag) : await bulkRemoveTag(selected, bulkTag);
    setBusy(false);
    if (res.error) {
      showToast("error", res.error);
      return;
    }
    showToast("success", action === "add" ? "ট্যাগ যোগ করা হয়েছে" : "ট্যাগ মুছে ফেলা হয়েছে");
    setBulkTag("");
    setSelected([]);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary-light bg-primary-light px-3 py-2">
          <span className="text-sm font-medium text-primary">{selected.length} জন সিলেক্ট করা হয়েছে</span>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <input
              value={bulkTag}
              onChange={(e) => setBulkTag(e.target.value)}
              placeholder="ট্যাগের নাম"
              className="w-40 rounded-lg border border-border px-3 py-1.5 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <Button variant="secondary" disabled={busy} onClick={() => handleBulk("add")}>
              <Tag className="h-3.5 w-3.5" /> যোগ করুন
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => handleBulk("remove")}>
              মুছুন
            </Button>
            <button onClick={() => setSelected([])} className="ml-auto text-text-muted hover:text-text" aria-label="সিলেকশন বাতিল">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <Table>
        <TableHead>
          <TableRow className="hover:bg-transparent">
            <TableHeaderCell className="w-10">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4" aria-label="সব সিলেক্ট করুন" />
            </TableHeaderCell>
            <TableHeaderCell>নাম</TableHeaderCell>
            <TableHeaderCell>নাম্বার</TableHeaderCell>
            <TableHeaderCell>ট্যাগ</TableHeaderCell>
            <TableHeaderCell>স্ট্যাটাস</TableHeaderCell>
            <TableHeaderCell>যোগ হয়েছে</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {contacts.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <input
                  type="checkbox"
                  checked={selected.includes(c.id)}
                  onChange={() => toggleOne(c.id)}
                  className="h-4 w-4"
                  aria-label={`${c.name ?? c.phone} সিলেক্ট করুন`}
                />
              </TableCell>
              <TableCell>
                <Link href={`/dashboard/contacts/${c.id}`} className="font-medium text-text hover:text-primary hover:underline">
                  {c.name || "(নাম নেই)"}
                </Link>
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">{c.phone}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {c.tags.map((t) => (
                    <Badge key={t} variant={tagVariant(t)}>
                      {t}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>{c.opted_out ? <Badge variant="danger">opt-out</Badge> : <Badge variant="success">সক্রিয়</Badge>}</TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">{formatDhakaDate(c.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
