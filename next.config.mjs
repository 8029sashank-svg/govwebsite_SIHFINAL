/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Leaflet ships untranspiled ESM-ish bundles; keeping this explicit avoids
  // surprises if the map layer is ever moved into a server component tree.
  transpilePackages: ['react-leaflet'],
};

export default nextConfig;
