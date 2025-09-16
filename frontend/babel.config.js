module.exports = {
    presets: ['babel-preset-expo'],
    plugins: [
      // NOTE: This must be listed last per Reanimated docs
      'react-native-reanimated/plugin',
    ],
};
