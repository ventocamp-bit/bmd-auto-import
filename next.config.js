/** @type {import('next').NextConfig} */
const nextConfig = {
    outputFileTracingIncludes: {
        '/api/*': ['./templates/**/*'],
    },
};

module.exports = nextConfig;
