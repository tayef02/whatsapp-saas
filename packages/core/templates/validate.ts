// সহজ ব্যালান্স চেক — spintax/variable ব্র্যাকেট মিসম্যাচ থাকলে সেভের আগে ধরিয়ে দেয়
export function validateTemplateBraces(content: string): string | null {
  const openCount = (content.match(/\{/g) ?? []).length;
  const closeCount = (content.match(/\}/g) ?? []).length;

  if (openCount !== closeCount) {
    return "{ আর } ব্র্যাকেট সমান সংখ্যক না — টেমপ্লেটে কোথাও ভুল আছে";
  }

  const doubleOpen = (content.match(/\{\{/g) ?? []).length;
  const doubleClose = (content.match(/\}\}/g) ?? []).length;

  if (doubleOpen !== doubleClose) {
    return "{{ আর }} (ভেরিয়েবল) ব্র্যাকেট সমান সংখ্যক না";
  }

  return null;
}
