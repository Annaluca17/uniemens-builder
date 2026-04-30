import { useState, useRef } from "react";

/* ═══ UTILITIES ═══ */
const uid = () => Math.random().toString(36).slice(2, 9);
const toIt = (v) => { const n = parseFloat(String(v || "0").replace(",", ".")); return isNaN(n) ? "0,00" : n.toFixed(2).replace(".", ","); };
const parseIt = (v) => { const n = parseFloat(String(v || "0").replace(",", ".")); return isNaN(n) ? 0 : n; };
const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const round2 = (v) => Math.round(v * 100) / 100;

/* ════ CUMULO MENSILITÀ HELPERS ════ */
const MESI_IT=["","Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];

function buildMonthList(from,to){
  if(!from||!to||from>to)return[];
  const[fy,fm]=from.split("-").map(Number);
  const[ty,tm]=to.split("-").map(Number);
  const out=[];let y=fy,m=fm;
  while(y<ty||(y===ty&&m<=tm)){
    out.push({year:y,month:m,annoMese:`${y}-${String(m).padStart(2,"0")}`,isDec:m===12});
    m++;if(m>12){m=1;y++;}
  }
  return out;
}

function annoDivisor(yrMonths){
  return yrMonths[0].month===1&&yrMonths[yrMonths.length-1].month===12?13:yrMonths.length;
}

function distributeToMonths(totalStr,yrMonths){
  const total=parseIt(totalStr);
  if(!total)return yrMonths.map(()=>"0,00");
  const div=annoDivisor(yrMonths);
  const base=round2(total/div);
  const amounts=yrMonths.map(m=>m.isDec&&div===13?round2(base*2):base);
  const residual=round2(total-round2(amounts.reduce((s,a)=>s+a,0)));
  if(residual!==0)amounts[amounts.length-1]=round2(amounts[amounts.length-1]+residual);
  return amounts.map(a=>toIt(String(a)));
}

function buildEvGrid(yearRows,allMonths){
  const result=[];
  for(const yr of yearRows){
    const yrMonths=allMonths.filter(m=>m.year===yr.anno);
    const D={};
    for(const f of["ImpCPDEL","ContribCPDEL","Contrib1Perc","ImpTFS","ContribTFS","ContribCredito","ImpSol","ContribSol"])
      D[f]=distributeToMonths(yr[f],yrMonths);
    yrMonths.forEach((m,i)=>result.push({
      id:uid(),annoMese:m.annoMese,isDec:m.isDec,year:m.year,
      tc1Imp:D.ImpCPDEL[i],    tc1Cont:D.ContribCPDEL[i],
      tc6Imp:D.ImpCPDEL[i],    tc6Cont:D.Contrib1Perc[i],
      tc7Imp:D.ImpTFS[i],       tc7Cont:D.ContribTFS[i],
      tc9Imp:D.ImpCPDEL[i],    tc9Cont:D.ContribCredito[i],
      tcSImp:D.ImpCPDEL[i],    tcSCont:D.ContribSol[i],
    }));
  }
  return result;
}

function initYearRows(dateFrom,dateTo){
  const months=buildMonthList(dateFrom,dateTo);
  return[...new Set(months.map(m=>m.year))].map(anno=>{
    const ym=months.filter(m=>m.year===anno);
    return{anno,meseFrom:ym[0].month,meseTo:ym[ym.length-1].month,
      divisor:annoDivisor(ym),
      ImpCPDEL:"",ContribCPDEL:"",Contrib1Perc:"",
      StipTabellare:"0,00",RetribAnzianita:"0,00",
      regimeTFS:"TFS",ImpTFS:"",ContribTFS:"",
      ContribCredito:"",ImpSol:"",ContribSol:"",
    };
  });
}

const EMPTY_INQ={dateFrom:"",dateTo:"",TipoImpiego:"1",TipoServizio:"4",
  Contratto:"RALN",Qualifica:"",hasPartTime:false,TipoPartTime:"O",
  PercPartTime:"",RegimeFineServizio:"3",CodiceCessazione:"",
  StipTabellare:"0,00",RetribAnzianita:"0,00"};


/* ════════════════════════════════════════════════════════════
   XML PARSER — importa flussi variazione e standard DMA2
════════════════════════════════════════════════════════════ */
const getTxt = (el, tag) => el?.querySelector(tag)?.textContent?.trim() || "";

function pairEVRows(evList) {
  const out = evList.map(e => ({ ...e }));
  for (const t1 of out.filter(e => e.TipoContributo === "1")) {
    const match = out.find(e =>
      e.TipoContributo === "9" &&
      e.AnnoMeseErogazione === t1.AnnoMeseErogazione &&
      e.Imponibile === t1.Imponibile &&
      !e.pairedWith
    );
    if (match) { t1.pairedTc9 = match.id; match.pairedWith = t1.id; }
  }
  return out;
}

function parseInquadramento(perEl) {
  const inq = perEl.querySelector("InquadramentoLavPA");
  if (!inq) return { TipoImpiego:"1", TipoServizio:"4", Contratto:"RALN", Qualifica:"", hasPartTime:false, TipoPartTime:"O", PercPartTime:"", RegimeFineServizio:"3" };
  const pt = inq.querySelector("PartTimePA");
  return {
    TipoImpiego: getTxt(inq,"TipoImpiego") || "1",
    TipoServizio: getTxt(inq,"TipoServizio") || "4",
    Contratto: getTxt(inq,"Contratto") || "RALN",
    Qualifica: getTxt(inq,"Qualifica") || "",
    hasPartTime: !!pt,
    TipoPartTime: pt ? getTxt(pt,"TipoPartTime") : "O",
    PercPartTime: pt ? getTxt(pt,"PercPartTime") : "",
    RegimeFineServizio: getTxt(inq,"RegimeFineServizio") || "3",
  };
}

function parseGestioni(perEl) {
  const g = { ImpCPDEL:"", ContribCPDEL:"", Contrib1Perc:"", StipTabellare:"0,00", RetribAnzianita:"0,00", regimeTFS:"TFS", ImpTFS:"", ContribTFS:"", ImpCredito:"", ContribCredito:"" };
  const gp = perEl.querySelector("GestPensionistica");
  if (gp) {
    g.ImpCPDEL = getTxt(gp,"Imponibile");
    g.ContribCPDEL = getTxt(gp,"Contributo");
    g.Contrib1Perc = getTxt(gp,"Contrib1PerCento");
    g.StipTabellare = getTxt(gp,"StipendioTabellare") || "0,00";
    g.RetribAnzianita = getTxt(gp,"RetribIndivAnzianita") || "0,00";
  }
  const gpr = perEl.querySelector("GestPrevidenziale");
  if (gpr) {
    if (getTxt(gpr,"ImponibileTFR")) { g.regimeTFS="TFR"; g.ImpTFS=getTxt(gpr,"ImponibileTFR"); g.ContribTFS=getTxt(gpr,"ContributoTFR"); }
    else { g.ImpTFS=getTxt(gpr,"ImponibileTFS"); g.ContribTFS=getTxt(gpr,"ContributoTFS"); }
  }
  const gc = perEl.querySelector("GestCredito");
  if (gc) { g.ImpCredito=getTxt(gc,"Imponibile"); g.ContribCredito=getTxt(gc,"Contributo"); }
  if (g.ImpCPDEL && !g.ImpCredito) g.ImpCredito = g.ImpCPDEL; // auto-sync
  return g;
}

function parseEVEl(evEl, cfAz, prg) {
  return {
    id: uid(),
    TipoContributo: getTxt(evEl,"TipoContributo") || "1",
    CFAzienda: getTxt(evEl,"CFAzienda") || cfAz,
    PRGAZIENDA: getTxt(evEl,"PRGAZIENDA") || prg || "00000",
    Imponibile: getTxt(evEl,"Imponibile") || "",
    Contributo: getTxt(evEl,"Contributo") || "",
    AnnoMeseErogazione: getTxt(evEl,"AnnoMeseErogazione") || "",
    Aliquota: getTxt(evEl,"Aliquota") || "2",
  };
}

function mkDefaultEVPair(cfAz, prg, impC, impG) {
  const t1id=uid(), t9id=uid();
  return [
    { id:t1id, TipoContributo:"1", CFAzienda:cfAz, PRGAZIENDA:prg||"00000", Imponibile:impC||"", Contributo:"", AnnoMeseErogazione:"", Aliquota:"2", pairedTc9:t9id },
    { id:t9id, TipoContributo:"9", CFAzienda:cfAz, PRGAZIENDA:prg||"00000", Imponibile:impG||impC||"", Contributo:"", AnnoMeseErogazione:"", Aliquota:"2", pairedWith:t1id },
  ];
}

function parsePeriodEl(el, tag, cfAz, prg) {
  const inq = parseInquadramento(el);
  const gest = parseGestioni(el);
  const causale = tag === "V1_PeriodoPrecedente" ? (el.getAttribute("CausaleVariazione") || "5") : "5";
  const evEls = el.querySelectorAll("EnteVersante");
  const evList = evEls.length > 0
    ? pairEVRows(Array.from(evEls).map(ev => parseEVEl(ev, cfAz, prg)))
    : mkDefaultEVPair(cfAz, prg, gest.ImpCPDEL, gest.ImpCredito);
  return {
    id: uid(), CausaleVariazione: causale,
    GiornoInizio: getTxt(el,"GiornoInizio"), GiornoFine: getTxt(el,"GiornoFine"),
    CodiceCessazione: getTxt(el,"CodiceCessazione"),
    ...inq, ...gest,
    enteVersante: evList,
  };
}

function parseUniEmensXML(xmlStr) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlStr, "application/xml");
  if (doc.querySelector("parsererror")) return { error: "XML non valido: struttura malformata." };

  const errors = [];
  const listaPosPA = doc.querySelector("ListaPosPA");
  const cfAz = getTxt(doc,"CFAzienda");
  const prg = listaPosPA ? getTxt(listaPosPA,"PRGAZIENDA") : "00000";
  const isVariazione = listaPosPA?.getAttribute("TipoListaPosPA") === "1";

  const mittente = {
    CFPersonaMittente: getTxt(doc,"CFPersonaMittente"),
    RagSocMittente: getTxt(doc,"RagSocMittente"),
    CFMittente: getTxt(doc,"CFMittente"),
    CFSoftwarehouse: getTxt(doc,"CFSoftwarehouse") || "00000000000",
    SedeINPS: getTxt(doc,"SedeINPS"),
  };
  const azienda = {
    AnnoMeseDenuncia: getTxt(doc,"AnnoMeseDenuncia"),
    CFAzienda: cfAz,
    RagSocAzienda: getTxt(doc,"RagSocAzienda"),
    PRGAZIENDA: prg || "00000",
    CFRappresentanteFirmatario: listaPosPA ? getTxt(listaPosPA,"CFRappresentanteFirmatario") : "",
    ISTAT: listaPosPA ? getTxt(listaPosPA,"ISTAT") : "",
    FormaGiuridica: listaPosPA ? getTxt(listaPosPA,"FormaGiuridica") : "2430",
  };

  const d0s = doc.querySelectorAll("D0_DenunciaIndividuale");
  if (d0s.length === 0) errors.push("Nessun blocco D0_DenunciaIndividuale trovato nel file.");

  const workers = Array.from(d0s).map(d0 => {
    const cf = getTxt(d0,"CFLavoratore");
    if (!cf) errors.push(`Worker senza CFLavoratore: ${getTxt(d0,"Cognome")} ${getTxt(d0,"Nome")}`);
    const v1s = Array.from(d0.querySelectorAll("V1_PeriodoPrecedente"));
    const e0s = Array.from(d0.querySelectorAll("E0_DatiRetributivi"));
    const periodoEls = v1s.length > 0 ? { els: v1s, tag: "V1_PeriodoPrecedente" } : { els: e0s, tag: "E0_DatiRetributivi" };
    if (periodoEls.els.length === 0) errors.push(`${cf || "?"}: nessun periodo trovato, importata solo anagrafica.`);
    return {
      id: uid(),
      CFLavoratore: cf,
      Cognome: getTxt(d0,"Cognome"),
      Nome: getTxt(d0,"Nome"),
      CodiceComune: getTxt(d0,"CodiceComune"),
      CAP: getTxt(d0,"CAP"),
      periodi: periodoEls.els.map(el => parsePeriodEl(el, periodoEls.tag, cfAz, prg)),
    };
  });

  return { mittente, azienda, isVariazione, workers, errors };
}


