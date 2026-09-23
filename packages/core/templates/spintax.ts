// spintax: {Hi|Hello|আসসালামু আলাইকুম} থেকে র‍্যান্ডম একটা অপশন বাছাই করে।
//
// গুরুত্বপূর্ণ: এই রেজেক্স ইচ্ছাকৃতভাবে {{ }} (ডাবল ব্র্যাকেট, variable syntax) ছোঁয় না —
// (?<!\{) আর (?!\}) দিয়ে নিশ্চিত করা হয়েছে যে { এর ঠিক আগে বা } এর ঠিক পরে আরেকটা
// ব্র্যাকেট থাকলে সেটা ম্যাচ হবে না। তাই এটা সবসময় variable বসানোর *আগে* চালাতে হবে —
// নাহলে কাস্টমারের নাম/ডাটায় { বা | থাকলে (যেমন কোম্পানির নাম) স্প্যাক্স ভেঙে যেতে পারে।
const SPINTAX_PATTERN = /(?<!\{)\{([^{}]+)\}(?!\})/g;

export function resolveSpintax(text: string): string {
  let result = text;

  // একাধিক পাসে resolve করলে হালকা নেস্টিং (একটার ভেতর আরেকটা স্প্যাক্স) সাপোর্ট হয়,
  // কিন্তু ইনফিনিট লুপ এড়াতে একটা সীমা রাখা আছে
  for (let pass = 0; pass < 5; pass++) {
    let changed = false;
    result = result.replace(SPINTAX_PATTERN, (_match, group: string) => {
      changed = true;
      const options = group.split("|");
      return options[Math.floor(Math.random() * options.length)];
    });
    if (!changed) break;
  }

  return result;
}
