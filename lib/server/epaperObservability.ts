import 'server-only';

type MetricValue = string | number | boolean | null | undefined | string[] | number[];

export function logEpaperMetric(
  event: string,
  fields: Record<string, MetricValue> = {}
) {
  console.info(
    JSON.stringify({
      type: 'epaper_metric',
      event,
      timestamp: new Date().toISOString(),
      ...fields,
    })
  );
}
