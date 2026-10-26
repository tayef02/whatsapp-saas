// ইমেইল কন্টাক্ট ইম্পোর্টের ধ্রুবক (WhatsApp এর contacts/constants.ts থেকে আলাদা, মান একই ধাঁচের)

// এর কম রো হলে সরাসরি request এ প্রসেস হয়, বেশি হলে queue দিয়ে worker এ (timeout এড়াতে)
export const EMAIL_SYNC_IMPORT_ROW_THRESHOLD = 3000;

export const EMAIL_MAX_IMPORT_FILE_SIZE_BYTES = 15 * 1024 * 1024;

export const EMAIL_IMPORTS_BUCKET = "email-imports";

// এক কলে কতগুলো ঠিকানা DB তে পাঠানো হয় (import_email_contacts_batch)। ১০০০ এর অনেক নিচে রাখা
// হয়েছে যাতে রিকোয়েস্ট বডি ছোট থাকে; PostgREST এর ১০০০-রো সীমা এখানে প্রযোজ্য না কারণ ফাংশন রো ফেরত দেয় না
export const EMAIL_IMPORT_BATCH_SIZE = 500;

// স্কিপ-রো লেখার ব্যাচ (insert এ রো ফেরত চাই না, তাই বড় ব্যাচ চলে)
export const EMAIL_SKIP_INSERT_BATCH_SIZE = 1000;

export const EMAIL_TAG_MAX_LENGTH = 50;
