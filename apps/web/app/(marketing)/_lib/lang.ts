// ভাষা: ডিফল্ট English, কুকি দিয়ে বাংলায় বদলানো যায়। এই ফাইলে next/headers নেই, তাই ক্লায়েন্ট
// কম্পোনেন্ট (LanguageToggle) নিরাপদে ইম্পোর্ট করতে পারে — সার্ভার-সাইড পড়া get-lang.ts এ
export type Lang = "en" | "bn";
export const LANG_COOKIE = "gz_lang";
export const DEFAULT_LANG: Lang = "en";
