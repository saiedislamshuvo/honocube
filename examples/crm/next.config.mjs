/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@honocube/api",
    "@honocube/app",
    "@honocube/ui",
    "lucide-react",
  ],
};

export default nextConfig;
