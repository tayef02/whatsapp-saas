import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // প্রোডাকশন Docker ইমেজে শুধু দরকারি node_modules বান্ডল করে ছোট রানটাইম বানানোর জন্য
  output: "standalone",
  // monorepo তে standalone build node_modules ঠিক জায়গা থেকে ট্রেস করার জন্য রুট বলে দেওয়া লাগে
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // stateless রাখার জন্য কোনো server-side file storage ব্যবহার হবে না
  // packages/core workspace প্যাকেজ TypeScript সোর্স থেকে সরাসরি ব্যবহারের জন্য
  transpilePackages: ["@whatsapp-saas/core"],
  // bullmq সার্ভার-অনলি প্যাকেজ, bundling ছাড়া সরাসরি Node এ require হবে
  serverExternalPackages: ["bullmq"],
  // কন্টাক্ট CSV/Excel ফাইল আপলোডের জন্য ডিফল্ট ১MB limit যথেষ্ট না
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
