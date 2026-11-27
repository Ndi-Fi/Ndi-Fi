import { loadClientConfig, readPublicEnvironment } from './config/client-config.js';

loadClientConfig(readPublicEnvironment());

const nextConfig = {};

export default nextConfig;
