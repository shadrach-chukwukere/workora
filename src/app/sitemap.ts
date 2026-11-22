// Sitemap configuration for next-sitemap
// This generates a sitemap with all the important pages

const routes = ['', '/pricing', '/about', '/find-work', '/find-talent', '/categories', '/contact', '/terms', '/privacy'];

export default function generateSitemap() {
  return routes.map((route) => ({
    url: route,
    lastmod: new Date(),
    changefreq: route === '' ? 'daily' : 'yearly',
    priority: route === '' ? 1.0 : route.includes('/pricing') ? 0.8 : 0.5,
  }));
}