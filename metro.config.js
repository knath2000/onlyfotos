const { getDefaultConfig } = require('expo/metro-config');
const { exclusionList } = require('metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.blockList = exclusionList([/\\.server-cache\\/.*/]);

module.exports = config;