/* ════════════════════════════════════════════════════════════
   XML BUILDER — unico PosPA (fix 00124I)
════════════════════════════════════════════════════════════ */
function buildXML(m, a, dips) {
  let x = `<?xml version="1.0" encoding="UTF-8"?>\n<DenunceMensili>\n`;
  x += `   <DatiMittente Tipo="1">\n      <CFPersonaMittente>${esc(m.CFPersonaMittente)}</CFPersonaMittente>\n      <RagSocMittente>${esc(m.RagSocMittente)}</RagSocMittente>\n      <CFMittente>${esc(m.CFMittente)}</CFMittente>\n      <CFSoftwarehouse>${esc(m.CFSoftwarehouse)}</CFSoftwarehouse>\n      <SedeINPS>${esc(m.SedeINPS)}</SedeINPS>\n   </DatiMittente>\n`;
  x += `   <Azienda>\n      <AnnoMeseDenuncia>${esc(a.AnnoMeseDenuncia)}</AnnoMeseDenuncia>\n      <CFAzienda>${esc(a.CFAzienda)}</CFAzienda>\n      <RagSocAzienda>${esc(a.RagSocAzienda)}</RagSocAzienda>\n`;
  x += `      <ListaPosPA TipoListaPosPA="1">\n          <PRGAZIENDA>${esc(a.PRGAZIENDA || "00000")}</PRGAZIENDA>\n          <CFRappresentanteFirmatario>${esc(a.CFRappresentanteFirmatario)}</CFRappresentanteFirmatario>\n          <ISTAT>${esc(a.ISTAT)}</ISTAT>\n          <FormaGiuridica>${esc(a.FormaGiuridica)}</FormaGiuridica>\n`;
  x += `          <PosPA>\n`;
  for (const d of dips) {
    x += `              <D0_DenunciaIndividuale>\n`;
    x += `                  <CFLavoratore>${esc(d.CFLavoratore)}</CFLavoratore>\n                  <Cognome>${esc(d.Cognome)}</Cognome>\n                  <Nome>${esc(d.Nome)}</Nome>\n`;
    x += `                  <DatiSedeLavoro>\n                      <CodiceComune>${esc(d.CodiceComune)}</CodiceComune>\n                      <CAP>${esc(d.CAP)}</CAP>\n                  </DatiSedeLavoro>\n`;
    for (const p of d.periodi) {
      x += `                  <V1_PeriodoPrecedente CausaleVariazione="${esc(p.CausaleVariazione)}">\n`;
      x += `                      <GiornoInizio>${esc(p.GiornoInizio)}</GiornoInizio>\n                      <GiornoFine>${esc(p.GiornoFine)}</GiornoFine>\n`;
      x += `                      <InquadramentoLavPA>\n                          <TipoImpiego>${esc(p.TipoImpiego)}</TipoImpiego>\n                          <TipoServizio>${esc(p.TipoServizio)}</TipoServizio>\n                          <Contratto>${esc(p.Contratto)}</Contratto>\n                          <Qualifica>${esc(p.Qualifica)}</Qualifica>\n`;
      if (p.hasPartTime) x += `                          <PartTimePA>\n                              <TipoPartTime>${esc(p.TipoPartTime)}</TipoPartTime>\n                              <PercPartTime>${esc(p.PercPartTime)}</PercPartTime>\n                          </PartTimePA>\n`;
      x += `                          <RegimeFineServizio>${esc(p.RegimeFineServizio)}</RegimeFineServizio>\n                      </InquadramentoLavPA>\n`;
      x += `                      <Gestioni>\n`;
      if (p.ImpCPDEL) {
        x += `                          <GestPensionistica>\n                              <CodGestione>2</CodGestione>\n                              <Imponibile>${toIt(p.ImpCPDEL)}</Imponibile>\n                              <Contributo>${toIt(p.ContribCPDEL)}</Contributo>\n`;
        if (p.Contrib1Perc) x += `                              <Contrib1PerCento>${toIt(p.Contrib1Perc)}</Contrib1PerCento>\n`;
        x += `                              <StipendioTabellare>${toIt(p.StipTabellare)}</StipendioTabellare>\n                              <RetribIndivAnzianita>${toIt(p.RetribAnzianita)}</RetribIndivAnzianita>\n                          </GestPensionistica>\n`;
      }
      if (p.ImpTFS) {
        const T = p.regimeTFS === "TFR" ? "TFR" : "TFS";
        x += `                          <GestPrevidenziale>\n                              <CodGestione>6</CodGestione>\n                              <Imponibile${T}>${toIt(p.ImpTFS)}</Imponibile${T}>\n                              <Contributo${T}>${toIt(p.ContribTFS)}</Contributo${T}>\n                          </GestPrevidenziale>\n`;
      }
      if (p.ImpCredito) {
        x += `                          <GestCredito>\n                              <CodGestione>9</CodGestione>\n                              <Imponibile>${toIt(p.ImpCredito)}</Imponibile>\n                              <Contributo>${toIt(p.ContribCredito)}</Contributo>\n                          </GestCredito>\n`;
      }
      x += `                      </Gestioni>\n`;
      if (p.CodiceCessazione) x += `                      <CodiceCessazione>${esc(p.CodiceCessazione)}</CodiceCessazione>\n`;
      for (const ev of p.enteVersante) {
        if (!ev.AnnoMeseErogazione) continue; // GYearMonth non accetta stringa vuota → skip (00AMEV)
        x += `                      <EnteVersante>\n                          <TipoContributo>${esc(ev.TipoContributo)}</TipoContributo>\n                          <CFAzienda>${esc(ev.CFAzienda)}</CFAzienda>\n                          <PRGAZIENDA>${esc(ev.PRGAZIENDA || "00000")}</PRGAZIENDA>\n                          <Imponibile>${toIt(ev.Imponibile)}</Imponibile>\n                          <Contributo>${toIt(ev.Contributo)}</Contributo>\n                          <AnnoMeseErogazione>${esc(ev.AnnoMeseErogazione)}</AnnoMeseErogazione>\n                          <Aliquota>${esc(ev.Aliquota || "2")}</Aliquota>\n                      </EnteVersante>\n`;
      }
      x += `                  </V1_PeriodoPrecedente>\n`;
    }
    x += `              </D0_DenunciaIndividuale>\n`;
  }
  x += `          </PosPA>\n      </ListaPosPA>\n   </Azienda>\n</DenunceMensili>`;
  return x;
}

