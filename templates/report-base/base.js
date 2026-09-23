/*
 * BA-Dashboard report helpers — inlined into every report at build time.
 * Exposes window.Report. Plain browser JS: no modules, no build step, and it
 * must work inside the app's sandboxed iframe (no storage, no local fetch).
 *
 * Update .claude/skills/create-report/references/helpers.md when changing this API.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- data

  function readData() {
    var node = document.getElementById('report-data');
    if (!node) return {};
    try {
      return JSON.parse(node.textContent || '{}');
    } catch (error) {
      console.error('report-data is not valid JSON', error);
      return {};
    }
  }

  var data = readData();
  var meta = Object.assign(
    { title: document.title, subtitle: '', asOf: '', currency: 'USD', locale: 'en-US', source: '' },
    data.meta || {},
  );

  // ---------------------------------------------------------------- utils

  function resolveEl(el) {
    var node = typeof el === 'string' ? document.getElementById(el) : el;
    if (!node) throw new Error('Report: element not found: ' + el);
    return node;
  }

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  // Defaults underneath, the report's own option on top (arrays are replaced, not merged).
  function merge(defaults, override) {
    if (!isPlainObject(defaults) || !isPlainObject(override)) {
      return override === undefined ? defaults : override;
    }
    var out = Object.assign({}, defaults);
    Object.keys(override).forEach(function (key) {
      out[key] = merge(defaults[key], override[key]);
    });
    return out;
  }

  function asArray(value) {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function isDark() {
    var forced = document.documentElement.getAttribute('data-theme');
    if (forced === 'dark') return true;
    if (forced === 'light') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // ---------------------------------------------------------------- formatting

  function toNumber(v) {
    return typeof v === 'number' ? v : Number(v);
  }

  var fmt = {
    /** 1234567 → "1,234,567"; { compact: true } → "1.2M"; { decimals: 2 } */
    number: function (v, opts) {
      opts = opts || {};
      var n = toNumber(v);
      if (!isFinite(n)) return '–';
      return new Intl.NumberFormat(meta.locale, {
        notation: opts.compact ? 'compact' : 'standard',
        maximumFractionDigits: opts.decimals !== undefined ? opts.decimals : opts.compact ? 1 : 0,
        minimumFractionDigits: opts.decimals !== undefined && !opts.compact ? opts.decimals : 0,
      }).format(n);
    },
    /** Uses meta.currency / meta.locale; { compact: true } → "LKR 1.2M" */
    currency: function (v, opts) {
      opts = opts || {};
      var n = toNumber(v);
      if (!isFinite(n)) return '–';
      return new Intl.NumberFormat(meta.locale, {
        style: 'currency',
        currency: opts.currency || meta.currency,
        currencyDisplay: 'code',
        notation: opts.compact ? 'compact' : 'standard',
        maximumFractionDigits: opts.decimals !== undefined ? opts.decimals : opts.compact ? 1 : 0,
      })
        .format(n)
        .replace(/ /g, ' ');
    },
    /** Fraction in, percent out: 0.123 → "12.3%" */
    percent: function (v, opts) {
      opts = opts || {};
      var n = toNumber(v);
      if (!isFinite(n)) return '–';
      var d = opts.decimals !== undefined ? opts.decimals : 1;
      return new Intl.NumberFormat(meta.locale, {
        style: 'percent',
        maximumFractionDigits: d,
        minimumFractionDigits: d,
      }).format(n);
    },
    /** Accepts Date, "YYYY-MM-DD" or "YYYY-MM"; style: 'short' | 'long' | 'month' */
    date: function (v, opts) {
      opts = opts || {};
      var d = v instanceof Date ? v : parseDate(v);
      if (!d) return String(v);
      var style =
        opts.style || (typeof v === 'string' && /^\d{4}-\d{2}$/.test(v) ? 'month' : 'short');
      var options =
        style === 'month'
          ? { year: 'numeric', month: 'short' }
          : style === 'long'
            ? { year: 'numeric', month: 'long', day: 'numeric' }
            : { year: 'numeric', month: 'short', day: 'numeric' };
      return new Intl.DateTimeFormat(meta.locale, options).format(d);
    },
  };

  function parseDate(v) {
    if (typeof v !== 'string') return null;
    var m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(v);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, m[3] ? Number(m[3]) : 1);
  }

  /** Format by name: 'number' | 'currency' | 'percent' | 'date' | 'text' | a function. */
  function format(value, kind, opts) {
    if (typeof kind === 'function') return kind(value);
    if (value === null || value === undefined || value === '') return '–';
    if (kind === 'number' || kind === 'currency' || kind === 'percent' || kind === 'date') {
      return fmt[kind](value, opts);
    }
    return String(value);
  }

  // ---------------------------------------------------------------- header / footer

  /** Fills .r-header (or el) from meta: title, subtitle, "Data as of"; and .r-footer with meta.source. */
  function header(el) {
    var node = el ? resolveEl(el) : document.querySelector('.r-header');
    if (node) {
      node.textContent = '';
      node.appendChild(make('h1', '', meta.title));
      if (meta.subtitle) node.appendChild(make('p', 'r-subtitle', meta.subtitle));
      if (meta.asOf)
        node.appendChild(
          make('p', 'r-asof', 'Data as of ' + fmt.date(meta.asOf, { style: 'long' })),
        );
    }
    if (meta.title) document.title = meta.title;
    var footer = document.querySelector('.r-footer');
    if (footer && !footer.textContent.trim() && meta.source) {
      footer.textContent = 'Source: ' + meta.source;
    }
  }

  // ---------------------------------------------------------------- KPIs

  /**
   * items: [{ label, value, format: 'number'|'currency'|'percent', compact = true, decimals,
   *           delta (fraction vs previous period, e.g. 0.12), deltaLabel ('vs last month'),
   *           invert (true when lower is better) }]
   */
  function kpis(el, items) {
    var node = resolveEl(el);
    node.textContent = '';
    asArray(items).forEach(function (item) {
      var tile = make('div', 'r-kpi');
      tile.appendChild(make('div', 'r-kpi-label', item.label));
      var kind = item.format || 'number';
      var opts = { compact: item.compact !== false && kind !== 'percent', decimals: item.decimals };
      var value = make('div', 'r-kpi-value', format(item.value, kind, opts));
      if (opts.compact && kind !== 'percent')
        value.title = format(item.value, kind, { decimals: item.decimals });
      tile.appendChild(value);

      if (item.delta !== undefined && item.delta !== null && isFinite(item.delta)) {
        var flat = Math.abs(item.delta) < 0.0005;
        var up = item.delta > 0;
        var good = item.invert ? !up : up;
        var delta = make('div', 'r-kpi-delta ' + (flat ? 'is-flat' : good ? 'is-good' : 'is-bad'));
        var arrow = flat ? '■' : up ? '▲' : '▼';
        delta.appendChild(make('span', '', arrow + ' ' + fmt.percent(Math.abs(item.delta))));
        if (item.deltaLabel) delta.appendChild(make('span', 'r-kpi-delta-label', item.deltaLabel));
        delta.setAttribute(
          'aria-label',
          (flat ? 'No change' : (up ? 'Up ' : 'Down ') + fmt.percent(Math.abs(item.delta))) +
            (item.deltaLabel ? ' ' + item.deltaLabel : ''),
        );
        tile.appendChild(delta);
      }
      node.appendChild(tile);
    });
  }

  // ---------------------------------------------------------------- charts

  var charts = [];

  function palette() {
    var list = [];
    for (var i = 1; i <= 8; i++) list.push(cssVar('--r-series-' + i));
    return list;
  }

  function valueFormatter(kind) {
    if (!kind)
      return function (v) {
        return fmt.number(v, { decimals: 2 }).replace(/\.00$/, '');
      };
    return function (v) {
      return format(
        v,
        kind,
        kind === 'percent' ? {} : { decimals: kind === 'number' ? undefined : 0 },
      );
    };
  }

  function axisFormatter(kind) {
    if (kind === 'percent')
      return function (v) {
        return fmt.percent(v, { decimals: 0 });
      };
    if (kind === 'currency')
      return function (v) {
        return fmt.currency(v, { compact: true });
      };
    return function (v) {
      return fmt.number(v, { compact: Math.abs(v) >= 10000 });
    };
  }

  function axisDefaults(isCategory, kind) {
    var base = {
      axisLine: { show: isCategory, lineStyle: { color: cssVar('--r-axis'), width: 1 } },
      axisTick: { show: false },
      axisLabel: { color: cssVar('--r-muted'), fontSize: 12, hideOverlap: true },
      splitLine: {
        show: !isCategory,
        lineStyle: { color: cssVar('--r-grid'), width: 1, type: 'solid' },
      },
      nameTextStyle: { color: cssVar('--r-muted') },
    };
    if (!isCategory) base.axisLabel.formatter = axisFormatter(kind);
    return base;
  }

  function isCategoryAxis(axis) {
    return axis && (axis.type === 'category' || Array.isArray(axis.data));
  }

  function buildOption(userOption, opts) {
    var option = merge({}, userOption);
    var surface = cssVar('--r-surface');
    var series = asArray(option.series);
    var xAxes = asArray(option.xAxis);
    var yAxes = asArray(option.yAxis);
    var horizontal = yAxes.some(isCategoryAxis) && !xAxes.some(isCategoryAxis);
    var cartesian = xAxes.length > 0 || yAxes.length > 0;
    var named = series.filter(function (s) {
      return s.name;
    }).length;
    var pieLike = series.some(function (s) {
      return s.type === 'pie';
    });

    var defaults = {
      color: palette(),
      backgroundColor: 'transparent',
      animationDuration: 400,
      textStyle: { fontFamily: cssVar('--r-font') || 'system-ui', color: cssVar('--r-text-2') },
      grid: { left: 8, right: 16, top: named >= 2 ? 40 : 16, bottom: 8, containLabel: true },
      legend: {
        show: named >= 2 || (pieLike && series[0] && asArray(series[0].data).length > 1),
        top: 0,
        left: 0,
        icon: 'roundRect',
        itemWidth: 12,
        itemHeight: 12,
        textStyle: { color: cssVar('--r-text-2') },
      },
      tooltip: {
        trigger: cartesian ? 'axis' : 'item',
        axisPointer: {
          type: horizontal ? 'shadow' : 'line',
          lineStyle: { color: cssVar('--r-axis') },
        },
        backgroundColor: surface,
        borderColor: cssVar('--r-axis'),
        textStyle: { color: cssVar('--r-text'), fontSize: 13 },
        valueFormatter: valueFormatter(opts.format),
        confine: true,
      },
    };

    option = merge(defaults, option);
    if (xAxes.length) {
      option.xAxis = xAxes.map(function (a) {
        return merge(axisDefaults(isCategoryAxis(a), opts.format), a);
      });
      if (option.xAxis.length === 1) option.xAxis = option.xAxis[0];
    }
    if (yAxes.length) {
      option.yAxis = yAxes.map(function (a) {
        return merge(axisDefaults(isCategoryAxis(a), opts.format), a);
      });
      if (option.yAxis.length === 1) option.yAxis = option.yAxis[0];
    }

    option.series = series.map(function (s) {
      if (s.type === 'line') {
        return merge(
          {
            showSymbol: false,
            symbolSize: 8,
            lineStyle: { width: 2, cap: 'round', join: 'round' },
            itemStyle: { borderColor: surface, borderWidth: 2 },
            emphasis: { focus: 'series' },
            areaStyle: s.areaStyle ? { opacity: 0.1 } : undefined,
          },
          s,
        );
      }
      if (s.type === 'bar') {
        var radius = s.stack ? 0 : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0];
        return merge(
          {
            barMaxWidth: 24,
            itemStyle: { borderRadius: radius, borderColor: surface, borderWidth: s.stack ? 1 : 0 },
            emphasis: { focus: 'series' },
          },
          s,
        );
      }
      if (s.type === 'pie') {
        return merge(
          {
            radius: ['50%', '75%'],
            center: ['50%', '56%'],
            itemStyle: { borderColor: surface, borderWidth: 2, borderRadius: 4 },
            label: { color: cssVar('--r-text-2') },
          },
          s,
        );
      }
      return s;
    });
    return option;
  }

  // Derives a table (for the accessible "Table" view) from simple category/value charts.
  function tableFromOption(option, kind) {
    var series = asArray(option.series);
    if (!series.length) return null;
    if (series[0].type === 'pie') {
      return {
        columns: [
          { key: 'name', label: series[0].name || 'Name' },
          { key: 'value', label: 'Value', format: kind || 'number' },
        ],
        rows: asArray(series[0].data).map(function (d) {
          return { name: d.name, value: d.value };
        }),
      };
    }
    var catAxis =
      asArray(option.xAxis).filter(isCategoryAxis)[0] ||
      asArray(option.yAxis).filter(isCategoryAxis)[0];
    if (!catAxis || !Array.isArray(catAxis.data)) return null;
    var columns = [{ key: 'category', label: catAxis.name || 'Category' }];
    series.forEach(function (s, i) {
      columns.push({ key: 's' + i, label: s.name || 'Value', format: kind || 'number' });
    });
    var rows = catAxis.data.map(function (cat, row) {
      var r = { category: isPlainObject(cat) ? cat.value : cat };
      series.forEach(function (s, i) {
        var point = asArray(s.data)[row];
        r['s' + i] = isPlainObject(point) ? point.value : Array.isArray(point) ? point[1] : point;
      });
      return r;
    });
    return { columns: columns, rows: rows };
  }

  function addTableToggle(node, tableConfig) {
    var card = node.closest('.r-card');
    if (!card || !tableConfig) return;
    var title = card.querySelector('h2');
    var head = card.querySelector('.r-card-head');
    if (!head && title) {
      head = make('div', 'r-card-head');
      title.parentNode.insertBefore(head, title);
      var titleBox = make('div');
      titleBox.appendChild(title);
      var note = head.nextElementSibling;
      if (note && note.classList.contains('r-note')) titleBox.appendChild(note);
      head.appendChild(titleBox);
    }
    if (!head) return;
    var button = make('button', 'r-toggle', 'Table');
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    var tableBox = make('div');
    tableBox.hidden = true;
    node.parentNode.insertBefore(tableBox, node.nextSibling);
    var rendered = false;
    button.addEventListener('click', function () {
      var showTable = tableBox.hidden;
      if (showTable && !rendered) {
        table(tableBox, tableConfig);
        rendered = true;
      }
      tableBox.hidden = !showTable;
      node.hidden = showTable;
      button.textContent = showTable ? 'Chart' : 'Table';
      button.setAttribute('aria-pressed', String(showTable));
      if (!showTable)
        charts.forEach(function (c) {
          if (c.node === node) c.instance.resize();
        });
    });
    head.appendChild(button);
  }

  /**
   * Renders an ECharts option with the report theme applied underneath it.
   * opts: { format: 'number'|'currency'|'percent' (axis + tooltip values),
   *         table: false | { columns, rows } (override the auto-derived table view) }
   * Returns the ECharts instance (or null if ECharts failed to load).
   */
  function chart(el, userOption, opts) {
    opts = opts || {};
    var node = resolveEl(el);
    if (typeof window.echarts === 'undefined') {
      node.textContent = '';
      node.appendChild(
        make(
          'div',
          'r-chart-message',
          'Chart library could not be loaded. Check your connection and reload.',
        ),
      );
      return null;
    }
    var instance = window.echarts.init(node, null, { renderer: 'svg' });
    instance.setOption(buildOption(userOption, opts));
    charts.push({ node: node, instance: instance, option: userOption, opts: opts });

    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        instance.resize();
      }).observe(node);
    }
    var label = node.closest('.r-card') && node.closest('.r-card').querySelector('h2');
    node.setAttribute('role', 'img');
    if (label)
      node.setAttribute(
        'aria-label',
        label.textContent + ' (chart — use the Table button for values)',
      );

    if (opts.table !== false)
      addTableToggle(node, opts.table || tableFromOption(userOption, opts.format));
    return instance;
  }

  // ---------------------------------------------------------------- tables

  /**
   * config: { columns: [{ key, label, format, align: 'left'|'right', width }], rows,
   *           sort: { key, dir: 'asc'|'desc' }, search: boolean, pageSize: number,
   *           totals: [keys to sum in a footer row], caption }
   */
  function table(el, config) {
    var node = resolveEl(el);
    var columns = config.columns || [];
    var allRows = (config.rows || []).slice();
    var state = {
      sortKey: config.sort ? config.sort.key : null,
      sortDir: config.sort ? config.sort.dir || 'asc' : 'asc',
      query: '',
      page: 0,
    };
    var pageSize = config.pageSize || 0;

    node.textContent = '';
    var search = null;
    if (config.search) {
      search = make('input', 'r-table-search');
      search.type = 'search';
      search.placeholder = 'Filter rows…';
      search.setAttribute('aria-label', 'Filter table rows');
      search.addEventListener('input', function () {
        state.query = search.value.trim().toLowerCase();
        state.page = 0;
        render();
      });
      node.appendChild(search);
    }
    var wrap = make('div', 'r-table-wrap');
    var tableEl = make('table', 'r-table');
    if (config.caption) tableEl.appendChild(make('caption', 'r-sr-only', config.caption));
    var thead = make('thead');
    var tbody = make('tbody');
    var tfoot = make('tfoot');
    tableEl.appendChild(thead);
    tableEl.appendChild(tbody);
    tableEl.appendChild(tfoot);
    wrap.appendChild(tableEl);
    node.appendChild(wrap);
    var pager = make('div', 'r-pager');
    node.appendChild(pager);

    function isNumeric(col) {
      return col.align
        ? col.align === 'right'
        : ['number', 'currency', 'percent'].indexOf(col.format) !== -1;
    }

    var headRow = make('tr');
    columns.forEach(function (col) {
      var th = make('th', isNumeric(col) ? 'is-num' : '');
      if (col.width) th.style.width = col.width;
      th.scope = 'col';
      var button = make('button', '', col.label || col.key);
      button.type = 'button';
      button.addEventListener('click', function () {
        if (state.sortKey === col.key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        else {
          state.sortKey = col.key;
          state.sortDir = isNumeric(col) ? 'desc' : 'asc';
        }
        render();
      });
      th.appendChild(button);
      th.dataset.key = col.key;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    function compare(a, b) {
      var av = a[state.sortKey];
      var bv = b[state.sortKey];
      var result =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av === undefined || av === null ? '' : av).localeCompare(
              String(bv === undefined || bv === null ? '' : bv),
              meta.locale,
              { numeric: true },
            );
      return state.sortDir === 'asc' ? result : -result;
    }

    function render() {
      var rows = allRows;
      if (state.query) {
        rows = rows.filter(function (row) {
          return columns.some(function (col) {
            return (
              String(format(row[col.key], col.format)).toLowerCase().indexOf(state.query) !== -1
            );
          });
        });
      }
      if (state.sortKey) rows = rows.slice().sort(compare);

      Array.prototype.forEach.call(headRow.children, function (th) {
        if (th.dataset.key === state.sortKey)
          th.setAttribute('aria-sort', state.sortDir === 'asc' ? 'ascending' : 'descending');
        else th.removeAttribute('aria-sort');
      });

      var pages = pageSize ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
      state.page = Math.min(state.page, pages - 1);
      var visible = pageSize
        ? rows.slice(state.page * pageSize, (state.page + 1) * pageSize)
        : rows;

      tbody.textContent = '';
      if (!visible.length) {
        var emptyRow = make('tr');
        var cell = make(
          'td',
          'r-table-empty',
          state.query ? 'No rows match your filter.' : 'No data.',
        );
        cell.colSpan = columns.length;
        emptyRow.appendChild(cell);
        tbody.appendChild(emptyRow);
      }
      visible.forEach(function (row) {
        var tr = make('tr');
        columns.forEach(function (col) {
          tr.appendChild(
            make('td', isNumeric(col) ? 'is-num' : '', format(row[col.key], col.format)),
          );
        });
        tbody.appendChild(tr);
      });

      tfoot.textContent = '';
      if (config.totals && config.totals.length) {
        var totalRow = make('tr');
        columns.forEach(function (col, i) {
          var text = '';
          if (config.totals.indexOf(col.key) !== -1) {
            var sum = rows.reduce(function (acc, r) {
              return acc + (toNumber(r[col.key]) || 0);
            }, 0);
            text = format(sum, col.format);
          } else if (i === 0) text = 'Total';
          totalRow.appendChild(make('td', isNumeric(col) ? 'is-num' : '', text));
        });
        tfoot.appendChild(totalRow);
      }

      pager.textContent = '';
      if (pageSize && rows.length > pageSize) {
        var prev = make('button', '', 'Previous');
        prev.type = 'button';
        prev.disabled = state.page === 0;
        prev.addEventListener('click', function () {
          state.page -= 1;
          render();
        });
        var next = make('button', '', 'Next');
        next.type = 'button';
        next.disabled = state.page >= pages - 1;
        next.addEventListener('click', function () {
          state.page += 1;
          render();
        });
        pager.appendChild(
          make(
            'span',
            '',
            'Page ' + (state.page + 1) + ' of ' + pages + ' · ' + rows.length + ' rows',
          ),
        );
        pager.appendChild(prev);
        pager.appendChild(next);
      }
    }

    render();
  }

  // ---------------------------------------------------------------- theme changes

  var themeCallbacks = [];

  /** Calls cb(isDark) whenever the theme changes (app toggle or OS setting). */
  function onThemeChange(cb) {
    themeCallbacks.push(cb);
  }

  function themeChanged() {
    charts.forEach(function (c) {
      c.instance.setOption(buildOption(c.option, c.opts), { notMerge: true });
    });
    var dark = isDark();
    themeCallbacks.forEach(function (cb) {
      cb(dark);
    });
  }

  new MutationObserver(themeChanged).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', themeChanged);
  }

  window.Report = {
    data: data,
    meta: meta,
    fmt: fmt,
    format: format,
    colors: palette,
    isDark: isDark,
    header: header,
    kpis: kpis,
    chart: chart,
    table: table,
    onThemeChange: onThemeChange,
  };
})();
