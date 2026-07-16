// jest-environment-jsdomにはTextEncoder/TextDecoderが無く、
// jsdomパッケージの依存関係（whatwg-url）がこれを要求するためポリフィルする
const { TextEncoder, TextDecoder } = require('util');

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
