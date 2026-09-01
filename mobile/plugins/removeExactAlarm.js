const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = withAndroidManifest(config => {
  const manifest = config.modResults;
  const permissions = manifest.manifest['uses-permission'] || [];
  manifest.manifest['uses-permission'] = permissions.filter(p => {
    const name = p.$?.['android:name'] || '';
    return !name.includes('EXACT_ALARM');
  });
  return config;
});
