const DEFAULT_CONTENT_TYPE = 'text/plain; version=0.0.4';

const escapeLabelValue = (value) => {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
};

class Registry {
  constructor() {
    this.contentType = DEFAULT_CONTENT_TYPE;
    this._metrics = new Set();
  }

  registerMetric(metric) {
    this._metrics.add(metric);
  }

  async metrics() {
    const rendered = [];
    for (const metric of this._metrics) {
      if (typeof metric.update === 'function') {
        try {
          metric.update();
        } catch (error) {
          // Ignore update errors to keep metrics endpoint resilient
        }
      }

      if (typeof metric.render === 'function') {
        const output = metric.render();
        if (output) {
          rendered.push(output);
        }
      }
    }
    return `${rendered.join('\n')}${rendered.length ? '\n' : ''}`;
  }
}

class Histogram {
  constructor({ name, help, labelNames = [], buckets = [0.1, 0.5, 1, 5], registers = [] }) {
    this.name = name;
    this.help = help;
    this.labelNames = labelNames;
    this.buckets = [...new Set([...buckets].sort((a, b) => a - b))];
    this.series = new Map();

    registers.forEach((register) => {
      if (register && typeof register.registerMetric === 'function') {
        register.registerMetric(this);
      }
    });
  }

  _labelsKey(labels) {
    return this.labelNames.map((label) => `${label}:${labels[label] ?? ''}`).join('|');
  }

  startTimer() {
    const start = process.hrtime.bigint();
    return (labels = {}) => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1e9;
      this.observe(labels, duration);
    };
  }

  observe(labels = {}, value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return;
    }

    const key = this._labelsKey(labels);
    if (!this.series.has(key)) {
      this.series.set(key, {
        labels: { ...labels },
        values: [],
        sum: 0,
      });
    }

    const entry = this.series.get(key);
    entry.values.push(value);
    entry.sum += value;
  }

  render() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];

    for (const [, entry] of this.series.entries()) {
      const orderedValues = [...entry.values].sort((a, b) => a - b);
      const labelPairs = this.labelNames
        .map((label) => `${label}="${escapeLabelValue(entry.labels[label])}"`)
        .join(',');

      let cumulative = 0;
      let valueIndex = 0;

      for (const bucket of this.buckets) {
        while (valueIndex < orderedValues.length && orderedValues[valueIndex] <= bucket) {
          cumulative += 1;
          valueIndex += 1;
        }

        const labelsSuffix = labelPairs ? `${labelPairs},le="${bucket}"` : `le="${bucket}"`;
        lines.push(`${this.name}_bucket{${labelsSuffix}} ${cumulative}`);
      }

      const totalCount = orderedValues.length;
      const infSuffix = labelPairs ? `${labelPairs},le="+Inf"` : 'le="+Inf"';
      lines.push(`${this.name}_bucket{${infSuffix}} ${totalCount}`);

      const sumSuffix = labelPairs ? `{${labelPairs}}` : '';
      lines.push(`${this.name}_sum${sumSuffix} ${entry.sum}`);
      lines.push(`${this.name}_count${sumSuffix} ${totalCount}`);
    }

    return lines.join('\n');
  }
}

class Gauge {
  constructor({ name, help, labelNames = [], registers = [] }) {
    this.name = name;
    this.help = help;
    this.labelNames = labelNames;
    this.series = new Map();

    registers.forEach((register) => {
      if (register && typeof register.registerMetric === 'function') {
        register.registerMetric(this);
      }
    });
  }

  _labelsKey(labels) {
    return this.labelNames.map((label) => `${label}:${labels[label] ?? ''}`).join('|');
  }

  set(labels = {}, value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return;
    }

    const key = this._labelsKey(labels);
    this.series.set(key, { labels: { ...labels }, value });
  }

  inc(labels = {}, value = 1) {
    const key = this._labelsKey(labels);
    const current = this.series.get(key)?.value ?? 0;
    this.set(labels, current + value);
  }

  dec(labels = {}, value = 1) {
    this.inc(labels, -value);
  }

  render() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} gauge`];
    for (const [, entry] of this.series.entries()) {
      const labelPairs = this.labelNames
        .map((label) => `${label}="${escapeLabelValue(entry.labels[label])}"`)
        .join(',');
      const suffix = labelPairs ? `{${labelPairs}}` : '';
      lines.push(`${this.name}${suffix} ${entry.value}`);
    }
    return lines.join('\n');
  }
}

function collectDefaultMetrics({ register, prefix = '' } = {}) {
  if (register && typeof register.registerMetric === 'function') {
    const uptimeMetricName = `${prefix}${prefix && !prefix.endsWith('_') ? '_' : ''}process_uptime_seconds`;
    const uptimeGauge = new Gauge({
      name: uptimeMetricName,
      help: 'Node.js process uptime in seconds',
      registers: [register],
    });

    uptimeGauge.update = () => {
      uptimeGauge.set({}, Math.round(process.uptime()));
    };
  }
}

module.exports = {
  Registry,
  Histogram,
  Gauge,
  collectDefaultMetrics,
};
