/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.externals.push("@node-rs/argon2", "@node-rs/bcrypt");
    return config;
  },

  async redirects() {
    return [
      {
        source: "/",
        destination: "/sign-in",
        permanent: false
      }
    ];
  },
};

export default nextConfig;
