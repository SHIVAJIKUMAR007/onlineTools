import { named, type Loader } from '../loader'

export const loadersJ: Record<string, Loader> = {
  'markdown-to-html': named(() => import('../developer/BatchJ'), 'MarkdownToHtml'),
  'json-to-xml': named(() => import('../developer/BatchJ'), 'JsonToXml'),
  'random-token-generator': named(() => import('../developer/BatchJ'), 'RandomTokenGenerator'),
  'bulk-timestamp-converter': named(() => import('../developer/BatchJ'), 'BulkTimestampConverter'),
  'emoji-picker': named(() => import('../utilities/BatchJEmoji'), 'EmojiPicker'),
}
