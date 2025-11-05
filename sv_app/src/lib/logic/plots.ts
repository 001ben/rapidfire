import type { TableHeader } from "$lib/logic/types";

export function getDefaultPlotSpec(cols: TableHeader[], viewName: string, fill: string | undefined) {
  console.log("cols", cols);
  if (cols.length === 2 && cols.every(c => ['Int', 'Float', "Decimal"].includes(c.type))) {
    // scatter plot for 2 numerics
  return `
vg.vconcat(
  vg.plot(
    vg.dot(vg.from("${viewName}"), { 
      x: "${cols[0].name}", 
      y: "${cols[1].name}",
      r: 6,
      tip: true,
      ${fill ? `fill: "${fill}",` : ''}
    }),
    vg.name("${viewName}_plot"),
    vg.width(width),
    vg.height(height),
    vg.marginLeft(60),
    vg.yLabelAnchor("top")
  ), ${fill ? `
  vg.colorLegend({for: "${viewName}_plot"}),` : ''}
)`
  } else if (cols.length === 1 && ['Int', 'Float', "Decimal"].includes(cols[0].type)) {
    // histogram for 1 number
    let plot_spec = `p
`;
    return `
const $bandwidth = vg.Param.value(20);
vg.vconcat(
  vg.slider({label: "Bandwidth (σ)", as: $bandwidth, min: 0.1, max: 200, step: 0.1}),
  vg.plot(
    vg.densityY(vg.from("${viewName}"), { 
      x: "${cols[0].name}",
      bandwidth: $bandwidth,
      fill: ${fill ? `"${fill}"` : '"steelblue"'},
      opacity: 0.8,
      tip: true,
    }),
    vg.name("${viewName}_plot"),
    vg.width(width),
    vg.height(height),
  ), ${ fill ? `
  vg.colorLegend({for: '${viewName}_plot'}),` : ''
  }
)`;
  } else if (cols.length === 1 && ['Date', 'Time', 'Timestamp'].includes(cols[0].type)) {
    // histogram for 1 datetime
    return `
vg.vconcat(
  vg.plot(
    vg.lineY(vg.from("${viewName}"), {
      x: { value: "${cols[0].name}", type: "time", timeUnit: "day" },
      y: vg.count(),
      stroke: "${fill ? fill : 'steelblue'}",
      marker: "circle",
      tip: true,
    }),
    vg.name("${viewName}_plot"),
    vg.width(width),
    vg.height(height),
  ), ${ fill ? `
  vg.colorLegend({for: '${viewName}_plot'}),` : ''
  }
)`;
  } else {
    // default case - 1 column (or first column) bar bar chart e.g. group count
    return `
vg.vconcat(
  vg.plot(
    vg.barX(vg.from("${viewName}"), { 
      x: vg.count(), 
      y: "${cols[0].name}", 
      fill: "${fill ? fill : cols[0].name}",
      sort: {y: "-x", limit: 25},
      tip: true,
    }),
    vg.name("${viewName}_plot"),
    vg.width(width),
    vg.height(height),
    vg.marginLeft(60),
    vg.yLabelAnchor("top")
  ),
  vg.colorLegend({for: "${viewName}_plot"})
)`;    
  }
}