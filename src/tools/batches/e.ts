import { named, type Loader } from '../loader'

export const loadersE: Record<string, Loader> = {
  'hmac-generator': named(() => import('../developer/Security'), 'HmacGenerator'),
  'password-strength-checker': named(() => import('../developer/Security'), 'PasswordStrengthChecker'),
  'passphrase-generator': named(() => import('../developer/Security'), 'PassphraseGenerator'),
  'remove-duplicate-words': named(() => import('../text/Fun'), 'RemoveDuplicateWords'),
  'fancy-text-generator': named(() => import('../text/Fun'), 'FancyTextGenerator'),
  'small-text-generator': named(() => import('../text/Fun'), 'SmallTextGenerator'),
  'pig-latin-translator': named(() => import('../text/Fun'), 'PigLatinTranslator'),
  'text-to-speech': named(() => import('../text/Fun'), 'TextToSpeech'),
}
