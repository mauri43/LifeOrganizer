module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module:react-native-dotenv', {
        moduleName: '@env',
        path: '.env',
        safe: false,
        allowUndefined: true,
      }],
      // TEMPORARILY DISABLED: causes crash in Expo Go with forced New Architecture
      // 'react-native-reanimated/plugin',
    ],
  };
};
