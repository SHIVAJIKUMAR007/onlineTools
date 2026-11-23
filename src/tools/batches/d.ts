import { named, type Loader } from '../loader'

export const loadersD: Record<string, Loader> = {
  'json-diff-checker': named(() => import('../developer/BatchTools'), 'JsonDiffChecker'),
  'json-to-typescript': named(() => import('../developer/BatchTools'), 'JsonToTypeScript'),
  'csv-to-json': named(() => import('../developer/BatchTools'), 'CsvToJson'),
  'json-to-yaml': named(() => import('../developer/BatchTools'), 'JsonToYaml'),
  'xml-formatter': named(() => import('../developer/BatchTools'), 'XmlFormatter'),
  'sql-formatter': named(() => import('../developer/BatchTools'), 'SqlFormatter'),
  'cron-expression-explainer': named(() => import('../developer/BatchTools'), 'CronExplainer'),
  'fake-data-generator': named(() => import('../developer/BatchTools'), 'FakeDataGenerator'),
}
