import { store } from '../../state/store.js';

export function renderLegend() {
  return `<div class="legend-line">
    <span class="lbl">COLOR POR HORAS</span>
    <div class="li"><span class="border-chip" style="background-color:#1D9E75;border-color:#1D9E75"></span>0h (Libre)</div>
    <div class="li"><span class="border-chip" style="background-color:#A32D2D;border-color:#A32D2D"></span>6 horas</div>
    <div class="li"><span class="border-chip" style="background-color:#EF9F27;border-color:#EF9F27"></span>7 horas</div>
    <div class="li"><span class="border-chip" style="background-color:#378ADD;border-color:#378ADD"></span>8 horas</div>
    <div class="li"><span class="border-chip" style="background-color:var(--text-tertiary);border-color:var(--text-tertiary)"></span>Otras</div>
  </div>`;
}
