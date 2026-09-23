import { resolveSpintax } from "./spintax";
import { renderTemplateVariables, type RenderContact } from "./variables";

// টেমপ্লেট থেকে আসল পাঠানোর মেসেজ বানানোর একমাত্র জায়গা — ক্রমটা গুরুত্বপূর্ণ:
// আগে spintax (কাস্টমারের ডাটা স্পর্শ করার আগেই), তারপর variables বসানো হয়।
// প্রিভিউ (module ৪) আর আসল ক্যাম্পেইন পাঠানো (module ৫) দুটোই এই ফাংশন ব্যবহার করবে।
export function renderMessage(template: string, contact: RenderContact): string {
  const withSpintaxResolved = resolveSpintax(template);
  return renderTemplateVariables(withSpintaxResolved, contact);
}
