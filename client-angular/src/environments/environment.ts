export const environment = {
  production: false,
  marketingOnly: false,
  apiUrl: 'http://localhost:3001/api',
  version: '[Dev] v1.68',
  supabaseUrl: '',
  supabaseAnonKey: '',
  storageBucketProjects: 'dev-project-assets',
  storageBucketSuppliers: 'dev-supplier-assets',
  // Cloudflare Turnstile site key (public — safe to commit).
  // Hostnames configured in Cloudflare: preview.theballpark.ai,
  // theballpark.ai, localhost. v1.65gZ29.
  turnstileSiteKey: '0x4AAAAAADdwdzIjm6NbpAXD',
};
