/** Chart type identifiers supported by the chart renderer. */
export type ChartType = "bar" | "pie" | "line" | "stacked-bar" | "grouped-bar";

/** Label configuration for chart axes and legend. */
export interface ChartLabels {
  xAxis?: string;
  yAxis?: string;
  legend?: boolean;
}

/** Configuration object for rendering a single chart image. */
export interface ChartConfig {
  type: ChartType;
  title: string;
  data: Record<string, unknown>[];
  width: number;
  height: number;
  colors?: string[];
  labels?: ChartLabels;
  /** Data keys to render (e.g., ["revenue", "expense"] for grouped bar). */
  dataKeys: string[];
  /** Key in data used for category axis labels (e.g., "name", "fund"). */
  categoryKey: string;
}

/** Default color palette matching ClearGov brand. */
export const DEFAULT_CHART_COLORS = [
  "#1a365d", // primary dark blue
  "#3182ce", // accent blue
  "#38a169", // green
  "#d69e2e", // amber
  "#e53e3e", // red
  "#805ad5", // purple
  "#dd6b20", // orange
  "#319795", // teal
];

/** Default chart dimensions. */
export const DEFAULT_CHART_WIDTH = 800;
export const DEFAULT_CHART_HEIGHT = 400;
