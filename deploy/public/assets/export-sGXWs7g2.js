function l(c,n,a){const r=o=>`"${String(o??"").replace(/"/g,'""')}"`,s=[n,...a].map(o=>o.map(r).join(",")).join(`
`),d=new Blob(["\uFEFF"+s],{type:"text/csv;charset=utf-8;"}),t=URL.createObjectURL(d),e=document.createElement("a");e.href=t,e.download=c,document.body.appendChild(e),e.click(),document.body.removeChild(e),URL.revokeObjectURL(t)}export{l as e};
