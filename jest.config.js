// Jestの設定ファイル
module.exports = {
  // カバレッジ計測を有効にする
  collectCoverage: true,
  // カバレッジレポートの出力形式（lcov: HTML/CI連携用、text: コンソール表示用）
  coverageReporters: ['lcov', 'text'],
  // カバレッジ計測の対象ファイル
  collectCoverageFrom: [
    'src/**/*.js',
    'public/**/*.js',
    '!**/node_modules/**',
  ],
  // カバレッジレポートの出力先ディレクトリ
  coverageDirectory: 'coverage',

  // バックエンド（Node環境）とフロントエンド（jsdom環境）でテスト環境を分ける
  projects: [
    {
      displayName: 'backend',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/src/**/*.test.js',
        '<rootDir>/__tests__/routes/**/*.test.js',
      ],
    },
    {
      displayName: 'frontend',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/public/**/*.test.js',
        '<rootDir>/__tests__/frontend/**/*.test.js',
      ],
      setupFiles: ['<rootDir>/jest.setup.js'],
    },
  ],
};
