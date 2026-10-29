import type { NextConfig } from "next";

// 告别站：整站导出成静态文件，部署在 Vercel（vercel.json 管安全头和老地址的跳转）。
const nextConfig: NextConfig = {
  output: "export",
};

export default nextConfig;