/* ════ DEDUP ════ */
function deduplicateEV(dips) {
  let count = 0;
  const out = dips.map(d => ({
    ...d,
    periodi: d.periodi.map(p => {
      const seen = new Set();
      const ev = p.enteVersante.filter(e => {
        const k = `${e.TipoContributo}|${e.CFAzienda}|${e.PRGAZIENDA}|${e.Imponibile}|${e.Contributo}|${e.AnnoMeseErogazione}`;
        if (seen.has(k)) { count++; return false; }
        seen.add(k); return true;
      });
      return { ...p, enteVersante: ev };
    }),
  }));
  return { dips: out, count };
}

/* ════ VALIDATION ════ */
function validateAll(dips) {
  const warns = [];
  for (const d of dips) {
    for (const p of d.periodi) {
      if (!p.ImpCPDEL) continue;
      // AnnoMeseErogazione vuoto → GYearMonth XSD failure
      const evEmpty = p.enteVersante.filter(e => !e.AnnoMeseErogazione);
      if (evEmpty.length > 0) warns.push({ code: "AMEV", who: `${d.Cognome} ${d.Nome}`, period: `${p.GiornoInizio} → ${p.GiornoFine}`, val: String(evEmpty.length), limit: "—", excess: "—", field: `${evEmpty.length} riga/e EV senza AnnoMeseErogazione — escluse dall'XML (GYearMonth non accetta stringa vuota)` });
      // 00172I: sum TC1+TC5 contributi > ContribCPDEL + Contrib1%
      const sumContribTC1 = round2(p.enteVersante.filter(e => e.TipoContributo === "1" || e.TipoContributo === "5").reduce((s, e) => s + parseIt(e.Contributo), 0));
      const limitContrib = round2(parseIt(p.ContribCPDEL) + parseIt(p.Contrib1Perc));
      if (sumContribTC1 > limitContrib + 0.005) warns.push({ code: "00172I", who: `${d.Cognome} ${d.Nome}`, period: `${p.GiornoInizio} → ${p.GiornoFine}`, val: toIt(String(sumContribTC1)), limit: toIt(String(limitContrib)), excess: toIt(String(round2(sumContribTC1 - limitContrib))), field: "Contributo TC1 EV vs CPDEL+1%" });
      // 00171I: sum TC1 imponibili > GestPensionistica.Imponibile
      const sumImpTC1 = round2(p.enteVersante.filter(e => e.TipoContributo === "1").reduce((s, e) => s + parseIt(e.Imponibile), 0));
      const impCPDEL = parseIt(p.ImpCPDEL);
      if (sumImpTC1 > impCPDEL + 0.005) warns.push({ code: "00171I", who: `${d.Cognome} ${d.Nome}`, period: `${p.GiornoInizio} → ${p.GiornoFine}`, val: toIt(String(sumImpTC1)), limit: toIt(p.ImpCPDEL), excess: toIt(String(round2(sumImpTC1 - impCPDEL))), field: "Imponibile TC1 EV vs GestPensionistica" });
      // 00032I: sum TC9 imponibili > GestCredito.Imponibile
      if (p.ImpCredito) {
        const sumImpTC9 = round2(p.enteVersante.filter(e => e.TipoContributo === "9").reduce((s, e) => s + parseIt(e.Imponibile), 0));
        const impCred = parseIt(p.ImpCredito);
        if (sumImpTC9 > impCred + 0.005) warns.push({ code: "00032I", who: `${d.Cognome} ${d.Nome}`, period: `${p.GiornoInizio} → ${p.GiornoFine}`, val: toIt(String(sumImpTC9)), limit: toIt(p.ImpCredito), excess: toIt(String(round2(sumImpTC9 - impCred))), field: "Imponibile TC9 EV vs GestCredito" });
      }
    }
  }
  return warns;
}

