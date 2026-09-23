import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // stateless রাখার জন্য কোনো server-side file storage ব্যবহার হবে না
  // packages/core workspace প্যাকেজ TypeScript সোর্স থেকে সরাসরি ব্যবহারের জন্য
  transpilePackages: ["@whatsapp-saas/core"],
  // bullmq সার্ভার-অনলি প্যাকেজ, bundling ছাড়া সরাসরি Node এ require হবে
  serverExternalPackages: ["bullmq"],
};

export default nextConfig;
