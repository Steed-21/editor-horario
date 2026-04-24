import { store } from '../../state/store.js';

export function renderLegend() {
  const bl = `<div class="legend-line"><span class="lbl">Borde (horas)</span><div class="li"><span class="border-chip" style="border-color:#1D9E75"></span>Libre</div><div class="li"><span class="border-chip" style="border-color:#A32D2D"></span>6h</div><div class="li"><span class="border-chip" style="border-color:#EF9F27"></span>7h</div><div class="li"><span class="border-chip" style="border-color:#378ADD"></span>8h</div></div>`;
  const ids = Object.keys(store.SH);
  const bgMap = {
    tM: '#E1F5EE', tM2: '#C0DD97', tT: '#E6F1FB', tC: '#EEEDFE', tCF: '#CECBF6',
    tW: '#FCEBEB', tW2: '#F7C1C1', tS: '#EAF3DE', tPRE: '#FAEEDA', tPRE2: '#FAC775',
    tPOST: '#FAECE7', tOFF: '#F1EFE8', tCUSTOM: '#F1EFE8'
  };
  
  const fl = ids.map(id => {
    const sh = store.SH[id];
    const lb = id === 'OFF' ? 'Libre' : `${sh.start}–${sh.end === 24 ? '24' : sh.end}`;
    return `<div class="li"><span class="dot" style="background:${bgMap[sh.cls] || '#F1EFE8'}"></span>${id} ${lb}</div>`;
  }).join('');
  
  return bl + `<div class="legend-line"><span class="lbl">Fondo (turno)</span>${fl}</div>`;
}
