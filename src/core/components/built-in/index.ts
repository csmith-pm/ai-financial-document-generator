/**
 * Built-in components — registers all standard components in the default registry.
 *
 * Import this module to populate the defaultComponentRegistry with all built-in
 * visual components. Components are registered once at module load time.
 */

import { defaultComponentRegistry } from "../registry.js";
import { narrativeBlockComponent } from "./narrative-block.js";
import { financialTableComponent } from "./financial-table.js";
import {
  barChartComponent,
  pieChartComponent,
  lineChartComponent,
  stackedBarChartComponent,
  groupedBarChartComponent,
} from "./chart.js";
import { statCardComponent } from "./stat-card.js";
import { coverPageComponent } from "./cover-page.js";
import { tocComponent } from "./toc.js";

const BUILT_IN_COMPONENTS = [
  narrativeBlockComponent,
  financialTableComponent,
  barChartComponent,
  pieChartComponent,
  lineChartComponent,
  stackedBarChartComponent,
  groupedBarChartComponent,
  statCardComponent,
  coverPageComponent,
  tocComponent,
];

for (const component of BUILT_IN_COMPONENTS) {
  defaultComponentRegistry.register(component);
}

export {
  narrativeBlockComponent,
  financialTableComponent,
  barChartComponent,
  pieChartComponent,
  lineChartComponent,
  stackedBarChartComponent,
  groupedBarChartComponent,
  statCardComponent,
  coverPageComponent,
  tocComponent,
  BUILT_IN_COMPONENTS,
};
