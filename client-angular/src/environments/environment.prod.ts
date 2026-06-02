export const environment = {
  production: true,
  // v1.65gG — when true, app.routes.ts only registers the public
  // welcome + brief routes; everything else redirects to /welcome.
  // Lets us ship the full bundle to prod without exposing the
  // authenticated app surface to anonymous visitors.
  marketingOnly: true,
  apiUrl: 'https://theballpark-production.up.railway.app/api',
  version: '[Prod] v1.65gG',
  supabaseUrl: '',
  supabaseAnonKey: '',
  storageBucketProjects: 'project-assets',
  storageBucketSuppliers: 'supplier-assets',
};
