export const DEFAULT_SHIFTS = {
  M: {id:'M', abbr:'M', cls:'tM', start:9, end:17, defaultBs:13, name:'Mañana', builtin:true},
  M2: {id:'M2', abbr:'M2', cls:'tM2', start:10, end:18, defaultBs:14, name:'Mañana+1', builtin:true},
  T: {id:'T', abbr:'T', cls:'tT', start:12, end:20, defaultBs:16, name:'Tarde', builtin:true},
  C: {id:'C', abbr:'C', cls:'tC', start:15, end:23, defaultBs:19, name:'Cierre', builtin:true},
  CF: {id:'CF', abbr:'CF', cls:'tCF', start:16, end:24, defaultBs:20, name:'Cierre V/S', builtin:true},
  W: {id:'W', abbr:'W', cls:'tW', start:9, end:18, defaultBs:13, name:'Pico', builtin:true},
  W2: {id:'W2', abbr:'W2', cls:'tW2', start:10, end:19, defaultBs:14, name:'Pico+1', builtin:true},
  S: {id:'S', abbr:'S', cls:'tS', start:11, end:17, defaultBs:null, name:'Corto', builtin:true},
  PRE: {id:'PRE', abbr:'PRE', cls:'tPRE', start:9, end:15, defaultBs:null, name:'Pre-libre', builtin:true},
  PRE2: {id:'PRE2', abbr:'PRE2', cls:'tPRE2', start:10, end:16, defaultBs:null, name:'Pre-libre+1', builtin:true},
  POST: {id:'POST', abbr:'POST', cls:'tPOST', start:17, end:23, defaultBs:null, name:'Post-libre', builtin:true},
  POSTF: {id:'POSTF', abbr:'POSTF', cls:'tPOST', start:18, end:24, defaultBs:null, name:'Post-libre V/S', builtin:true},
  OFF: {id:'OFF', abbr:'Libre', cls:'tOFF', start:0, end:0, defaultBs:null, name:'Libre', builtin:true}
};
