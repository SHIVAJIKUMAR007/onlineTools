import { named, type Loader } from '../loader'

export const loadersI: Record<string, Loader> = {
  'json-viewer': named(() => import('../developer/BatchI'), 'JsonViewer'),
  'json-path-tester': named(() => import('../developer/BatchI'), 'JsonPathTester'),
  'html-formatter': named(() => import('../developer/BatchI2'), 'HtmlFormatter'),
  'aes-encrypt-decrypt': named(() => import('../developer/BatchI2'), 'AesEncryptDecrypt'),
  'unicode-converter': named(() => import('../developer/BatchI2'), 'UnicodeConverter'),
}
