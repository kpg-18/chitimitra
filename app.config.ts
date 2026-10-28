import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const [owner, repository] = process.env.GITHUB_REPOSITORY?.split('/') ?? [];
  const isUserOrOrganizationSite = repository === `${owner}.github.io`;
  const baseUrl = repository && !isUserOrOrganizationSite ? `/${repository}` : '';

  return {
    ...config,
    name: config.name ?? 'Chiti Mitra',
    slug: config.slug ?? 'jpg',
    web: {
      ...config.web,
      output: 'static',
    },
    experiments: {
      ...config.experiments,
      baseUrl,
    },
  };
};
