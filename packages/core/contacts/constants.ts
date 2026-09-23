// এর কম রো হলে সরাসরি request এ প্রসেস হয়, বেশি হলে queue দিয়ে ব্যাকগ্রাউন্ডে (timeout এড়াতে)
export const SYNC_IMPORT_ROW_THRESHOLD = 3000;

export const MAX_IMPORT_FILE_SIZE_BYTES = 15 * 1024 * 1024;

export const CONTACT_IMPORTS_BUCKET = "contact-imports";
