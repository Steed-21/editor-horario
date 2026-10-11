import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
const zones = ['UTC', 'Europe/Madrid', 'America/Caracas', 'Pacific/Kiritimati'];
const expected = {
  mondays: ['2026-10-05', '2026-10-05', '2026-10-05', '2026-10-05', '2026-10-05', '2026-10-05', '2026-10-05', '2026-10-12'],
  range: ['05/10', '06/10', '07/10', '08/10', '09/10', '10/10', '11/10'],
  spring: ['30/03', '31/03', '01/04', '02/04', '03/04', '04/04', '05/04'],
  autumn: ['26/10', '27/10', '28/10', '29/10', '30/10', '31/10', '01/11']
};
it.each(zones)('uses identical civil results and the local initial calendar in %s', zone => {
  const script = `
    import { getMonday, getDatesForWeek } from './src/domain/dateUtils.js';
    const result = {
      mondays: ['05','06','07','08','09','10','11','12'].map(day => getMonday('2026-10-' + day)),
      range: getDatesForWeek('2026-10-05', 0).map(d => d.str),
      spring: getDatesForWeek('2026-03-23', 1).map(d => d.str),
      autumn: getDatesForWeek('2026-10-19', 1).map(d => d.str)
    };
    const OriginalDate = Date;
    globalThis.Date = class extends OriginalDate {
      constructor(...args) { super(...(args.length ? args : [OriginalDate.UTC(2026, 9, 4, 22, 30)])); }
    };
    result.current = getMonday();
    process.stdout.write(JSON.stringify(result));
  `;
  const result = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: process.cwd(), env: { ...process.env, TZ: zone }, encoding: 'utf8' }));
  const current = zone === 'UTC' || zone === 'America/Caracas' ? '2026-09-28' : '2026-10-05';
  expect(result).toEqual({ ...expected, current });
});
it.each(zones)('loads and navigates saved civil weeks with real rendering in %s', zone => {
  const output = execFileSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'src/controllers/dateNavigation.test.js', '--maxWorkers=1', '--minWorkers=1'], { cwd: process.cwd(), env: { ...process.env, TZ: zone }, encoding: 'utf8', timeout: 30000 });
  expect(output).toMatch(/Tests\s+\d+ passed/);
});