/* ════════════════════════════════════════════════════════════
   PDF GENERATOR — apre finestra di stampa formattata
════════════════════════════════════════════════════════════ */
function generatePDF(m, a, dips) {
  const TC_LABEL = { "1": "CPDEL", "2": "C.Ins.", "3": "C.San.", "5": "Agg.spec.", "6": "Agg.1%", "7": "TFS/INADEL", "8": "Cred.45/07", "9": "Fondo Cred." };
  const now = new Date().toLocaleString("it-IT");

  let html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>UniEmens Variazione — ${a.CFAzienda}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:10px;color:#111;margin:20px}
  h1{font-size:14px;margin:0 0 4px}
  h2{font-size:11px;margin:12px 0 4px;color:#003366;border-bottom:1px solid #003366;padding-bottom:2px}
  h3{font-size:10px;margin:8px 0 3px;color:#005588}
  .meta{font-size:9px;color:#555;margin-bottom:14px}
  table{width:100%;border-collapse:collapse;margin-bottom:6px;font-size:9px}
  th{background:#003366;color:#fff;padding:3px 5px;text-align:left}
  td{padding:2px 5px;border-bottom:1px solid #ddd;vertical-align:top}
  .num{text-align:right;font-family:monospace}
  .section{background:#f0f4f8;padding:6px 8px;margin-bottom:6px;border-left:3px solid #003366}
  .dip-block{border:1px solid #ccc;padding:8px;margin-bottom:10px;page-break-inside:avoid}
  .warn{background:#fff3cd;border:1px solid #ffc107;padding:4px 6px;margin-bottom:4px;font-size:9px}
  .ok{background:#d4edda;border:1px solid #28a745;padding:4px 6px;margin-bottom:4px;font-size:9px}
  .sum-row{background:#e8f0fe;font-weight:bold}
  .over{background:#fde8e8;color:#c00}
  @media print{body{margin:10px}.dip-block{page-break-inside:avoid}}
</style></head><body>`;

  html += `<h1>UniEmens Variazione — Rendiconto Lavorazione</h1>`;
  html += `<div class="meta">Generato: ${now} &nbsp;|&nbsp; Ente: <strong>${esc(a.RagSocAzienda)}</strong> (${esc(a.CFAzienda)}) &nbsp;|&nbsp; Periodo: <strong>${esc(a.AnnoMeseDenuncia)}</strong> &nbsp;|&nbsp; Dipendenti: ${dips.length} &nbsp;|&nbsp; Totale V1: ${dips.reduce((s,d)=>s+d.periodi.length,0)}</div>`;

  // Intestazione
  html += `<h2>Intestazione</h2>`;
  html += `<div class="section">`;
  html += `<table><tr><th>Campo</th><th>Valore</th></tr>`;
  [["CF Persona Mittente", m.CFPersonaMittente],["Ragione Sociale Mittente", m.RagSocMittente],["CF Mittente", m.CFMittente],["CF Softwarehouse", m.CFSoftwarehouse],["Sede INPS", m.SedeINPS],["Anno-Mese Denuncia", a.AnnoMeseDenuncia],["CF Azienda", a.CFAzienda],["Ragione Sociale Ente", a.RagSocAzienda],["PRGAZIENDA", a.PRGAZIENDA],["CF Rappresentante Firmatario", a.CFRappresentanteFirmatario],["ISTAT", a.ISTAT],["Forma Giuridica", a.FormaGiuridica]].forEach(([l,v]) => {
    html += `<tr><td>${esc(l)}</td><td><strong>${esc(v||"—")}</strong></td></tr>`;
  });
  html += `</table></div>`;

  // Dipendenti
  html += `<h2>Dipendenti e Quadri V1</h2>`;
  for (const d of dips) {
    html += `<div class="dip-block">`;
    html += `<h3>${esc(d.Cognome)} ${esc(d.Nome)} &nbsp;|&nbsp; CF: <strong>${esc(d.CFLavoratore)}</strong> &nbsp;|&nbsp; Comune: ${esc(d.CodiceComune)} &nbsp;|&nbsp; CAP: ${esc(d.CAP)}</h3>`;
    for (const p of d.periodi) {
      const sumImpTC1 = round2(p.enteVersante.filter(e=>e.TipoContributo==="1").reduce((s,e)=>s+parseIt(e.Imponibile),0));
      const sumImpTC9 = round2(p.enteVersante.filter(e=>e.TipoContributo==="9").reduce((s,e)=>s+parseIt(e.Imponibile),0));
      const sumContribTC1 = round2(p.enteVersante.filter(e=>e.TipoContributo==="1"||e.TipoContributo==="5").reduce((s,e)=>s+parseIt(e.Contributo),0));
      const limitContrib = round2(parseIt(p.ContribCPDEL)+parseIt(p.Contrib1Perc));
      const impOk1 = !p.ImpCPDEL || sumImpTC1 <= parseIt(p.ImpCPDEL)+0.005;
      const impOk9 = !p.ImpCredito || sumImpTC9 <= parseIt(p.ImpCredito)+0.005;
      const cOk = !p.ImpCPDEL || sumContribTC1 <= limitContrib+0.005;

      html += `<div style="margin:6px 0 4px;font-size:9px"><strong>V1 causale ${esc(p.CausaleVariazione)}</strong> &nbsp; ${esc(p.GiornoInizio)} \u2192 ${esc(p.GiornoFine)}${p.CodiceCessazione ? ` &nbsp; Cessazione: ${esc(p.CodiceCessazione)}` : ""}</div>`;

      // Inquadramento
      html += `<table><tr><th>TipoImpiego</th><th>TipoServizio</th><th>Contratto</th><th>Qualifica</th><th>Regime FS</th>${p.hasPartTime?`<th>Part-time</th><th>%PT</th>`:""}</tr>`;
      html += `<tr><td>${esc(p.TipoImpiego)}</td><td>${esc(p.TipoServizio)}</td><td>${esc(p.Contratto)}</td><td>${esc(p.Qualifica)}</td><td>${esc(p.RegimeFineServizio)}</td>${p.hasPartTime?`<td>${esc(p.TipoPartTime)}</td><td>${esc(p.PercPartTime)}</td>`:""}</tr></table>`;

      // Gestioni
      html += `<table><tr><th>Gestione</th><th class="num">Imponibile</th><th class="num">Contributo</th><th class="num">Contrib.1%</th><th class="num">Stip.Tab.</th><th class="num">Anz.</th></tr>`;
      if (p.ImpCPDEL) html += `<tr><td>CPDEL (cod.2)</td><td class="num">${toIt(p.ImpCPDEL)}</td><td class="num">${toIt(p.ContribCPDEL)}</td><td class="num">${toIt(p.Contrib1Perc)||"—"}</td><td class="num">${toIt(p.StipTabellare)}</td><td class="num">${toIt(p.RetribAnzianita)}</td></tr>`;
      if (p.ImpTFS) html += `<tr><td>${p.regimeTFS} (cod.6)</td><td class="num">${toIt(p.ImpTFS)}</td><td class="num">${toIt(p.ContribTFS)}</td><td class="num">—</td><td class="num">—</td><td class="num">—</td></tr>`;
      if (p.ImpCredito) html += `<tr><td>Fondo Credito (cod.9)</td><td class="num">${toIt(p.ImpCredito)}</td><td class="num">${toIt(p.ContribCredito)}</td><td class="num">—</td><td class="num">—</td><td class="num">—</td></tr>`;
      html += `</table>`;

      // EnteVersante
      html += `<table><tr><th>TC</th><th>CF Azienda</th><th>PRGAZIENDA</th><th class="num">Imponibile</th><th class="num">Contributo</th><th>AnnoMese Erog.</th><th>Aliq.</th></tr>`;
      for (const ev of p.enteVersante) {
        html += `<tr><td>${esc(ev.TipoContributo)} – ${TC_LABEL[ev.TipoContributo]||""}</td><td>${esc(ev.CFAzienda)}</td><td>${esc(ev.PRGAZIENDA)}</td><td class="num">${toIt(ev.Imponibile)}</td><td class="num">${toIt(ev.Contributo)}</td><td>${esc(ev.AnnoMeseErogazione)}</td><td>${esc(ev.Aliquota)}</td></tr>`;
      }
      // Righe di totale con semaforo
      if (p.ImpCPDEL) {
        html += `<tr class="sum-row ${!impOk1?'over':''}"><td colspan="3"><strong>Σ Imponibile TC1 EV</strong> ${!impOk1?'⚠ 00171I ECCESSO':''}</td><td class="num"><strong>${toIt(String(sumImpTC1))}</strong></td><td class="num"></td><td colspan="2">${p.ImpCPDEL?`GestPens.Imp: ${toIt(p.ImpCPDEL)}`:""}</td></tr>`;
        if (p.ImpCredito) html += `<tr class="sum-row ${!impOk9?'over':''}"><td colspan="3"><strong>Σ Imponibile TC9 EV</strong> ${!impOk9?'⚠ 00032I ECCESSO':''}</td><td class="num"><strong>${toIt(String(sumImpTC9))}</strong></td><td class="num"></td><td colspan="2">${p.ImpCredito?`GestCred.Imp: ${toIt(p.ImpCredito)}`:""}</td></tr>`;
        html += `<tr class="sum-row ${!cOk?'over':''}"><td colspan="3"><strong>Σ Contributo TC1 EV</strong> ${!cOk?'⚠ 00172I ECCESSO':''}</td><td class="num"></td><td class="num"><strong>${toIt(String(sumContribTC1))}</strong></td><td colspan="2">${p.ContribCPDEL?`Limite CPDEL+1%: ${toIt(String(limitContrib))}`:""}</td></tr>`;
      }
      html += `</table>`;
    }
    html += `</div>`;
  }

  // Riepilogo generale
  html += `<h2>Riepilogo Congruità EV</h2>`;
  const allWarns = validateAll(dips);
  if (allWarns.length === 0) {
    html += `<div class="ok">✓ Nessuna anomalia rilevata. Tutti i totali EnteVersante sono congruenti con le gestioni dichiarate.</div>`;
  } else {
    for (const w of allWarns) {
      html += `<div class="warn">⚠ <strong>${esc(w.code)}</strong> — ${esc(w.who)} — ${esc(w.period)}<br>${esc(w.field)}: Somma EV = <strong>${esc(w.val)}</strong> | Limite = <strong>${esc(w.limit)}</strong> | Eccesso = <strong>${esc(w.excess)}</strong></div>`;
    }
  }
  html += `<div style="margin-top:20px;font-size:8px;color:#999;border-top:1px solid #ddd;padding-top:6px">UniEmens Variazione Builder v3 — ${now}</div>`;
  html += `</body></html>`;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 600);
}

/* ════ STYLES ════
   Palette: Immedia S.p.A. design system
   Primary  #00AEEF  brand cyan
   Navy     #1E2939  dark surfaces
   Ocean    #0369A1  interactive mid-blue
   Gold     #C48820  accent sparingly
═══════════════════════════════════════════ */
const PALETTE = {
  light: {
    appBg: "#F9FAFB",
    bodyText: "#334155",
    hdrBg: "#1E2939",
    hdrBorder: "2px solid #00AEEF33",
    hdrTitle: "#FFFFFF",
    hdrSub: "#C8D6E5",
    tabsBg: "#FFFFFF",
    tabsBorder: "#D9E3EC",
    tabOn: "#0369A1",
    tabOff: "#6A7282",
    bodyPadBg: "#F3F7FA",
    secBg: "#FFFFFF",
    secBorder: "#E5E7EB",
    secShadow: "0 4px 12px rgba(0,0,0,0.06)",
    sectionTitle: "#0369A1",
    sectionRule: "#D9E3EC",
    label: "#6A7282",
    inputBg: "#FFFFFF",
    inputBorder: "#CBD5E1",
    inputText: "#334155",
    inputShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
    inputGreenBg: "#F0FDF4",
    inputGreenBorder: "#86EFAC",
    inputGreenText: "#166534",
    inputRedBg: "#FEF2F2",
    inputRedBorder: "#FCA5A5",
    inputRedText: "#991B1B",
    buttonBaseBg: "#E2E8F0",
    buttonBaseText: "#334155",
    cardBg: "#FFFFFF",
    cardBorder: "#E5E7EB",
    cardHeadBg: "#F8FAFC",
    subBg: "#F8FBFD",
    subBorder: "#E2E8F0",
    subTitle: "#0369A1",
    thBg: "#EFF6FF",
    thColor: "#4A5565",
    thDangerBg: "#FFF1F2",
    thDangerColor: "#9F1239",
    tdBorder: "#E6EDF3",
    sumOk: "#F0FDF4",
    sumOver: "#FEF2F2",
    sumUnder: "#FFFBEB",
    badgeText: "#FFFFFF",
    empty: "#94A3B8",
    alertErrBg: "#FEF2F2",
    alertErrBorder: "#FCA5A5",
    alertErrText: "#991B1B",
    alertOkBg: "#F0FDF4",
    alertOkBorder: "#86EFAC",
    alertOkText: "#166534",
    alertWarnBg: "#FFFBEB",
    alertWarnBorder: "#FCD34D",
    alertWarnText: "#92400E",
    modalOverlay: "rgba(15,23,42,0.32)",
    modalBg: "#FFFFFF",
    modalBorder: "#D6EAF8",
    monoText: "#334155",
    xmlBg: "#FFFFFF",
    xmlBorder: "#CBD5E1",
    xmlText: "#166534",
    stickyBg: "#F8FBFD",
    stickyText: "#0369A1",
    helperGreen: "#15803D",
    congrBg: "#F8FBFD",
    congrBorder: "#D6EAF8",
    congrHeadBg: "#EAF4FB",
    congrHeadText: "#0369A1",
    footText: "#6A7282",
    ok: "#22C55E",
    okSoft: "#166534",
    warn: "#F59E0B",
    warnSoft: "#92400E",
    err: "#EF4444",
    errSoft: "#991B1B",
    focus: "#2563EB"
  },
  dark: {
    appBg: "#182736",
    bodyText: "#DCE8F2",
    hdrBg: "#1E2939",
    hdrBorder: "2px solid #00AEEF33",
    hdrTitle: "#32C5F4",
    hdrSub: "#B7C7D3",
    tabsBg: "#142232",
    tabsBorder: "#3B6078",
    tabOn: "#42C8F0",
    tabOff: "#8DA4B8",
    bodyPadBg: "#111C28",
    secBg: "#182837",
    secBorder: "#3F647C",
    secShadow: "0 6px 18px rgba(0,0,0,0.10)",
    sectionTitle: "#43C7EF",
    sectionRule: "#3B6078",
    label: "#AFC0CD",
    inputBg: "#1B2C3A",
    inputBorder: "#4B6A80",
    inputText: "#F2F7FB",
    inputShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
    inputGreenBg: "#0F2018",
    inputGreenBorder: "#1F7A4A",
    inputGreenText: "#D6FAE3",
    inputRedBg: "#241010",
    inputRedBorder: "#9A3333",
    inputRedText: "#FEE2E2",
    buttonBaseBg: "#20303F",
    buttonBaseText: "#DCE8F2",
    cardBg: "#182736",
    cardBorder: "#30536F",
    cardHeadBg: "#1B2A39",
    subBg: "#1A2B39",
    subBorder: "#406379",
    subTitle: "#59CDEA",
    thBg: "#203442",
    thColor: "#A9BED0",
    thDangerBg: "#2B1414",
    thDangerColor: "#D29A9A",
    tdBorder: "#3B6078",
    sumOk: "#102418",
    sumOver: "#2B1414",
    sumUnder: "#30250F",
    badgeText: "#FFFFFF",
    empty: "#90A5B8",
    alertErrBg: "#241010",
    alertErrBorder: "#9A3333",
    alertErrText: "#FEE2E2",
    alertOkBg: "#0F2018",
    alertOkBorder: "#1F7A4A",
    alertOkText: "#D6FAE3",
    alertWarnBg: "#2A2110",
    alertWarnBorder: "#B45309",
    alertWarnText: "#FDE68A",
    modalOverlay: "rgba(6,12,18,0.74)",
    modalBg: "#1A2A38",
    modalBorder: "#4D7188",
    monoText: "#DCE8F2",
    xmlBg: "#152431",
    xmlBorder: "#3A617B",
    xmlText: "#D7F3E2",
    stickyBg: "#1A2836",
    stickyText: "#59CDEA",
    helperGreen: "#9BE5B8",
    congrBg: "#1B2B38",
    congrBorder: "#3B6078",
    congrHeadBg: "#203442",
    congrHeadText: "#54CAE9",
    footText: "#A9C0CF",
    ok: "#86EFAC",
    okSoft: "#BBF7D0",
    warn: "#FBBF24",
    warnSoft: "#FDE68A",
    err: "#F87171",
    errSoft: "#FECACA",
    focus: "#51A2FF"
  }
};

const T = PALETTE[theme] || PALETTE.light;

const C = {
  app: { fontFamily:"Inter,Segoe UI,system-ui,sans-serif", fontSize:"14px", background:T.appBg, color:T.bodyText, minHeight:"100vh", display:"flex", flexDirection:"column" },
  hdr: { background:T.hdrBg, borderBottom:T.hdrBorder, padding:"13px 20px", display:"flex", alignItems:"center", gap:12 },
  hdrT: { fontSize:"19px", fontWeight:800, color:T.hdrTitle, letterSpacing:"-0.015em", textShadow:"0 0 0 rgba(0,0,0,0)" },
  hdrS: { fontSize:"12px", color:T.hdrSub, marginTop:4, letterSpacing:"0.03em" },
  tabs:{ display:"flex", background:T.tabsBg, borderBottom:`1px solid ${T.tabsBorder}` },
  tab:(a)=>({ padding:"12px 20px", cursor:"pointer", fontSize:"14px", fontWeight:700, border:"none", background:"transparent", color:a ? T.tabOn : T.tabOff, borderBottom:a ? `2px solid ${T.tabOn}` : "2px solid transparent", letterSpacing:"0.01em", transition:"color 150ms" }),
  body:{ flex:1, overflowY:"auto", padding:"18px 20px", background:T.bodyPadBg },
  sec: { background:T.secBg, border:`1px solid ${T.secBorder}`, borderRadius:10, padding:"18px 20px", marginBottom:18, boxShadow:T.secShadow },
  sT: { fontSize:"12px", fontWeight:800, color:T.sectionTitle, textTransform:"uppercase", letterSpacing:"1.3px", marginBottom:13, paddingBottom:8, borderBottom:`1px solid ${T.sectionRule}` },
  row: { display:"flex", flexWrap:"wrap", gap:14, marginBottom:12 },
  lbl: { fontSize:"12px", color:T.label, textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:6, display:"block", fontWeight:700 },
  inp: { background:T.inputBg, border:`1px solid ${T.inputBorder}`, borderRadius:8, color:T.inputText, padding:"9px 12px", fontSize:"14px", fontFamily:"Inter, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", outline:"none", width:"100%", boxSizing:"border-box", boxShadow:T.inputShadow },
  inpG: { background:T.inputGreenBg, border:`1px solid ${T.inputGreenBorder}`, borderRadius:8, color:T.inputGreenText, padding:"9px 12px", fontSize:"14px", fontFamily:"Inter, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", outline:"none", width:"100%", boxSizing:"border-box", boxShadow:T.inputShadow },
  inpR: { background:T.inputRedBg, border:`1px solid ${T.inputRedBorder}`, borderRadius:8, color:T.inputRedText, padding:"9px 12px", fontSize:"14px", fontFamily:"Inter, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", outline:"none", width:"100%", boxSizing:"border-box", boxShadow:T.inputShadow },
  sel: { background:T.inputBg, border:`1px solid ${T.inputBorder}`, borderRadius:8, color:T.inputText, padding:"9px 12px", fontSize:"14px", outline:"none", width:"100%", boxSizing:"border-box", boxShadow:T.inputShadow },
  btn:(v="d")=>({ padding:"8px 15px", borderRadius:8, border:"none", cursor:"pointer", fontSize:"13px", fontWeight:600, letterSpacing:"0.02em", background:v==="p"?"#0369A1":v==="s"?"#166534":v==="x"?"#991B1B":v==="w"?"#92400E":v==="pdf"?"#4F46E5":v==="imp"?"#0F766E":v==="cum"?"#7C3AED":T.buttonBaseBg, color:v==="p"||v==="pdf"||v==="cum"?"#FFFFFF":v==="s"?"#ECFDF5":v==="x"?"#FEF2F2":v==="w"?"#FFFBEB":v==="imp"?"#F0FDFA":T.buttonBaseText }),
  card: { background:T.cardBg, border:`1px solid ${T.cardBorder}`, borderRadius:8, marginBottom:10, overflow:"hidden" },
  cHdr: { padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", background:T.cardHeadBg },
  cBody: { padding:"15px 16px" },
  sub: { background:T.subBg, border:`1px solid ${T.subBorder}`, borderRadius:8, padding:"13px 15px", marginBottom:13 },
  subT: { fontSize:"11px", fontWeight:800, color:T.subTitle, textTransform:"uppercase", letterSpacing:"1.2px", marginBottom:10 },
  th: { background:T.thBg, padding:"8px 10px", textAlign:"left", color:T.thColor, fontWeight:800, fontSize:"12px", borderBottom:`1px solid ${T.sectionRule}`, whiteSpace:"nowrap" },
  thR: { background:T.thDangerBg, padding:"8px 10px", textAlign:"right", color:T.thDangerColor, fontWeight:800, fontSize:"12px", borderBottom:`1px solid ${T.sectionRule}`, whiteSpace:"nowrap" },
  td: { padding:"8px 8px", borderBottom:`1px solid ${T.tdBorder}`, verticalAlign:"top" },
  tdR: { padding:"8px 8px", borderBottom:`1px solid ${T.tdBorder}`, verticalAlign:"top", textAlign:"right", fontFamily:"Inter, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontVariantNumeric:"tabular-nums", fontSize:"13px", fontWeight:600 },
  sumRow:(s)=>({ background:s==="over"?T.sumOver:s==="under"?T.sumUnder:T.sumOk, fontWeight:700 }),
  bdg:(c)=>({ background:c+"28", color:T.badgeText, padding:"3px 10px", borderRadius:9999, fontSize:"11px", fontWeight:700, fontFamily:"Inter, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", whiteSpace:"nowrap" }),
  mono: { fontFamily:"Inter, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize:"12px", fontVariantNumeric:"tabular-nums", color:T.monoText },
  empty: { textAlign:"center", color:T.empty, padding:36, fontSize:"13px", fontStyle:"italic" },
  alert:(t="w")=>({ background:t==="e"?T.alertErrBg:t==="o"?T.alertOkBg:T.alertWarnBg, border:`1px solid ${t==="e"?T.alertErrBorder:t==="o"?T.alertOkBorder:T.alertWarnBorder}`, borderRadius:8, padding:"12px 15px", marginBottom:12, fontSize:"12px", lineHeight:1.7, color:t==="e"?T.alertErrText:t==="o"?T.alertOkText:T.alertWarnText }),
  modal: { position:"fixed", inset:0, background:T.modalOverlay, backdropFilter:"blur(3px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:"20px" },
  modalBox: { background:T.modalBg, border:`1px solid ${T.modalBorder}`, borderRadius:12, padding:"28px 32px", maxWidth:440, width:"92%", boxShadow:"0 22px 60px rgba(0,0,0,0.16)" }
};


