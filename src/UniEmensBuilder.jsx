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
  StipTabellare:"0,00",RetribAnzianita:"0,00",
  RetribTeoricaTabellareTFR:"0,00",ImponibileTFRUlterioriElem:"0,00",RetribValutabileTFR:"0,00"};


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
  const g = {
    ImpCPDEL:"", ContribCPDEL:"", Contrib1Perc:"",
    StipTabellare:"0,00", RetribAnzianita:"0,00",
    regimeTFS:"TFS", ImpTFS:"", ContribTFS:"",
    ImpCredito:"", ContribCredito:"",
    RetribTeoricaTabellareTFR:"0,00",
    ImponibileTFRUlterioriElem:"0,00",
    RetribValutabileTFR:"0,00",
  };
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
    if (getTxt(gpr,"ImponibileTFR")) {
      g.regimeTFS="TFR";
      g.ImpTFS=getTxt(gpr,"ImponibileTFR");
      g.ContribTFS=getTxt(gpr,"ContributoTFR");
      g.RetribTeoricaTabellareTFR=getTxt(gpr,"RetribTeoricaTabellareTFR")||"0,00";
      g.ImponibileTFRUlterioriElem=getTxt(gpr,"ImponibileTFRUlterioriElem")||"0,00";
      g.RetribValutabileTFR=getTxt(gpr,"RetribValutabileTFR")||"0,00";
    } else {
      g.ImpTFS=getTxt(gpr,"ImponibileTFS");
      g.ContribTFS=getTxt(gpr,"ContributoTFS");
    }
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
   XML BUILDER — unico PosPA (fix 00124I) + causale 6 + TFR
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

      /* ── FIX 00126I: causale 6 = solo date, nessun altro elemento ── */
      if (p.CausaleVariazione !== "6") {
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
          x += `                          <GestPrevidenziale>\n                              <CodGestione>6</CodGestione>\n                              <Imponibile${T}>${toIt(p.ImpTFS)}</Imponibile${T}>\n                              <Contributo${T}>${toIt(p.ContribTFS)}</Contributo${T}>\n`;
          if (p.regimeTFS === "TFR") {
            x += `                              <RetribTeoricaTabellareTFR>${toIt(p.RetribTeoricaTabellareTFR)}</RetribTeoricaTabellareTFR>\n`;
            x += `                              <ImponibileTFRUlterioriElem>${toIt(p.ImponibileTFRUlterioriElem||"0,00")}</ImponibileTFRUlterioriElem>\n`;
            x += `                              <RetribValutabileTFR>${toIt(p.RetribValutabileTFR)}</RetribValutabileTFR>\n`;
          }
          x += `                          </GestPrevidenziale>\n`;
        }
        if (p.ImpCredito) {
          x += `                          <GestCredito>\n                              <CodGestione>9</CodGestione>\n                              <Imponibile>${toIt(p.ImpCredito)}</Imponibile>\n                              <Contributo>${toIt(p.ContribCredito)}</Contributo>\n                          </GestCredito>\n`;
        }
        x += `                      </Gestioni>\n`;
        if (p.CodiceCessazione) x += `                      <CodiceCessazione>${esc(p.CodiceCessazione)}</CodiceCessazione>\n`;
        for (const ev of p.enteVersante) {
          if (!ev.AnnoMeseErogazione) continue;
          x += `                      <EnteVersante>\n                          <TipoContributo>${esc(ev.TipoContributo)}</TipoContributo>\n                          <CFAzienda>${esc(ev.CFAzienda)}</CFAzienda>\n                          <PRGAZIENDA>${esc(ev.PRGAZIENDA || "00000")}</PRGAZIENDA>\n                          <Imponibile>${toIt(ev.Imponibile)}</Imponibile>\n                          <Contributo>${toIt(ev.Contributo)}</Contributo>\n                          <AnnoMeseErogazione>${esc(ev.AnnoMeseErogazione)}</AnnoMeseErogazione>\n                          <Aliquota>${esc(ev.Aliquota || "2")}</Aliquota>\n                      </EnteVersante>\n`;
        }
      }
      /* ── fine blocco causale ≠ 6 ── */

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
      const evEmpty = p.enteVersante.filter(e => !e.AnnoMeseErogazione);
      if (evEmpty.length > 0) warns.push({ code: "AMEV", who: `${d.Cognome} ${d.Nome}`, period: `${p.GiornoInizio} → ${p.GiornoFine}`, val: String(evEmpty.length), limit: "—", excess: "—", field: `${evEmpty.length} riga/e EV senza AnnoMeseErogazione — escluse dall'XML (GYearMonth non accetta stringa vuota)` });
      const sumContribTC1 = round2(p.enteVersante.filter(e => e.TipoContributo === "1" || e.TipoContributo === "5").reduce((s, e) => s + parseIt(e.Contributo), 0));
      const limitContrib = round2(parseIt(p.ContribCPDEL) + parseIt(p.Contrib1Perc));
      if (sumContribTC1 > limitContrib + 0.005) warns.push({ code: "00172I", who: `${d.Cognome} ${d.Nome}`, period: `${p.GiornoInizio} → ${p.GiornoFine}`, val: toIt(String(sumContribTC1)), limit: toIt(String(limitContrib)), excess: toIt(String(round2(sumContribTC1 - limitContrib))), field: "Contributo TC1 EV vs CPDEL+1%" });
      const sumImpTC1 = round2(p.enteVersante.filter(e => e.TipoContributo === "1").reduce((s, e) => s + parseIt(e.Imponibile), 0));
      const impCPDEL = parseIt(p.ImpCPDEL);
      if (sumImpTC1 > impCPDEL + 0.005) warns.push({ code: "00171I", who: `${d.Cognome} ${d.Nome}`, period: `${p.GiornoInizio} → ${p.GiornoFine}`, val: toIt(String(sumImpTC1)), limit: toIt(p.ImpCPDEL), excess: toIt(String(round2(sumImpTC1 - impCPDEL))), field: "Imponibile TC1 EV vs GestPensionistica" });
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
  const TC_LABEL = { "1": "CPDEL", "2": "C.Ins.", "3": "C.San.", "5": "Agg.spec.", "6": "Agg.1%", "7": "TFS/INADEL", "8": "TFR (EnteVers.)", "9": "Fondo Cred." };
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

  html += `<h2>Intestazione</h2>`;
  html += `<div class="section">`;
  html += `<table><tr><th>Campo</th><th>Valore</th></tr>`;
  [["CF Persona Mittente", m.CFPersonaMittente],["Ragione Sociale Mittente", m.RagSocMittente],["CF Mittente", m.CFMittente],["CF Softwarehouse", m.CFSoftwarehouse],["Sede INPS", m.SedeINPS],["Anno-Mese Denuncia", a.AnnoMeseDenuncia],["CF Azienda", a.CFAzienda],["Ragione Sociale Ente", a.RagSocAzienda],["PRGAZIENDA", a.PRGAZIENDA],["CF Rappresentante Firmatario", a.CFRappresentanteFirmatario],["ISTAT", a.ISTAT],["Forma Giuridica", a.FormaGiuridica]].forEach(([l,v]) => {
    html += `<tr><td>${esc(l)}</td><td><strong>${esc(v||"—")}</strong></td></tr>`;
  });
  html += `</table></div>`;

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

      html += `<div style="margin:6px 0 4px;font-size:9px"><strong>V1 causale ${esc(p.CausaleVariazione)}</strong> &nbsp; ${esc(p.GiornoInizio)} \u2192 ${esc(p.GiornoFine)}${p.CodiceCessazione ? ` &nbsp; Cessazione: ${esc(p.CodiceCessazione)}` : ""}${p.CausaleVariazione==="6"?" — ANNULLAMENTO (solo date in XML)":""}</div>`;

      if (p.CausaleVariazione !== "6") {
        html += `<table><tr><th>TipoImpiego</th><th>TipoServizio</th><th>Contratto</th><th>Qualifica</th><th>Regime FS</th>${p.hasPartTime?`<th>Part-time</th><th>%PT</th>`:""}</tr>`;
        html += `<tr><td>${esc(p.TipoImpiego)}</td><td>${esc(p.TipoServizio)}</td><td>${esc(p.Contratto)}</td><td>${esc(p.Qualifica)}</td><td>${esc(p.RegimeFineServizio)}</td>${p.hasPartTime?`<td>${esc(p.TipoPartTime)}</td><td>${esc(p.PercPartTime)}</td>`:""}</tr></table>`;

        html += `<table><tr><th>Gestione</th><th class="num">Imponibile</th><th class="num">Contributo</th><th class="num">Contrib.1%</th><th class="num">Stip.Tab.</th><th class="num">Anz.</th></tr>`;
        if (p.ImpCPDEL) html += `<tr><td>CPDEL (cod.2)</td><td class="num">${toIt(p.ImpCPDEL)}</td><td class="num">${toIt(p.ContribCPDEL)}</td><td class="num">${toIt(p.Contrib1Perc)||"—"}</td><td class="num">${toIt(p.StipTabellare)}</td><td class="num">${toIt(p.RetribAnzianita)}</td></tr>`;
        if (p.ImpTFS) {
          html += `<tr><td>${p.regimeTFS} (cod.6)</td><td class="num">${toIt(p.ImpTFS)}</td><td class="num">${toIt(p.ContribTFS)}</td><td class="num">—</td><td class="num">—</td><td class="num">—</td></tr>`;
          if (p.regimeTFS==="TFR") {
            html += `<tr><td style="padding-left:14px;color:#555">↳ RetribTeoricaTabellareTFR</td><td class="num" colspan="5">${toIt(p.RetribTeoricaTabellareTFR)}</td></tr>`;
            html += `<tr><td style="padding-left:14px;color:#555">↳ ImponibileTFRUlterioriElem</td><td class="num" colspan="5">${toIt(p.ImponibileTFRUlterioriElem)}</td></tr>`;
            html += `<tr><td style="padding-left:14px;color:#555">↳ RetribValutabileTFR (calc.)</td><td class="num" colspan="5"><strong>${toIt(p.RetribValutabileTFR)}</strong></td></tr>`;
          }
        }
        if (p.ImpCredito) html += `<tr><td>Fondo Credito (cod.9)</td><td class="num">${toIt(p.ImpCredito)}</td><td class="num">${toIt(p.ContribCredito)}</td><td class="num">—</td><td class="num">—</td><td class="num">—</td></tr>`;
        html += `</table>`;

        html += `<table><tr><th>TC</th><th>CF Azienda</th><th>PRGAZIENDA</th><th class="num">Imponibile</th><th class="num">Contributo</th><th>AnnoMese Erog.</th><th>Aliq.</th></tr>`;
        for (const ev of p.enteVersante) {
          html += `<tr><td>${esc(ev.TipoContributo)} – ${TC_LABEL[ev.TipoContributo]||""}</td><td>${esc(ev.CFAzienda)}</td><td>${esc(ev.PRGAZIENDA)}</td><td class="num">${toIt(ev.Imponibile)}</td><td class="num">${toIt(ev.Contributo)}</td><td>${esc(ev.AnnoMeseErogazione)}</td><td>${esc(ev.Aliquota)}</td></tr>`;
        }
        if (p.ImpCPDEL) {
          html += `<tr class="sum-row ${!impOk1?'over':''}"><td colspan="3"><strong>Σ Imponibile TC1 EV</strong> ${!impOk1?'⚠ 00171I ECCESSO':''}</td><td class="num"><strong>${toIt(String(sumImpTC1))}</strong></td><td class="num"></td><td colspan="2">${p.ImpCPDEL?`GestPens.Imp: ${toIt(p.ImpCPDEL)}`:""}</td></tr>`;
          if (p.ImpCredito) html += `<tr class="sum-row ${!impOk9?'over':''}"><td colspan="3"><strong>Σ Imponibile TC9 EV</strong> ${!impOk9?'⚠ 00032I ECCESSO':''}</td><td class="num"><strong>${toIt(String(sumImpTC9))}</strong></td><td class="num"></td><td colspan="2">${p.ImpCredito?`GestCred.Imp: ${toIt(p.ImpCredito)}`:""}</td></tr>`;
          html += `<tr class="sum-row ${!cOk?'over':''}"><td colspan="3"><strong>Σ Contributo TC1 EV</strong> ${!cOk?'⚠ 00172I ECCESSO':''}</td><td class="num"></td><td class="num"><strong>${toIt(String(sumContribTC1))}</strong></td><td colspan="2">${p.ContribCPDEL?`Limite CPDEL+1%: ${toIt(String(limitContrib))}`:""}</td></tr>`;
        }
        html += `</table>`;
      }
    }
    html += `</div>`;
  }

  html += `<h2>Riepilogo Congruità EV</h2>`;
  const allWarns = validateAll(dips);
  if (allWarns.length === 0) {
    html += `<div class="ok">✓ Nessuna anomalia rilevata. Tutti i totali EnteVersante sono congruenti con le gestioni dichiarate.</div>`;
  } else {
    for (const w of allWarns) {
      html += `<div class="warn">⚠ <strong>${esc(w.code)}</strong> — ${esc(w.who)} — ${esc(w.period)}<br>${esc(w.field)}: Somma EV = <strong>${esc(w.val)}</strong> | Limite = <strong>${esc(w.limit)}</strong> | Eccesso = <strong>${esc(w.excess)}</strong></div>`;
    }
  }
  html += `<div style="margin-top:20px;font-size:8px;color:#999;border-top:1px solid #ddd;padding-top:6px">UniEmens Variazione Builder v6 — ${now}</div>`;
  html += `</body></html>`;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 600);
}

/* ════ STYLES ════ */
const C = {
  app:   { fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", fontSize: "13px", background: "#F3F7FA", color: "#334155", minHeight: "100vh", display: "flex", flexDirection: "column" },
  hdr:   { background: "#1E2939", borderBottom: "2px solid #00AEEF55", padding: "11px 18px", display: "flex", alignItems: "center", gap: "12px" },
  hdrT:  { fontSize: "15px", fontWeight: "700", color: "#00AEEF", letterSpacing: "-0.01em" },
  hdrS:  { fontSize: "10px", color: "#7AAFC8", marginTop: "3px", letterSpacing: "0.02em" },
  tabs:  { display: "flex", background: "#FFFFFF", borderBottom: "1px solid #D9E3EC" },
  tab:   (a) => ({ padding: "9px 20px", cursor: "pointer", fontSize: "12px", fontWeight: "600", border: "none", background: "transparent", color: a ? "#0369A1" : "#6A7282", borderBottom: a ? "2px solid #0369A1" : "2px solid transparent", letterSpacing: "0.01em", transition: "color 150ms" }),
  body:  { flex: 1, overflowY: "auto", padding: "16px 18px", background: "#F3F7FA" },
  sec:   { background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "14px 16px", marginBottom: "14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" },
  sT:    { fontSize: "10px", fontWeight: "700", color: "#0369A1", textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: "12px", paddingBottom: "7px", borderBottom: "1px solid #D9E3EC" },
  row:   { display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "9px" },
  lbl:   { fontSize: "10px", color: "#6A7282", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "4px", display: "block", fontWeight: "600" },
  inp:   { background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: "4px", color: "#334155", padding: "5px 8px", fontSize: "12px", fontFamily: "'Courier New',monospace", outline: "none", width: "100%", boxSizing: "border-box" },
  inpG:  { background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: "4px", color: "#166534", padding: "5px 8px", fontSize: "12px", fontFamily: "'Courier New',monospace", outline: "none", width: "100%", boxSizing: "border-box" },
  inpR:  { background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "4px", color: "#991B1B", padding: "5px 8px", fontSize: "12px", fontFamily: "'Courier New',monospace", outline: "none", width: "100%", boxSizing: "border-box" },
  inpB:  { background: "#EFF6FF", border: "1px solid #93C5FD", borderRadius: "4px", color: "#1E40AF", padding: "5px 8px", fontSize: "12px", fontFamily: "'Courier New',monospace", outline: "none", width: "100%", boxSizing: "border-box" },
  sel:   { background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: "4px", color: "#334155", padding: "5px 8px", fontSize: "11px", outline: "none", width: "100%", boxSizing: "border-box" },
  btn:   (v="d") => ({
    padding: "5px 12px", borderRadius: "5px", border: "none", cursor: "pointer",
    fontSize: "11px", fontWeight: "600", letterSpacing: "0.02em",
    background: v==="p"?"#0369A1":v==="s"?"#166534":v==="x"?"#991B1B":v==="w"?"#92400E":v==="pdf"?"#4C1D95":v==="imp"?"#065F46":v==="cum"?"#5B21B6":v==="cpy"?"#0E7490":"#E2E8F0",
    color:      v==="p"||v==="s"||v==="x"||v==="w"||v==="pdf"||v==="imp"||v==="cum"||v==="cpy"?"#FFFFFF":"#334155",
  }),
  card:  { background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "6px", marginBottom: "8px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" },
  cHdr:  { padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", background: "#F8FAFC" },
  cBody: { padding: "13px 14px" },
  sub:   { background: "#F8FBFD", border: "1px solid #E2E8F0", borderRadius: "5px", padding: "10px 12px", marginBottom: "10px" },
  subT:  { fontSize: "9px", fontWeight: "700", color: "#0369A1", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" },
  th:    { background: "#EFF6FF", padding: "4px 7px", textAlign: "left", color: "#4A5565", fontWeight: "700", fontSize: "10px", borderBottom: "1px solid #D9E3EC", whiteSpace: "nowrap" },
  thR:   { background: "#FFF1F2", padding: "4px 7px", textAlign: "right", color: "#9F1239", fontWeight: "700", fontSize: "10px", borderBottom: "1px solid #D9E3EC", whiteSpace: "nowrap" },
  td:    { padding: "4px 5px", borderBottom: "1px solid #E6EDF3", verticalAlign: "top" },
  tdR:   { padding: "4px 5px", borderBottom: "1px solid #E6EDF3", verticalAlign: "top", textAlign: "right", fontFamily: "monospace" },
  sumRow:(s) => ({ background: s==="over"?"#FEF2F2":s==="under"?"#FFFBEB":"#F0FDF4", fontWeight: "700" }),
  bdg:   (c) => ({ background: c+"22", color: c, padding: "2px 9px", borderRadius: "9999px", fontSize: "10px", fontWeight: "700", fontFamily: "monospace", whiteSpace: "nowrap" }),
  mono:  { fontFamily: "monospace", fontSize: "11px" },
  empty: { textAlign: "center", color: "#94A3B8", padding: "32px", fontSize: "12px", fontStyle: "italic" },
  alert: (t) => ({
    background: t==="e"?"#FEF2F2":t==="o"?"#F0FDF4":"#FFFBEB",
    border:     `1px solid ${t==="e"?"#FCA5A5":t==="o"?"#86EFAC":"#FCD34D"}`,
    borderRadius: "6px", padding: "10px 14px", marginBottom: "10px",
    fontSize: "11px", lineHeight: "1.65",
    color: t==="e"?"#991B1B":t==="o"?"#166534":"#92400E",
  }),
  modal:    { position: "fixed", inset: 0, background: "rgba(15,23,42,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modalBox: { background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "24px 28px", maxWidth: "400px", width: "90%", boxShadow: "0 16px 48px rgba(0,0,0,0.14)" },
};

/* ════ FIELD ════ */
function F({ label, value, onChange, ph="", w="140px", full=false, opts=null, green=false, red=false, blue=false, note="" }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", flex: full?"1 1 100%":`1 1 ${w}`, minWidth: full?"180px":w }}>
      <label style={C.lbl}>{label}{note&&<span style={{color:"#059669",marginLeft:"5px",fontWeight:"700",fontSize:"9px"}}>{note}</span>}</label>
      {opts
        ? <select style={C.sel} value={value} onChange={e=>onChange(e.target.value)}>{opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>
        : <input style={red?C.inpR:blue?C.inpB:green?C.inpG:C.inp} value={value} onChange={e=>onChange(e.target.value)} placeholder={ph}/>}
    </div>
  );
}

/* ════ LOOKUP TABLES ════ */
const CAUSALE=[{v:"1",l:"1 – Integrazione"},{v:"5",l:"5 – Sostituzione / mai denunciato"},{v:"6",l:"6 – Annullamento"},{v:"7",l:"7 – Conguaglio previdenziale"}];
const TIPO_IMPIEGO=[{v:"1",l:"1 – TI tempo pieno"},{v:"2",l:"2 – TI part-time"},{v:"8",l:"8 – TD tempo pieno"},{v:"9",l:"9 – TD part-time"}];
const TIPO_SERVIZIO=[{v:"4",l:"4 – Ordinario"},{v:"5",l:"5 – Straordinario"},{v:"6",l:"6 – Lavoro autonomo"}];
const REGIME_FS=[{v:"1",l:"1 – TFR privatistico"},{v:"2",l:"2 – TFR misto"},{v:"3",l:"3 – TFS (INADEL)"}];
const TIPO_PT=[{v:"O",l:"O – Orizzontale"},{v:"V",l:"V – Verticale"},{v:"M",l:"M – Misto"},{v:"P",l:"P – Verticale ciclico"}];
/* ── TC8 corretto: contributo TFR versato dall'ente ── */
const TC_OPTS=[{v:"1",l:"1 – CPDEL"},{v:"2",l:"2 – C.Ins."},{v:"3",l:"3 – C.San."},{v:"5",l:"5 – Agg.spec."},{v:"6",l:"6 – Agg.1%"},{v:"7",l:"7 – TFS/INADEL"},{v:"8",l:"8 – TFR (EnteVers.)"},{v:"9",l:"9 – Fondo Cred."}];
const FG_OPTS=[{v:"2410",l:"2410 – Regione"},{v:"2420",l:"2420 – Provincia"},{v:"2430",l:"2430 – Comune"},{v:"2440",l:"2440 – Comunità montana"},{v:"2450",l:"2450 – Unione comuni"},{v:"2460",l:"2460 – Città metropolitana"},{v:"2711",l:"2711 – Ente pub. ricerca"},{v:"2712",l:"2712 – IPAB"},{v:"2720",l:"2720 – Camera commercio"},{v:"2740",l:"2740 – Consorzio dir.pub."},{v:"2790",l:"2790 – Altro ente pub."}];

const EMPTY_M = { CFPersonaMittente:"", RagSocMittente:"", CFMittente:"", CFSoftwarehouse:"00000000000", SedeINPS:"" };
const EMPTY_A = { AnnoMeseDenuncia:"", CFAzienda:"", RagSocAzienda:"", PRGAZIENDA:"00000", CFRappresentanteFirmatario:"", ISTAT:"", FormaGiuridica:"2430" };

/* ════ nextAnnoMese helper ════ */
const nextAnnoMese = (am) => {
  if (!am) return "";
  const [y, mo] = am.split("-").map(Number);
  const nm = mo === 12 ? 1 : mo + 1;
  const ny = mo === 12 ? y + 1 : y;
  return `${ny}-${String(nm).padStart(2, "0")}`;
};

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function UniEmensBuilder() {
  const [tab, setTab] = useState(0);
  const [m, setM] = useState(EMPTY_M);
  const [a, setA] = useState(EMPTY_A);
  const [dips, setDips] = useState([]);
  const [xDip, setXDip] = useState(null);
  const [xPer, setXPer] = useState(null);
  const [xml, setXml] = useState("");
  const [dupCount, setDupCount] = useState(null);
  const [warns, setWarns] = useState([]);
  const [showReset, setShowReset] = useState(false);
  const [importModal, setImportModal] = useState(null);
  const [cumuloModal, setCumuloModal] = useState(null);
  const fileRef = useRef(null);

  const mf = (k) => (v) => setM(p=>({...p,[k]:v}));
  const af = (k) => (v) => setA(p=>({...p,[k]:v}));

  /* ── RESET ── */
  const doReset = () => {
    setM(EMPTY_M); setA(EMPTY_A); setDips([]);
    setXDip(null); setXPer(null); setXml(""); setDupCount(null); setWarns([]);
    setShowReset(false); setTab(0);
  };

  /* ── Import XML ── */
  const handleFileImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = parseUniEmensXML(ev.target.result);
      if (result.error) { alert("Errore import: " + result.error); return; }
      const selected = new Set(result.workers.map(w => w.id));
      setImportModal({ ...result, selected });
    };
    reader.readAsText(file, "UTF-8");
  };

  const doImport = (mode) => {
    if (!importModal) return;
    const chosen = importModal.workers.filter(w => importModal.selected.has(w.id));
    if (mode === "replace") {
      setM(importModal.mittente);
      setA(importModal.azienda);
      setDips(chosen);
      setXml(""); setDupCount(null); setWarns([]);
      setXDip(chosen.length > 0 ? chosen[0].id : null);
      setXPer(null);
      setTab(1);
    } else {
      setM(importModal.mittente);
      setA(importModal.azienda);
      setDips(prev => [...prev, ...chosen]);
      if (chosen.length > 0) { setXDip(chosen[0].id); setXPer(null); setTab(1); }
    }
    setImportModal(null);
  };

  /* ── Cumulo Mensilità ── */
  const openCumulo=(dipId)=>setCumuloModal({step:1,dipId,inq:{...EMPTY_INQ},yearRows:[],evGrid:[],allMonths:[]});
  const setInq=(k,v)=>setCumuloModal(p=>({...p,inq:{...p.inq,[k]:v}}));
  const setYr=(anno,k,v)=>setCumuloModal(p=>({...p,yearRows:p.yearRows.map(r=>r.anno===anno?{...r,[k]:v}:r)}));
  const setEVCell=(id,k,v)=>setCumuloModal(p=>({...p,evGrid:p.evGrid.map(r=>{
    if(r.id!==id)return r;
    const u={...r,[k]:v};
    if(k==="tc1Imp"){if(r.tc9Imp===r.tc1Imp)u.tc9Imp=v;if(r.tc6Imp===r.tc1Imp)u.tc6Imp=v;if(r.tcSImp===r.tc1Imp)u.tcSImp=v;}
    return u;
  })}));
  const cumuloStep2=()=>{
    const{inq}=cumuloModal;
    if(!inq.dateFrom||!inq.dateTo||inq.dateFrom>inq.dateTo)return;
    setCumuloModal(p=>({...p,step:2,yearRows:initYearRows(inq.dateFrom,inq.dateTo)}));
  };
  const cumuloStep3=()=>{
    const{inq,yearRows}=cumuloModal;
    const months=buildMonthList(inq.dateFrom,inq.dateTo);
    setCumuloModal(p=>({...p,step:3,evGrid:buildEvGrid(yearRows,months),allMonths:months}));
  };
  const confirmCumulo=()=>{
    const{dipId,inq,evGrid}=cumuloModal;
    const cfAz=a.CFAzienda,prg=a.PRGAZIENDA||"00000";
    const sumOf=key=>toIt(String(round2(evGrid.reduce((s,r)=>s+parseIt(r[key]),0))));
    const hasTFS=evGrid.some(r=>parseIt(r.tc7Imp)>0);
    const hasC1=evGrid.some(r=>parseIt(r.tc6Cont)>0);
    const hasSol=evGrid.some(r=>parseIt(r.tcSCont)>0);
    const evList=[];
    evGrid.forEach(row=>{
      const t1=uid(),t9=uid();
      evList.push({id:t1,TipoContributo:"1",CFAzienda:cfAz,PRGAZIENDA:prg,Imponibile:row.tc1Imp,Contributo:row.tc1Cont,AnnoMeseErogazione:row.annoMese,Aliquota:"2",pairedTc9:t9});
      evList.push({id:t9,TipoContributo:"9",CFAzienda:cfAz,PRGAZIENDA:prg,Imponibile:row.tc9Imp,Contributo:row.tc9Cont,AnnoMeseErogazione:row.annoMese,Aliquota:"2",pairedWith:t1});
      if(hasTFS&&parseIt(row.tc7Imp)>0)evList.push({id:uid(),TipoContributo:"7",CFAzienda:cfAz,PRGAZIENDA:prg,Imponibile:row.tc7Imp,Contributo:row.tc7Cont,AnnoMeseErogazione:row.annoMese,Aliquota:"2"});
      if(hasC1&&parseIt(row.tc6Cont)>0)evList.push({id:uid(),TipoContributo:"6",CFAzienda:cfAz,PRGAZIENDA:prg,Imponibile:row.tc6Imp,Contributo:row.tc6Cont,AnnoMeseErogazione:row.annoMese,Aliquota:"2"});
      if(hasSol&&parseIt(row.tcSCont)>0)evList.push({id:uid(),TipoContributo:"6",CFAzienda:cfAz,PRGAZIENDA:prg,Imponibile:row.tcSImp,Contributo:row.tcSCont,AnnoMeseErogazione:row.annoMese,Aliquota:"2"});
    });
    const totImpTFS = hasTFS ? sumOf("tc7Imp") : "";
    const totContTFS = hasTFS ? sumOf("tc7Cont") : "";
    /* RetribValutabileTFR calc se regime TFR */
    const isTFR = (inq.regimeTFS||"TFS")==="TFR";
    const rvTFR = isTFR ? toIt(String(round2(parseIt(totImpTFS||"0")*1.25+parseIt(inq.ImponibileTFRUlterioriElem||"0")))) : "0,00";
    const periodo={
      id:uid(),CausaleVariazione:"5",GiornoInizio:inq.dateFrom,GiornoFine:inq.dateTo,
      TipoImpiego:inq.TipoImpiego,TipoServizio:inq.TipoServizio,Contratto:inq.Contratto,Qualifica:inq.Qualifica,
      hasPartTime:inq.hasPartTime,TipoPartTime:inq.TipoPartTime,PercPartTime:inq.PercPartTime,
      RegimeFineServizio:inq.RegimeFineServizio,CodiceCessazione:inq.CodiceCessazione||"",
      ImpCPDEL:sumOf("tc1Imp"),ContribCPDEL:sumOf("tc1Cont"),
      Contrib1Perc:hasC1?sumOf("tc6Cont"):"",
      StipTabellare:inq.StipTabellare||"0,00",RetribAnzianita:inq.RetribAnzianita||"0,00",
      regimeTFS:inq.regimeTFS||"TFS",
      ImpTFS:totImpTFS,ContribTFS:totContTFS,
      RetribTeoricaTabellareTFR:inq.RetribTeoricaTabellareTFR||"0,00",
      ImponibileTFRUlterioriElem:inq.ImponibileTFRUlterioriElem||"0,00",
      RetribValutabileTFR:rvTFR,
      ImpCredito:sumOf("tc9Imp"),ContribCredito:sumOf("tc9Cont"),
      enteVersante:evList,
    };
    setDips(ds=>ds.map(d=>d.id===dipId?{...d,periodi:[...d.periodi,periodo]}:d));
    setXDip(dipId);setXPer(periodo.id);setCumuloModal(null);
  };

  /* ── mkPer ── */
  const mkPer = () => {
    const tc1id=uid(), tc9id=uid(), tc7id=uid();
    return {
      id:uid(), CausaleVariazione:"5", GiornoInizio:"", GiornoFine:"",
      TipoImpiego:"1", TipoServizio:"4", Contratto:"RALN", Qualifica:"",
      hasPartTime:false, TipoPartTime:"O", PercPartTime:"", RegimeFineServizio:"3",
      ImpCPDEL:"", ContribCPDEL:"", Contrib1Perc:"", StipTabellare:"0,00", RetribAnzianita:"0,00",
      regimeTFS:"TFS", ImpTFS:"", ContribTFS:"",
      RetribTeoricaTabellareTFR:"0,00",
      ImponibileTFRUlterioriElem:"0,00",
      RetribValutabileTFR:"0,00",
      ImpCredito:"", ContribCredito:"",
      CodiceCessazione:"",
      enteVersante:[
        {id:tc1id, TipoContributo:"1", CFAzienda:a.CFAzienda, PRGAZIENDA:a.PRGAZIENDA||"00000", Imponibile:"", Contributo:"", AnnoMeseErogazione:"", Aliquota:"2", pairedTc9:tc9id},
        {id:tc9id, TipoContributo:"9", CFAzienda:a.CFAzienda, PRGAZIENDA:a.PRGAZIENDA||"00000", Imponibile:"", Contributo:"", AnnoMeseErogazione:"", Aliquota:"2", pairedWith:tc1id},
        {id:tc7id, TipoContributo:"7", CFAzienda:a.CFAzienda, PRGAZIENDA:a.PRGAZIENDA||"00000", Imponibile:"", Contributo:"", AnnoMeseErogazione:"", Aliquota:"2"},
      ],
    };
  };

  /* ── Dipendenti CRUD ── */
  const addDip=()=>{ const d={id:uid(),CFLavoratore:"",Cognome:"",Nome:"",CodiceComune:"",CAP:"",periodi:[]}; setDips(p=>[...p,d]); setXDip(d.id); setXPer(null); };
  const removeDip=(id)=>{ setDips(p=>p.filter(d=>d.id!==id)); if(xDip===id){setXDip(null);setXPer(null);} };
  const updDip=(id,k,v)=>setDips(p=>p.map(d=>d.id===id?{...d,[k]:v}:d));

  /* ── Periodi CRUD ── */
  const addPer=(dipId)=>{ const p=mkPer(); setDips(ds=>ds.map(d=>d.id===dipId?{...d,periodi:[...d.periodi,p]}:d)); setXPer(p.id); };
  const removePer=(dipId,perId)=>{ setDips(ds=>ds.map(d=>d.id===dipId?{...d,periodi:d.periodi.filter(p=>p.id!==perId)}:d)); if(xPer===perId)setXPer(null); };

  /* ── updPer: auto-sync ImpCredito, auto-calc RetribValutabileTFR ── */
  const updPer=(dipId,perId,k,v)=>setDips(ds=>ds.map(d=>d.id===dipId?{...d,periodi:d.periodi.map(p=>{
    if(p.id!==perId)return p;
    const u={[k]:v};
    if(k==="ImpCPDEL") u.ImpCredito=v;
    /* TFR auto-recalc RetribValutabileTFR = ImponibileTFR * 1.25 + UlterioriElem */
    const isTFR=(k==="regimeTFS"?v:p.regimeTFS)==="TFR";
    if(isTFR&&(k==="ImpTFS"||k==="ImponibileTFRUlterioriElem"||k==="regimeTFS")){
      const imp = k==="ImpTFS"?v:(p.ImpTFS||"0");
      const ult = k==="ImponibileTFRUlterioriElem"?v:(p.ImponibileTFRUlterioriElem||"0,00");
      u.RetribValutabileTFR=toIt(String(round2(parseIt(imp)*1.25+parseIt(ult))));
    }
    return{...p,...u};
  })}:d));

  /* ── EnteVersante CRUD ── */
  /* + Riga = tripla TC1 + TC9 + TC7 */
  const addEV=(dipId,perId)=>{
    const tc1id=uid(),tc9id=uid(),tc7id=uid();
    const base={CFAzienda:a.CFAzienda,PRGAZIENDA:a.PRGAZIENDA||"00000",Imponibile:"",Contributo:"",AnnoMeseErogazione:"",Aliquota:"2"};
    const tc1={id:tc1id,...base,TipoContributo:"1",pairedTc9:tc9id};
    const tc9={id:tc9id,...base,TipoContributo:"9",pairedWith:tc1id};
    const tc7={id:tc7id,...base,TipoContributo:"7"};
    setDips(ds=>ds.map(d=>d.id===dipId?{...d,periodi:d.periodi.map(p=>p.id===perId?{...p,enteVersante:[...p.enteVersante,tc1,tc9,tc7]}:p)}:d));
  };

  /* Copia coppia al mese successivo — cliccare su qualsiasi riga del gruppo */
  const copyEVPair=(dipId,perId,evId)=>{
    setDips(ds=>ds.map(d=>{
      if(d.id!==dipId)return d;
      return{...d,periodi:d.periodi.map(p=>{
        if(p.id!==perId)return p;
        const src=p.enteVersante.find(e=>e.id===evId);
        if(!src)return p;
        /* risolvi al TC1 del gruppo */
        const tc1Row=src.TipoContributo==="1"?src:p.enteVersante.find(e=>e.id===src.pairedWith);
        if(!tc1Row)return p;
        const tc9Row=tc1Row.pairedTc9?p.enteVersante.find(e=>e.id===tc1Row.pairedTc9):null;
        /* TC7 con stesso mese */
        const tc7Row=p.enteVersante.find(e=>e.TipoContributo==="7"&&e.AnnoMeseErogazione===tc1Row.AnnoMeseErogazione&&!e.pairedWith&&!e.pairedTc9);
        const newAM=nextAnnoMese(tc1Row.AnnoMeseErogazione);
        const n1=uid(),n9=uid();
        const newRows=[
          {...tc1Row,id:n1,AnnoMeseErogazione:newAM,pairedTc9:n9},
          tc9Row?{...tc9Row,id:n9,AnnoMeseErogazione:newAM,pairedWith:n1}:null,
          tc7Row?{...tc7Row,id:uid(),AnnoMeseErogazione:newAM}:null,
        ].filter(Boolean);
        /* inserisci dopo l'ultima riga del gruppo */
        const lastRow=tc7Row||tc9Row||tc1Row;
        const insertIdx=p.enteVersante.findIndex(e=>e.id===lastRow.id);
        const ev=[...p.enteVersante];
        ev.splice(insertIdx+1,0,...newRows);
        return{...p,enteVersante:ev};
      })};
    }));
  };

  const updEV=(dipId,perId,evId,k,v)=>setDips(ds=>ds.map(d=>{
    if(d.id!==dipId)return d;
    return{...d,periodi:d.periodi.map(p=>{
      if(p.id!==perId)return p;
      const upd=p.enteVersante.map(ev=>ev.id===evId?{...ev,[k]:v}:ev);
      const ch=upd.find(ev=>ev.id===evId);
      if(ch&&ch.TipoContributo==="1"&&ch.pairedTc9&&(k==="Imponibile"||k==="AnnoMeseErogazione"))
        return{...p,enteVersante:upd.map(ev=>ev.id===ch.pairedTc9?{...ev,[k]:v}:ev)};
      return{...p,enteVersante:upd};
    })};
  }));
  const removeEV=(dipId,perId,evId)=>setDips(ds=>ds.map(d=>d.id===dipId?{...d,periodi:d.periodi.map(p=>p.id===perId?{...p,enteVersante:p.enteVersante.filter(ev=>ev.id!==evId)}:p)}:d));

  /* ── Genera ── */
  const genera=()=>{
    const{dips:dd,count}=deduplicateEV(dips);
    setDupCount(count); setWarns(validateAll(dd)); setXml(buildXML(m,a,dd));
  };
  const scarica=()=>{
    if(!xml)return;
    const yymm=a.AnnoMeseDenuncia.replace("-","").slice(2)||"XXXX";
    const blob=new Blob([xml],{type:"application/xml;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const l=document.createElement("a"); l.href=url; l.download=`UNIEV${yymm}.xml`; l.click(); URL.revokeObjectURL(url);
  };

  const totPer=dips.reduce((s,d)=>s+d.periodi.length,0);
  const totEV=dips.reduce((s,d)=>s+d.periodi.reduce((ss,p)=>ss+p.enteVersante.length,0),0);

  /* ── helpers congruità per singolo periodo ── */
  const evSums=(p)=>({
    sumImpTC1: round2(p.enteVersante.filter(e=>e.TipoContributo==="1").reduce((s,e)=>s+parseIt(e.Imponibile),0)),
    sumImpTC9: round2(p.enteVersante.filter(e=>e.TipoContributo==="9").reduce((s,e)=>s+parseIt(e.Imponibile),0)),
    sumImpTC7: round2(p.enteVersante.filter(e=>e.TipoContributo==="7").reduce((s,e)=>s+parseIt(e.Imponibile),0)),
    sumContribTC1: round2(p.enteVersante.filter(e=>e.TipoContributo==="1"||e.TipoContributo==="5").reduce((s,e)=>s+parseIt(e.Contributo),0)),
  });
  const hasWarn=(p)=>{
    if(!p.ImpCPDEL)return false;
    const{sumImpTC1,sumImpTC9,sumContribTC1}=evSums(p);
    const lc=round2(parseIt(p.ContribCPDEL)+parseIt(p.Contrib1Perc));
    return sumImpTC1>parseIt(p.ImpCPDEL)+0.005||sumContribTC1>lc+0.005||(p.ImpCredito&&sumImpTC9>parseIt(p.ImpCredito)+0.005);
  };

  /* ════ RENDER periodo ════ */
  const renderPer=(dip,p)=>{
    const{sumImpTC1,sumImpTC9,sumContribTC1}=evSums(p);
    const impCPDEL=parseIt(p.ImpCPDEL);
    const impCred=parseIt(p.ImpCredito);
    const limitContrib=round2(parseIt(p.ContribCPDEL)+parseIt(p.Contrib1Perc));
    const over171=p.ImpCPDEL&&sumImpTC1>impCPDEL+0.005;
    const under171=p.ImpCPDEL&&sumImpTC1<impCPDEL-0.005;
    const over032=p.ImpCredito&&sumImpTC9>impCred+0.005;
    const under032=p.ImpCredito&&sumImpTC9<impCred-0.005;
    const over172=p.ImpCPDEL&&sumContribTC1>limitContrib+0.005;
    const under172=p.ImpCPDEL&&sumContribTC1<limitContrib-0.005;

    /* banner causale 6 */
    if (p.CausaleVariazione === "6") {
      return (
        <div style={C.cBody}>
          <div style={{background:"#FFFBEB",border:"1px solid #FCD34D",borderRadius:"6px",padding:"12px 16px",marginBottom:"8px"}}>
            <div style={{fontWeight:"700",color:"#92400E",fontSize:"12px",marginBottom:"6px"}}>Causale 6 — Annullamento periodo</div>
            <div style={{fontSize:"11px",color:"#92400E",lineHeight:"1.65"}}>
              Con causale 6 l'XML conterrà <strong>solo GiornoInizio e GiornoFine</strong>.<br/>
              Nessun altro elemento (InquadramentoLavPA, Gestioni, EnteVersante) verrà emesso.<br/>
              Modifica le date se necessario.
            </div>
          </div>
          <div style={C.sub}>
            <div style={C.subT}>Date del periodo da annullare</div>
            <div style={C.row}>
              <F label="Causale variazione" value={p.CausaleVariazione} onChange={v=>updPer(dip.id,p.id,"CausaleVariazione",v)} opts={CAUSALE} w="230px"/>
              <F label="Giorno inizio" value={p.GiornoInizio} onChange={v=>updPer(dip.id,p.id,"GiornoInizio",v)} ph="YYYY-MM-DD" w="130px"/>
              <F label="Giorno fine" value={p.GiornoFine} onChange={v=>updPer(dip.id,p.id,"GiornoFine",v)} ph="YYYY-MM-DD" w="130px"/>
            </div>
          </div>
        </div>
      );
    }

    return(
    <div style={C.cBody}>
      <div style={C.sub}>
        <div style={C.subT}>Periodo e Causale</div>
        <div style={C.row}>
          <F label="Causale variazione" value={p.CausaleVariazione} onChange={v=>updPer(dip.id,p.id,"CausaleVariazione",v)} opts={CAUSALE} w="230px"/>
          <F label="Giorno inizio" value={p.GiornoInizio} onChange={v=>updPer(dip.id,p.id,"GiornoInizio",v)} ph="YYYY-MM-DD" w="130px"/>
          <F label="Giorno fine" value={p.GiornoFine} onChange={v=>updPer(dip.id,p.id,"GiornoFine",v)} ph="YYYY-MM-DD" w="130px"/>
          <F label="Cod. cessazione" value={p.CodiceCessazione} onChange={v=>updPer(dip.id,p.id,"CodiceCessazione",v)} ph="es. 3" w="108px"/>
        </div>
      </div>

      <div style={C.sub}>
        <div style={C.subT}>InquadramentoLavPA</div>
        <div style={C.row}>
          <F label="Tipo impiego" value={p.TipoImpiego} onChange={v=>updPer(dip.id,p.id,"TipoImpiego",v)} opts={TIPO_IMPIEGO} w="198px"/>
          <F label="Tipo servizio" value={p.TipoServizio} onChange={v=>updPer(dip.id,p.id,"TipoServizio",v)} opts={TIPO_SERVIZIO} w="178px"/>
          <F label="Contratto" value={p.Contratto} onChange={v=>updPer(dip.id,p.id,"Contratto",v)} ph="RALN" w="86px"/>
          <F label="Qualifica" value={p.Qualifica} onChange={v=>updPer(dip.id,p.id,"Qualifica",v)} ph="042000" w="106px"/>
          <F label="Regime fine servizio" value={p.RegimeFineServizio} onChange={v=>updPer(dip.id,p.id,"RegimeFineServizio",v)} opts={REGIME_FS} w="178px"/>
        </div>
        <div style={{...C.row,alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
            <input type="checkbox" checked={p.hasPartTime} onChange={e=>updPer(dip.id,p.id,"hasPartTime",e.target.checked)} style={{cursor:"pointer"}}/>
            <span style={{fontSize:"11px",color:"#4A6E8C"}}>Part-time</span>
          </div>
          {p.hasPartTime&&<>
            <F label="Tipo PT" value={p.TipoPartTime} onChange={v=>updPer(dip.id,p.id,"TipoPartTime",v)} opts={TIPO_PT} w="178px"/>
            <F label="% (es. 50000)" value={p.PercPartTime} onChange={v=>updPer(dip.id,p.id,"PercPartTime",v)} ph="50000" w="138px"/>
          </>}
        </div>
      </div>

      <div style={C.sub}>
        <div style={C.subT}>GestPensionistica — CPDEL (CodGestione 2)</div>
        <div style={C.row}>
          <F label="Imponibile CPDEL" value={p.ImpCPDEL} onChange={v=>updPer(dip.id,p.id,"ImpCPDEL",v)} ph="0,00" w="136px"/>
          <F label="Contributo CPDEL" value={p.ContribCPDEL} onChange={v=>updPer(dip.id,p.id,"ContribCPDEL",v)} ph="0,00" w="136px"/>
          <F label="Contrib. 1%" value={p.Contrib1Perc} onChange={v=>updPer(dip.id,p.id,"Contrib1Perc",v)} ph="0,00" w="96px"/>
          <F label="Stipendio tabellare" value={p.StipTabellare} onChange={v=>updPer(dip.id,p.id,"StipTabellare",v)} ph="0,00" w="136px"/>
          <F label="Retrib. anzianità" value={p.RetribAnzianita} onChange={v=>updPer(dip.id,p.id,"RetribAnzianita",v)} ph="0,00" w="126px"/>
        </div>
      </div>

      {/* ── GestPrevidenziale: TFS standard o TFR con campi aggiuntivi ── */}
      <div style={C.sub}>
        <div style={C.subT}>GestPrevidenziale — TFS / TFR (CodGestione 6)</div>
        <div style={C.row}>
          <F label="Regime" value={p.regimeTFS} onChange={v=>updPer(dip.id,p.id,"regimeTFS",v)} opts={[{v:"TFS",l:"TFS (INADEL)"},{v:"TFR",l:"TFR"}]} w="146px"/>
          <F label={`Imponibile ${p.regimeTFS}`} value={p.ImpTFS} onChange={v=>updPer(dip.id,p.id,"ImpTFS",v)} ph="0,00" w="136px"/>
          <F label={`Contributo ${p.regimeTFS}`} value={p.ContribTFS} onChange={v=>updPer(dip.id,p.id,"ContribTFS",v)} ph="0,00" w="136px"/>
        </div>
        {p.regimeTFS==="TFR"&&(
          <>
            <div style={C.row}>
              <F label="Retrib. Teorica Tabellare TFR" value={p.RetribTeoricaTabellareTFR} onChange={v=>updPer(dip.id,p.id,"RetribTeoricaTabellareTFR",v)} ph="0,00" w="218px"/>
              <F label="Imponibile TFR Ulteriori Elem." value={p.ImponibileTFRUlterioriElem} onChange={v=>updPer(dip.id,p.id,"ImponibileTFRUlterioriElem",v)} ph="0,00" w="198px"/>
              <F label="Retrib. Valutabile TFR (auto)" value={p.RetribValutabileTFR} onChange={v=>updPer(dip.id,p.id,"RetribValutabileTFR",v)} ph="0,00" w="198px" blue/>
            </div>
            <div style={{fontSize:"9px",color:"#1E40AF",marginTop:"-4px",marginBottom:"4px",paddingLeft:"2px"}}>
              Formula auto: ImponibileTFR × 1,25 + ImponibileTFRUlterioriElem (circ. 105/2012, msg. 2440/2019). Il campo blu è editabile se necessario.
            </div>
          </>
        )}
      </div>

      <div style={C.sub}>
        <div style={C.subT}>GestCredito — Fondo Credito (CodGestione 9)</div>
        <div style={C.row}>
          <F label="Imponibile credito" value={p.ImpCredito} onChange={v=>updPer(dip.id,p.id,"ImpCredito",v)} ph="0,00" w="136px"
            green={!!p.ImpCredito&&p.ImpCredito===p.ImpCPDEL} note={p.ImpCredito&&p.ImpCredito===p.ImpCPDEL?"↔ CPDEL":""}/>
          <F label="Contributo credito" value={p.ContribCredito} onChange={v=>updPer(dip.id,p.id,"ContribCredito",v)} ph="0,00" w="136px"/>
        </div>
      </div>

      {/* EnteVersante */}
      <div style={C.sub}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"7px"}}>
          <div style={C.subT}>Lista Contributi — Ente Versante ({p.enteVersante.length} righe)</div>
          <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
            <span style={{fontSize:"9px",color:"#15803D"}}>+Riga = tripla TC1+TC9+TC7</span>
            <span style={{fontSize:"9px",color:"#0E7490"}}>📋 = copia coppia al mese succ.</span>
            <button style={C.btn()} onClick={()=>addEV(dip.id,p.id)}>+ Riga</button>
          </div>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
            <thead>
              <tr>
                <th style={C.th}>📋</th>
                <th style={C.th}>TC</th>
                <th style={C.th}>CF Azienda</th>
                <th style={C.th}>PRGAZIENDA</th>
                <th style={C.th}>Imponibile</th>
                <th style={C.th}>Contributo</th>
                <th style={C.th}>AnnoMese Erog.</th>
                <th style={C.th}>Al.</th>
                <th style={C.th}></th>
              </tr>
            </thead>
            <tbody>
              {p.enteVersante.map(ev=>{
                const isSyncedTc9=ev.pairedWith&&p.enteVersante.find(e=>e.id===ev.pairedWith)?.TipoContributo==="1";
                const bg=ev.TipoContributo==="1"?"#F0FDF4":isSyncedTc9?"#F7FEFB":"transparent";
                /* mostra copia su TC1 o su righe libere (TC7, TC8) */
                const showCopy=ev.TipoContributo==="1"||(ev.TipoContributo!=="9"&&!ev.pairedWith);
                return(
                  <tr key={ev.id} style={{background:bg}}>
                    <td style={{...C.td,width:"32px"}}>
                      {showCopy&&(
                        <button
                          style={{...C.btn("cpy"),padding:"2px 7px",fontSize:"10px"}}
                          title="Copia gruppo al mese successivo"
                          onClick={()=>copyEVPair(dip.id,p.id,ev.id)}>
                          📋
                        </button>
                      )}
                    </td>
                    <td style={C.td}><select style={{...C.sel,width:"112px",fontSize:"10px"}} value={ev.TipoContributo} onChange={e=>updEV(dip.id,p.id,ev.id,"TipoContributo",e.target.value)}>{TC_OPTS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select></td>
                    <td style={C.td}><input style={{...C.inp,width:"108px"}} value={ev.CFAzienda} onChange={e=>updEV(dip.id,p.id,ev.id,"CFAzienda",e.target.value)}/></td>
                    <td style={C.td}><input style={{...C.inp,width:"58px"}} value={ev.PRGAZIENDA} onChange={e=>updEV(dip.id,p.id,ev.id,"PRGAZIENDA",e.target.value)}/></td>
                    <td style={C.td}><input style={{...(isSyncedTc9?C.inpG:C.inp),width:"78px"}} value={ev.Imponibile} onChange={e=>updEV(dip.id,p.id,ev.id,"Imponibile",e.target.value)} placeholder="0,00"/></td>
                    <td style={C.td}><input style={{...C.inp,width:"78px"}} value={ev.Contributo} onChange={e=>updEV(dip.id,p.id,ev.id,"Contributo",e.target.value)} placeholder="0,00"/></td>
                    <td style={C.td}><input style={{...(isSyncedTc9?C.inpG:C.inp),width:"76px"}} value={ev.AnnoMeseErogazione} onChange={e=>updEV(dip.id,p.id,ev.id,"AnnoMeseErogazione",e.target.value)} placeholder="YYYY-MM"/></td>
                    <td style={C.td}><input style={{...C.inp,width:"34px"}} value={ev.Aliquota} onChange={e=>updEV(dip.id,p.id,ev.id,"Aliquota",e.target.value)}/></td>
                    <td style={C.td}><button style={C.btn("x")} onClick={()=>removeEV(dip.id,p.id,ev.id)}>✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {p.ImpCPDEL&&(
          <div style={{marginTop:"9px",background:"#F8FBFD",border:"1px solid #D6EAF8",borderRadius:"5px",overflow:"hidden"}}>
            <div style={{background:"#EAF4FB",padding:"5px 9px",fontSize:"9px",fontWeight:"700",color:"#0369A1",textTransform:"uppercase",letterSpacing:"1px"}}>
              Verifica Congruità Somme EV — confronto in tempo reale
            </div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
              <thead>
                <tr>
                  <th style={C.th}>Controllo INPS</th>
                  <th style={{...C.th,textAlign:"right"}}>Σ EV</th>
                  <th style={{...C.th,textAlign:"right"}}>Limite gestione</th>
                  <th style={{...C.th,textAlign:"right"}}>Differenza</th>
                  <th style={C.th}>Esito</th>
                </tr>
              </thead>
              <tbody>
                <tr style={C.sumRow(over171?"over":under171?"under":"ok")}>
                  <td style={C.td}><span style={{fontSize:"10px",fontWeight:"700",color:over171?"#DC2626":under171?"#D97706":"#16A34A"}}>00171I</span> Σ Imponibile TC1</td>
                  <td style={{...C.tdR,color:over171?"#DC2626":under171?"#D97706":"#16A34A",fontWeight:"700"}}>{toIt(String(sumImpTC1))}</td>
                  <td style={{...C.tdR,color:"#4A6E8C"}}>{toIt(p.ImpCPDEL)}</td>
                  <td style={{...C.tdR,color:over171?"#DC2626":under171?"#D97706":"#16A34A",fontWeight:"700"}}>{toIt(String(round2(sumImpTC1-impCPDEL)))}</td>
                  <td style={C.td}>{over171?<span style={{color:"#DC2626",fontWeight:"700"}}>⚠ ECCESSO</span>:under171?<span style={{color:"#D97706",fontWeight:"700"}}>⚠ RESIDUO</span>:<span style={{color:"#16A34A"}}>✓ OK</span>}</td>
                </tr>
                {p.ImpCredito&&(
                  <tr style={C.sumRow(over032?"over":under032?"under":"ok")}>
                    <td style={C.td}><span style={{fontSize:"10px",fontWeight:"700",color:over032?"#DC2626":under032?"#D97706":"#16A34A"}}>00032I</span> Σ Imponibile TC9</td>
                    <td style={{...C.tdR,color:over032?"#DC2626":under032?"#D97706":"#16A34A",fontWeight:"700"}}>{toIt(String(sumImpTC9))}</td>
                    <td style={{...C.tdR,color:"#4A6E8C"}}>{toIt(p.ImpCredito)}</td>
                    <td style={{...C.tdR,color:over032?"#DC2626":under032?"#D97706":"#16A34A",fontWeight:"700"}}>{toIt(String(round2(sumImpTC9-impCred)))}</td>
                    <td style={C.td}>{over032?<span style={{color:"#DC2626",fontWeight:"700"}}>⚠ ECCESSO</span>:under032?<span style={{color:"#D97706",fontWeight:"700"}}>⚠ RESIDUO</span>:<span style={{color:"#16A34A"}}>✓ OK</span>}</td>
                  </tr>
                )}
                <tr style={C.sumRow(over172?"over":under172?"under":"ok")}>
                  <td style={C.td}><span style={{fontSize:"10px",fontWeight:"700",color:over172?"#DC2626":under172?"#D97706":"#16A34A"}}>00172I</span> Σ Contributo TC1+TC5</td>
                  <td style={{...C.tdR,color:over172?"#DC2626":under172?"#D97706":"#16A34A",fontWeight:"700"}}>{toIt(String(sumContribTC1))}</td>
                  <td style={{...C.tdR,color:"#4A6E8C"}}>{toIt(String(limitContrib))} (CPDEL+1%)</td>
                  <td style={{...C.tdR,color:over172?"#DC2626":under172?"#D97706":"#16A34A",fontWeight:"700"}}>{toIt(String(round2(sumContribTC1-limitContrib)))}</td>
                  <td style={C.td}>{over172?<span style={{color:"#DC2626",fontWeight:"700"}}>⚠ ECCESSO</span>:under172?<span style={{color:"#D97706",fontWeight:"700"}}>⚠ RESIDUO</span>:<span style={{color:"#16A34A"}}>✓ OK</span>}</td>
                </tr>
              </tbody>
            </table>
            <div style={{fontSize:"9px",color:"#64748B",padding:"4px 9px"}}>
              Valori negativi = margine residuo. Valori positivi = eccesso da correggere prima del passaggio al sw INPS.
            </div>
          </div>
        )}
      </div>
    </div>
  );};

  /* ════ RENDER dipendente ════ */
  const renderDip=(dip)=>(
    <div style={C.cBody}>
      <div style={C.sub}>
        <div style={C.subT}>Anagrafica Lavoratore (D0)</div>
        <div style={C.row}>
          <F label="Codice Fiscale" value={dip.CFLavoratore} onChange={v=>updDip(dip.id,"CFLavoratore",v)} ph="XYZABC00X00X000X" w="176px"/>
          <F label="Cognome" value={dip.Cognome} onChange={v=>updDip(dip.id,"Cognome",v)} w="146px"/>
          <F label="Nome" value={dip.Nome} onChange={v=>updDip(dip.id,"Nome",v)} w="126px"/>
          <F label="Codice Comune" value={dip.CodiceComune} onChange={v=>updDip(dip.id,"CodiceComune",v)} ph="F943" w="126px"/>
          <F label="CAP" value={dip.CAP} onChange={v=>updDip(dip.id,"CAP",v)} ph="96017" w="70px"/>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"7px"}}>
        <span style={{...C.subT,marginBottom:0}}>V1 — {dip.periodi.length} periodo{dip.periodi.length!==1?"i":""}</span>
        <div style={{display:"flex",gap:"6px"}}>
          <button style={C.btn("p")} onClick={()=>addPer(dip.id)}>+ Aggiungi periodo V1</button>
          <button style={{...C.btn("cum"),padding:"4px 11px"}} onClick={()=>openCumulo(dip.id)}>∑ Cumulo mensilità</button>
        </div>
      </div>
      {dip.periodi.length===0&&<div style={C.empty}>Nessun periodo V1.</div>}
      {dip.periodi.map(p=>(
        <div key={p.id} style={C.card}>
          <div style={C.cHdr} onClick={()=>setXPer(xPer===p.id?null:p.id)}>
            <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
              <span style={C.bdg(p.CausaleVariazione==="6"?"#D97706":"#00AEEF")}>caus.{p.CausaleVariazione}</span>
              <span style={{...C.mono,color:"#4A6E8C"}}>{p.GiornoInizio||"???"} → {p.GiornoFine||"???"}</span>
              {p.CausaleVariazione!=="6"&&<span style={{...C.bdg("#059669"),fontSize:"9px"}}>{p.enteVersante.length} EV</span>}
              {p.CodiceCessazione&&<span style={{...C.bdg("#D97706"),fontSize:"9px"}}>cess.{p.CodiceCessazione}</span>}
              {p.CausaleVariazione==="6"&&<span style={{...C.bdg("#D97706"),fontSize:"9px"}}>ANNULLAMENTO</span>}
              {hasWarn(p)&&<span style={{...C.bdg("#EF4444"),fontSize:"9px"}}>⚠ CONGRUITÀ</span>}
            </div>
            <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
              <span style={{fontSize:"10px",color:xPer===p.id?"#0369A1":"#94A3B8"}}>{xPer===p.id?"▲":"▼"}</span>
              <button style={C.btn("x")} onClick={e=>{e.stopPropagation();removePer(dip.id,p.id);}}>✕</button>
            </div>
          </div>
          {xPer===p.id&&renderPer(dip,p)}
        </div>
      ))}
    </div>
  );

  /* ════ CUMULO MODALE ════ */
  const renderCumulo=()=>{
    if(!cumuloModal)return null;
    const{step,inq,yearRows,evGrid}=cumuloModal;
    const months=buildMonthList(inq.dateFrom,inq.dateTo);
    const hasTFS=evGrid.some(r=>parseIt(r.tc7Imp)>0);
    const hasC1=evGrid.some(r=>parseIt(r.tc6Cont)>0);
    const hasSol=evGrid.some(r=>parseIt(r.tcSCont)>0);

    const stepBar=(
      <div style={{display:"flex",gap:"5px",marginBottom:"13px"}}>
        {["1. Periodo e Inquadramento","2. Totali per anno","3. Griglia EV — verifica e conferma"].map((t,i)=>(
          <div key={i} style={{flex:1,padding:"5px 8px",borderRadius:"5px",fontSize:"10px",fontWeight:"700",
            background:step===i+1?"#EDE9FE":step>i+1?"#F0FDF4":"#F3F7FA",
            color:step===i+1?"#5B21B6":step>i+1?"#15803D":"#94A3B8",
            borderBottom:step===i+1?"2px solid #7C3AED":step>i+1?"2px solid #15803D":"2px solid transparent"}}>
            {t}
          </div>
        ))}
      </div>
    );

    const step1=(
      <>
        {stepBar}
        <div style={C.sub}>
          <div style={C.subT}>Periodo</div>
          <div style={C.row}>
            <F label="Dal (GiornoInizio)" value={inq.dateFrom} onChange={v=>setInq("dateFrom",v)} ph="YYYY-MM-DD" w="148px"/>
            <F label="Al (GiornoFine)" value={inq.dateTo} onChange={v=>setInq("dateTo",v)} ph="YYYY-MM-DD" w="148px"/>
            <F label="Cod. cessazione" value={inq.CodiceCessazione} onChange={v=>setInq("CodiceCessazione",v)} ph="es. 3" w="108px"/>
          </div>
          {inq.dateFrom&&inq.dateTo&&inq.dateFrom<=inq.dateTo&&(()=>{
            const ml=buildMonthList(inq.dateFrom,inq.dateTo);
            const yrs=[...new Set(ml.map(m=>m.year))];
            return <div style={{fontSize:"10px",color:"#374151",marginTop:"2px"}}>
              {ml.length} mesi · {yrs.length} anno{yrs.length>1?"i":""}: {yrs.join(", ")} · {yrs.map(y=>{const ym=ml.filter(m=>m.year===y);return `${y}: ÷${annoDivisor(ym)}`;}).join(" | ")}
            </div>;
          })()}
        </div>
        <div style={C.sub}>
          <div style={C.subT}>InquadramentoLavPA</div>
          <div style={C.row}>
            <F label="Tipo impiego" value={inq.TipoImpiego} onChange={v=>setInq("TipoImpiego",v)} opts={TIPO_IMPIEGO} w="196px"/>
            <F label="Tipo servizio" value={inq.TipoServizio} onChange={v=>setInq("TipoServizio",v)} opts={TIPO_SERVIZIO} w="176px"/>
            <F label="Contratto" value={inq.Contratto} onChange={v=>setInq("Contratto",v)} ph="RALN" w="86px"/>
            <F label="Qualifica" value={inq.Qualifica} onChange={v=>setInq("Qualifica",v)} ph="042000" w="106px"/>
            <F label="Regime FS" value={inq.RegimeFineServizio} onChange={v=>setInq("RegimeFineServizio",v)} opts={REGIME_FS} w="176px"/>
          </div>
          <div style={{...C.row,alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
              <input type="checkbox" checked={inq.hasPartTime} onChange={e=>setInq("hasPartTime",e.target.checked)} style={{cursor:"pointer"}}/>
              <span style={{fontSize:"11px",color:"#4A6E8C"}}>Part-time</span>
            </div>
            {inq.hasPartTime&&<>
              <F label="Tipo PT" value={inq.TipoPartTime} onChange={v=>setInq("TipoPartTime",v)} opts={TIPO_PT} w="176px"/>
              <F label="% (es. 50000)" value={inq.PercPartTime} onChange={v=>setInq("PercPartTime",v)} ph="50000" w="136px"/>
            </>}
          </div>
          <div style={C.row}>
            <F label="Regime TFS/TFR" value={inq.regimeTFS||"TFS"} onChange={v=>setInq("regimeTFS",v)} opts={[{v:"TFS",l:"TFS (INADEL)"},{v:"TFR",l:"TFR"}]} w="156px"/>
            <F label="Stipendio tabellare" value={inq.StipTabellare} onChange={v=>setInq("StipTabellare",v)} ph="0,00" w="136px"/>
            <F label="Retrib. anzianità" value={inq.RetribAnzianita} onChange={v=>setInq("RetribAnzianita",v)} ph="0,00" w="136px"/>
          </div>
          {(inq.regimeTFS||"TFS")==="TFR"&&(
            <div style={C.row}>
              <F label="Retrib. Teorica Tabellare TFR" value={inq.RetribTeoricaTabellareTFR||"0,00"} onChange={v=>setInq("RetribTeoricaTabellareTFR",v)} ph="0,00" w="218px"/>
              <F label="Imponibile TFR Ulteriori Elem." value={inq.ImponibileTFRUlterioriElem||"0,00"} onChange={v=>setInq("ImponibileTFRUlterioriElem",v)} ph="0,00" w="198px"/>
            </div>
          )}
        </div>
        <div style={{fontSize:"9px",color:"#64748B",padding:"4px 0"}}>Causale V1: 5 (fissa) · CF Azienda: <strong style={{color:"#0369A1"}}>{a.CFAzienda||"—"}</strong></div>
        <div style={{display:"flex",gap:"8px",justifyContent:"flex-end",marginTop:"8px"}}>
          <button style={C.btn()} onClick={()=>setCumuloModal(null)}>Annulla</button>
          <button style={{...C.btn("p"),opacity:(!inq.dateFrom||!inq.dateTo||inq.dateFrom>inq.dateTo)?0.4:1}}
            disabled={!inq.dateFrom||!inq.dateTo||inq.dateFrom>inq.dateTo}
            onClick={cumuloStep2}>Avanti →</button>
        </div>
      </>
    );

    const step2=(
      <>
        {stepBar}
        <div style={{fontSize:"10px",color:"#374151",marginBottom:"8px"}}>
          Periodo: <strong style={{color:"#0369A1"}}>{inq.dateFrom}</strong> → <strong style={{color:"#0369A1"}}>{inq.dateTo}</strong> · {months.length} mesi · Causale 5 (fissa)
        </div>
        <div style={{overflowY:"auto",maxHeight:"52vh"}}>
          {yearRows.map(yr=>(
            <div key={yr.anno} style={{...C.sub,marginBottom:"10px"}}>
              <div style={{...C.subT,fontSize:"10px",color:"#0369A1",display:"flex",gap:"8px",alignItems:"center"}}>
                <span>Anno {yr.anno}</span>
                <span style={{color:"#64748B"}}>{MESI_IT[yr.meseFrom]} → {MESI_IT[yr.meseTo]}</span>
                <span style={{background:"#DBEAFE",padding:"2px 8px",borderRadius:"9999px",color:"#1E40AF",fontSize:"9px"}}>
                  ÷{yr.divisor}{yr.divisor===13?" (annualità intera, dic=doppio)":` (${yr.meseTo-yr.meseFrom+1} mesi)`}
                </span>
              </div>
              <div style={C.row}>
                <F label="Imp. CPDEL totale" value={yr.ImpCPDEL} onChange={v=>setYr(yr.anno,"ImpCPDEL",v)} ph="0,00" w="148px"/>
                <F label="Contrib. CPDEL totale" value={yr.ContribCPDEL} onChange={v=>setYr(yr.anno,"ContribCPDEL",v)} ph="0,00" w="148px"/>
                <F label="Contrib. 1% totale" value={yr.Contrib1Perc} onChange={v=>setYr(yr.anno,"Contrib1Perc",v)} ph="0,00 (opz.)" w="128px"/>
                <F label="Stip. tabellare" value={yr.StipTabellare} onChange={v=>setYr(yr.anno,"StipTabellare",v)} ph="0,00" w="118px"/>
                <F label="Retrib. anzianità" value={yr.RetribAnzianita} onChange={v=>setYr(yr.anno,"RetribAnzianita",v)} ph="0,00" w="118px"/>
              </div>
              <div style={C.row}>
                <F label={`Imp. ${inq.regimeTFS||"TFS"} totale`} value={yr.ImpTFS} onChange={v=>setYr(yr.anno,"ImpTFS",v)} ph="0,00 (opz.)" w="148px"/>
                <F label={`Contrib. ${inq.regimeTFS||"TFS"} totale`} value={yr.ContribTFS} onChange={v=>setYr(yr.anno,"ContribTFS",v)} ph="0,00 (opz.)" w="148px"/>
                <F label="Contrib. Credito totale" value={yr.ContribCredito} onChange={v=>setYr(yr.anno,"ContribCredito",v)} ph="0,00" w="148px"/>
                <F label="Solidarietà L166/91 Imp." value={yr.ImpSol} onChange={v=>setYr(yr.anno,"ImpSol",v)} ph="0,00 (opz.)" w="148px"/>
                <F label="Solidarietà L166/91 Contrib." value={yr.ContribSol} onChange={v=>setYr(yr.anno,"ContribSol",v)} ph="0,00 (opz.)" w="148px"/>
              </div>
              <div style={{fontSize:"9px",color:"#15803D"}}>Imponibile Credito = Imponibile CPDEL (auto). Residuo arrotondamento → ultima mensilità.</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:"8px",justifyContent:"flex-end",marginTop:"8px"}}>
          <button style={C.btn()} onClick={()=>setCumuloModal(null)}>Annulla</button>
          <button style={C.btn()} onClick={()=>setCumuloModal(p=>({...p,step:1}))}>← Indietro</button>
          <button style={C.btn("p")} onClick={cumuloStep3}>Genera Griglia EV →</button>
        </div>
      </>
    );

    const years=[...new Set(evGrid.map(r=>r.year))];
    const colA={...C.th,textAlign:"right",fontSize:"9px"};
    const sumYr=(yr,key)=>round2(evGrid.filter(r=>r.year===yr).reduce((s,r)=>s+parseIt(r[key]),0));
    const sumTot=key=>round2(evGrid.reduce((s,r)=>s+parseIt(r[key]),0));
    const tdEd=(id,k,v,green=false)=>(
      <td style={C.td}>
        <input style={{...(green?C.inpG:C.inp),width:"72px",fontSize:"10px"}}
          value={v} onChange={e=>setEVCell(id,k,e.target.value)} placeholder="0,00"/>
      </td>
    );

    const step3=(
      <>
        {stepBar}
        <div style={{fontSize:"10px",color:"#374151",marginBottom:"7px",display:"flex",gap:"12px",alignItems:"center"}}>
          <span>{evGrid.length} righe mese · {evGrid.length*2}{hasTFS?"+TFS":""}{hasC1?"+1%":""}{hasSol?"+Sol":""} EV totali generate</span>
        </div>
        <div style={{overflowX:"auto",overflowY:"auto",maxHeight:"50vh",border:"1px solid #E5E7EB",borderRadius:"5px"}}>
          <table style={{borderCollapse:"collapse",fontSize:"10px",minWidth:"100%"}}>
            <thead>
              <tr>
                <th style={{...C.th,position:"sticky",left:0,zIndex:2}}>Mese</th>
                <th style={colA}>TC1 Imp</th><th style={colA}>TC1 Cont</th>
                <th style={{...colA,color:"#065F46"}}>TC9 Imp</th><th style={colA}>TC9 Cont</th>
                {hasTFS&&<><th style={colA}>TC7 Imp</th><th style={colA}>TC7 Cont</th></>}
                {hasC1&&<><th style={{...colA,color:"#1E40AF"}}>TC6 Imp</th><th style={colA}>TC6 Cont</th></>}
                {hasSol&&<><th style={{...colA,color:"#92400E"}}>Sol Imp</th><th style={colA}>Sol Cont</th></>}
              </tr>
            </thead>
            <tbody>
              {years.map(yr=>{
                const yrRows=evGrid.filter(r=>r.year===yr);
                const ref=yearRows.find(r=>r.anno===yr)||{};
                const s1i=sumYr(yr,"tc1Imp"),s1c=sumYr(yr,"tc1Cont");
                const s9i=sumYr(yr,"tc9Imp"),s9c=sumYr(yr,"tc9Cont");
                const s7i=sumYr(yr,"tc7Imp"),s7c=sumYr(yr,"tc7Cont");
                const s6i=sumYr(yr,"tc6Imp"),s6c=sumYr(yr,"tc6Cont");
                const ssi=sumYr(yr,"tcSImp"),ssc=sumYr(yr,"tcSCont");
                const ok1i=!parseIt(ref.ImpCPDEL)||Math.abs(s1i-parseIt(ref.ImpCPDEL))<=0.005;
                const ok1c=!parseIt(ref.ContribCPDEL)||Math.abs(s1c-parseIt(ref.ContribCPDEL))<=0.005;
                return[
                  <tr key={`yh-${yr}`} style={{background:"#EFF6FF"}}>
                    <td colSpan={4+(hasTFS?2:0)+(hasC1?2:0)+(hasSol?2:0)+2}
                      style={{padding:"4px 8px",color:"#2563EB",fontWeight:"700",fontSize:"10px",letterSpacing:"0.5px"}}>
                      ── {yr} ── ÷{annoDivisor(yrRows)} {annoDivisor(yrRows)===13?"(annualità intera)":"(parziale)"}
                    </td>
                  </tr>,
                  ...yrRows.map(row=>(
                    <tr key={row.id} style={{background:row.isDec?"#DCFCE7":"transparent"}}>
                      <td style={{...C.td,position:"sticky",left:0,background:row.isDec?"#DCFCE7":"#FFFFFF",
                        color:row.isDec?"#4ADE80":"#4A6E8C",fontFamily:"monospace",fontSize:"10px",whiteSpace:"nowrap",minWidth:"76px"}}>
                        {row.annoMese}{row.isDec?" ×2":""}
                      </td>
                      {tdEd(row.id,"tc1Imp",row.tc1Imp)}
                      {tdEd(row.id,"tc1Cont",row.tc1Cont)}
                      {tdEd(row.id,"tc9Imp",row.tc9Imp,row.tc9Imp===row.tc1Imp)}
                      {tdEd(row.id,"tc9Cont",row.tc9Cont)}
                      {hasTFS&&<>{tdEd(row.id,"tc7Imp",row.tc7Imp)}{tdEd(row.id,"tc7Cont",row.tc7Cont)}</>}
                      {hasC1&&<>{tdEd(row.id,"tc6Imp",row.tc6Imp,row.tc6Imp===row.tc1Imp)}{tdEd(row.id,"tc6Cont",row.tc6Cont)}</>}
                      {hasSol&&<>{tdEd(row.id,"tcSImp",row.tcSImp,row.tcSImp===row.tc1Imp)}{tdEd(row.id,"tcSCont",row.tcSCont)}</>}
                    </tr>
                  )),
                  <tr key={`ys-${yr}`} style={{background:ok1i&&ok1c?"#F0FDF4":"#FEF2F2",fontWeight:"700"}}>
                    <td style={{...C.td,color:"#4A6E8C",fontSize:"9px",fontFamily:"monospace",position:"sticky",left:0,background:"inherit"}}>Σ {yr}</td>
                    <td style={{...C.tdR,color:ok1i?"#16A34A":"#DC2626",fontSize:"10px"}}>{toIt(String(s1i))}</td>
                    <td style={{...C.tdR,color:ok1c?"#16A34A":"#DC2626",fontSize:"10px"}}>{toIt(String(s1c))}</td>
                    <td style={{...C.tdR,color:"#4A6E8C",fontSize:"10px"}}>{toIt(String(s9i))}</td>
                    <td style={{...C.tdR,fontSize:"10px",color:"#4A6E8C"}}>{toIt(String(s9c))}</td>
                    {hasTFS&&<><td style={{...C.tdR,fontSize:"10px",color:"#4A6E8C"}}>{toIt(String(s7i))}</td><td style={{...C.tdR,fontSize:"10px",color:"#4A6E8C"}}>{toIt(String(s7c))}</td></>}
                    {hasC1&&<><td style={{...C.tdR,fontSize:"10px",color:"#4A6E8C"}}>{toIt(String(s6i))}</td><td style={{...C.tdR,fontSize:"10px",color:"#4A6E8C"}}>{toIt(String(s6c))}</td></>}
                    {hasSol&&<><td style={{...C.tdR,fontSize:"10px",color:"#4A6E8C"}}>{toIt(String(ssi))}</td><td style={{...C.tdR,fontSize:"10px",color:"#4A6E8C"}}>{toIt(String(ssc))}</td></>}
                  </tr>,
                  (!ok1i||!ok1c)&&<tr key={`yw-${yr}`} style={{background:"#FEF2F2"}}>
                    <td colSpan={4+(hasTFS?2:0)+(hasC1?2:0)+(hasSol?2:0)+2} style={{padding:"3px 8px",color:"#991B1B",fontSize:"9px"}}>
                      ⚠ {!ok1i?`TC1 Imp Σ ${toIt(String(s1i))} ≠ ${toIt(ref.ImpCPDEL||"0,00")} (diff ${toIt(String(round2(s1i-parseIt(ref.ImpCPDEL))))})`:""}
                      {!ok1c?` | TC1 Cont Σ ${toIt(String(s1c))} ≠ ${toIt(ref.ContribCPDEL||"0,00")}`:""}
                    </td>
                  </tr>
                ].filter(Boolean);
              })}
              {years.length>1&&(
                <tr style={{background:"#EFF6FF",fontWeight:"700",borderTop:"2px solid #17304A"}}>
                  <td style={{...C.td,color:"#0369A1",fontSize:"9px",position:"sticky",left:0,background:"#EFF6FF"}}>TOTALE</td>
                  <td style={{...C.tdR,color:"#059669",fontSize:"10px"}}>{toIt(String(sumTot("tc1Imp")))}</td>
                  <td style={{...C.tdR,color:"#059669",fontSize:"10px"}}>{toIt(String(sumTot("tc1Cont")))}</td>
                  <td style={{...C.tdR,color:"#059669",fontSize:"10px"}}>{toIt(String(sumTot("tc9Imp")))}</td>
                  <td style={{...C.tdR,color:"#059669",fontSize:"10px"}}>{toIt(String(sumTot("tc9Cont")))}</td>
                  {hasTFS&&<><td style={{...C.tdR,color:"#059669",fontSize:"10px"}}>{toIt(String(sumTot("tc7Imp")))}</td><td style={{...C.tdR,color:"#059669",fontSize:"10px"}}>{toIt(String(sumTot("tc7Cont")))}</td></>}
                  {hasC1&&<><td style={{...C.tdR,color:"#059669",fontSize:"10px"}}>{toIt(String(sumTot("tc6Imp")))}</td><td style={{...C.tdR,color:"#059669",fontSize:"10px"}}>{toIt(String(sumTot("tc6Cont")))}</td></>}
                  {hasSol&&<><td style={{...C.tdR,color:"#059669",fontSize:"10px"}}>{toIt(String(sumTot("tcSImp")))}</td><td style={{...C.tdR,color:"#059669",fontSize:"10px"}}>{toIt(String(sumTot("tcSCont")))}</td></>}
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{fontSize:"9px",color:"#64748B",marginTop:"5px"}}>
          Dicembre ×2 = doppio importo. Righe Σ verdi = congruenti. Rosse = scostamento da correggere.
        </div>
        <div style={{display:"flex",gap:"8px",justifyContent:"flex-end",marginTop:"8px"}}>
          <button style={C.btn()} onClick={()=>setCumuloModal(null)}>Annulla</button>
          <button style={C.btn()} onClick={()=>setCumuloModal(p=>({...p,step:2}))}>← Rivedi totali</button>
          <button style={{...C.btn("s"),padding:"5px 16px",fontSize:"12px"}} onClick={confirmCumulo}>✓ Conferma e aggiungi V1</button>
        </div>
      </>
    );

    return(
      <div style={C.modal}>
        <div style={{...C.modalBox,maxWidth:"940px",width:"96%",maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
          <div style={{marginBottom:"11px",flexShrink:0}}>
            <div style={{fontSize:"15px",fontWeight:"700",color:"#5B21B6",marginBottom:"3px",letterSpacing:"-0.01em"}}>∑ Cumulo Mensilità</div>
            <div style={{fontSize:"10px",color:"#64748B"}}>
              Causale 5 fissa · Distribuzione automatica su annualità (÷13 dicembre doppio) o periodo parziale (÷N mesi)
            </div>
          </div>
          <div style={{overflowY:"auto",flex:1}}>
            {step===1&&step1}
            {step===2&&step2}
            {step===3&&step3}
          </div>
        </div>
      </div>
    );
  };

  /* ════ IMPORT MODALE ════ */
  const renderImport=()=>{
    if(!importModal)return null;
    return(
      <div style={C.modal}>
        <div style={{...C.modalBox,maxWidth:"620px",width:"94%",maxHeight:"85vh",display:"flex",flexDirection:"column"}}>
          <div style={{marginBottom:"12px"}}>
            <div style={{fontSize:"15px",fontWeight:"700",color:"#166534",marginBottom:"4px",letterSpacing:"-0.01em"}}>Importa XML</div>
            <div style={{fontSize:"11px",color:"#374151",lineHeight:"1.6"}}>
              <strong style={{color:"#059669"}}>{importModal.azienda.RagSocAzienda || importModal.azienda.CFAzienda}</strong>
              {" "}· {importModal.azienda.AnnoMeseDenuncia}
              {" "}· {importModal.isVariazione ? "Flusso VARIAZIONE" : "Flusso STANDARD"}
              {" "}· {importModal.workers.length} dipendente{importModal.workers.length!==1?"i":""} trovato{importModal.workers.length!==1?"i":""}
            </div>
          </div>
          {importModal.errors.length>0&&(
            <div style={{background:"#FFFBEB",border:"1px solid #FCD34D",borderRadius:"5px",padding:"7px 10px",marginBottom:"10px",fontSize:"10px",color:"#92400E",lineHeight:"1.6",flexShrink:0}}>
              <strong>⚠ Avvisi import ({importModal.errors.length}):</strong><br/>
              {importModal.errors.map((e,i)=><span key={i}>{e}<br/></span>)}
            </div>
          )}
          <div style={{fontSize:"10px",color:"#374151",marginBottom:"6px",flexShrink:0}}>
            Seleziona i dipendenti da importare:
            <button style={{...C.btn(),marginLeft:"8px",fontSize:"9px",padding:"2px 7px"}}
              onClick={()=>setImportModal(p=>({...p,selected:new Set(p.workers.map(w=>w.id))}))}>Tutti</button>
            <button style={{...C.btn(),marginLeft:"4px",fontSize:"9px",padding:"2px 7px"}}
              onClick={()=>setImportModal(p=>({...p,selected:new Set()}))}>Nessuno</button>
          </div>
          <div style={{overflowY:"auto",flex:1,marginBottom:"12px",border:"1px solid #E5E7EB",borderRadius:"5px"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
              <thead>
                <tr>
                  <th style={{...C.th,width:"28px"}}></th>
                  <th style={C.th}>CF Lavoratore</th>
                  <th style={C.th}>Cognome</th>
                  <th style={C.th}>Nome</th>
                  <th style={C.th}>Comune</th>
                  <th style={C.th}>Periodi</th>
                  <th style={C.th}>EV</th>
                </tr>
              </thead>
              <tbody>
                {importModal.workers.map(w=>{
                  const sel=importModal.selected.has(w.id);
                  const totEVw=w.periodi.reduce((s,p)=>s+p.enteVersante.length,0);
                  return(
                    <tr key={w.id} style={{background:sel?"#ECFDF5":"transparent",cursor:"pointer"}}
                      onClick={()=>setImportModal(p=>{
                        const s=new Set(p.selected);
                        sel?s.delete(w.id):s.add(w.id);
                        return{...p,selected:s};
                      })}>
                      <td style={{...C.td,textAlign:"center"}}><input type="checkbox" readOnly checked={sel} style={{cursor:"pointer"}}/></td>
                      <td style={{...C.td,fontFamily:"monospace",fontSize:"11px",color:sel?"#86EFAC":"#374151"}}>{w.CFLavoratore||"—"}</td>
                      <td style={{...C.td,color:sel?"#065F46":"#64748B"}}>{w.Cognome||"—"}</td>
                      <td style={{...C.td,color:sel?"#065F46":"#64748B"}}>{w.Nome||"—"}</td>
                      <td style={{...C.td,color:"#374151"}}>{w.CodiceComune||"—"}</td>
                      <td style={{...C.td,textAlign:"center",...C.bdg("#059669")}}>{w.periodi.length}</td>
                      <td style={{...C.td,textAlign:"center",...C.bdg("#0D9488")}}>{totEVw}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!importModal.isVariazione&&(
            <div style={{fontSize:"10px",color:"#166534",marginBottom:"10px",padding:"6px 9px",background:"#F0FDF4",border:"1px solid #86EFAC",borderRadius:"5px",flexShrink:0}}>
              File standard: periodi E0 importati come V1 causale 5. EnteVersante pre-compilata con tripla TC1+TC9+TC7 vuota.
            </div>
          )}
          <div style={{display:"flex",gap:"8px",justifyContent:"flex-end",flexShrink:0,flexWrap:"wrap"}}>
            <button style={C.btn()} onClick={()=>setImportModal(null)}>Annulla</button>
            <button style={{...C.btn("p"),padding:"5px 14px",opacity:importModal.selected.size===0?0.4:1}}
              disabled={importModal.selected.size===0} onClick={()=>doImport("merge")}>
              Aggiungi ai dati correnti ({importModal.selected.size})
            </button>
            <button style={{...C.btn("s"),padding:"5px 14px",opacity:importModal.selected.size===0?0.4:1}}
              disabled={importModal.selected.size===0} onClick={()=>doImport("replace")}>
              Sostituisci lavorazione ({importModal.selected.size})
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ════ MAIN RENDER ════ */
  return(
    <div style={C.app}>

      {renderCumulo()}
      {renderImport()}

      {showReset&&(
        <div style={C.modal}>
          <div style={C.modalBox}>
            <div style={{fontSize:"15px",fontWeight:"700",color:"#991B1B",marginBottom:"10px",letterSpacing:"-0.01em"}}>Nuova Lavorazione</div>
            <div style={{fontSize:"12px",color:"#6B7280",marginBottom:"18px",lineHeight:"1.65"}}>
              Tutti i dati correnti verranno cancellati. L'operazione non è reversibile.
            </div>
            <div style={{display:"flex",gap:"10px",justifyContent:"flex-end"}}>
              <button style={C.btn()} onClick={()=>setShowReset(false)}>Annulla</button>
              <button style={{...C.btn("x"),padding:"6px 18px",fontSize:"12px"}} onClick={doReset}>Conferma reset</button>
            </div>
          </div>
        </div>
      )}

      <div style={C.hdr}>
        <div>
          <div style={C.hdrT}>⬛ UniEmens Variazione Builder v6</div>
          <div style={C.hdrS}>TFR fields · Causale 6 fix · Copia coppia EV · Tripla TC1+TC9+TC7 · TC8 TFR · Fix 00124I · dedup · congruità real-time · PDF · Import XML · Cumulo</div>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:"8px",alignItems:"center"}}>
          <span style={{fontSize:"11px",color:"#94A3B8",fontVariantNumeric:"tabular-nums"}}>{dips.length} dip. · {totPer} V1 · {totEV} EV</span>
          <input ref={fileRef} type="file" accept=".xml" style={{display:"none"}} onChange={handleFileImport}/>
          <button style={{...C.btn("imp"),padding:"5px 12px"}} onClick={()=>fileRef.current?.click()}>⬆ Importa XML</button>
          <button style={{...C.btn("pdf"),padding:"5px 12px"}} onClick={()=>generatePDF(m,a,dips)}>⬛ PDF</button>
          <button style={{...C.btn("w"),padding:"5px 12px"}} onClick={()=>setShowReset(true)}>↺ Nuova lavorazione</button>
        </div>
      </div>

      <div style={C.tabs}>
        {["1. Intestazione","2. Dipendenti / V1","3. Genera XML"].map((t,i)=>(
          <button key={i} style={C.tab(tab===i)} onClick={()=>setTab(i)}>{t}</button>
        ))}
      </div>

      <div style={C.body}>
        {tab===0&&<>
          <div style={C.sec}>
            <div style={C.sT}>DatiMittente</div>
            <div style={C.row}>
              <F label="CF Persona Mittente" value={m.CFPersonaMittente} onChange={mf("CFPersonaMittente")} ph="CF firmatario" w="176px"/>
              <F label="Ragione Sociale Mittente" value={m.RagSocMittente} onChange={mf("RagSocMittente")} ph="COMUNE DI ..." full/>
            </div>
            <div style={C.row}>
              <F label="CF Mittente (Ente)" value={m.CFMittente} onChange={mf("CFMittente")} ph="11 cifre" w="156px"/>
              <F label="CF Softwarehouse" value={m.CFSoftwarehouse} onChange={mf("CFSoftwarehouse")} ph="11 cifre" w="156px"/>
              <F label="Sede INPS" value={m.SedeINPS} onChange={mf("SedeINPS")} ph="7601" w="96px"/>
            </div>
          </div>
          <div style={C.sec}>
            <div style={C.sT}>Azienda / ListaPosPA</div>
            <div style={C.row}>
              <F label="Anno-Mese Denuncia" value={a.AnnoMeseDenuncia} onChange={af("AnnoMeseDenuncia")} ph="YYYY-MM" w="126px"/>
              <F label="CF Azienda" value={a.CFAzienda} onChange={af("CFAzienda")} ph="11 cifre" w="156px"/>
              <F label="Ragione Sociale Ente" value={a.RagSocAzienda} onChange={af("RagSocAzienda")} ph="COMUNE DI ..." full/>
            </div>
            <div style={C.row}>
              <F label="PRGAZIENDA" value={a.PRGAZIENDA} onChange={af("PRGAZIENDA")} ph="00000" w="86px"/>
              <F label="CF Rappresentante Firmatario" value={a.CFRappresentanteFirmatario} onChange={af("CFRappresentanteFirmatario")} ph="CF rep." w="196px"/>
              <F label="Codice ISTAT" value={a.ISTAT} onChange={af("ISTAT")} ph="841110" w="146px"/>
              <F label="Forma Giuridica" value={a.FormaGiuridica} onChange={af("FormaGiuridica")} opts={FG_OPTS} w="236px"/>
            </div>
          </div>
          <div style={{...C.sec,background:"#EFF6FF",borderColor:"#0E2030",fontSize:"11px",color:"#1E40AF",lineHeight:"1.8"}}>
            <strong style={{color:"#0369A1"}}>v6 — Novità:</strong> TFR: RetribTeoricaTabellareTFR + ImponibileTFRUlterioriElem + RetribValutabileTFR (auto) · Causale 6 solo date in XML · +Riga crea tripla TC1+TC9+TC7 · 📋 copia coppia al mese successivo · TC8 = TFR (EnteVers.)
          </div>
        </>}

        {tab===1&&<>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:"10px"}}>
            <button style={{...C.btn("p"),padding:"6px 16px",fontSize:"12px"}} onClick={addDip}>+ Aggiungi dipendente</button>
          </div>
          {dips.length===0&&<div style={C.empty}>Nessun dipendente.</div>}
          {dips.map(dip=>(
            <div key={dip.id} style={C.card}>
              <div style={C.cHdr} onClick={()=>{setXDip(xDip===dip.id?null:dip.id);setXPer(null);}}>
                <div style={{display:"flex",gap:"10px",alignItems:"center"}}>
                  <span style={{...C.mono,color:"#0369A1",fontWeight:"700",fontSize:"12px"}}>{dip.CFLavoratore||"— CF —"}</span>
                  <span style={{color:"#4A6E8C"}}>{dip.Cognome||"Cognome"} {dip.Nome||"Nome"}</span>
                  <span style={{...C.bdg("#059669"),fontSize:"9px"}}>{dip.periodi.length} V1</span>
                  {dip.periodi.some(p=>hasWarn(p))&&<span style={{...C.bdg("#EF4444"),fontSize:"9px"}}>⚠ CONGRUITÀ</span>}
                </div>
                <div style={{display:"flex",gap:"6px"}}>
                  <span style={{fontSize:"10px",color:xDip===dip.id?"#0369A1":"#94A3B8"}}>{xDip===dip.id?"▲":"▼"}</span>
                  <button style={C.btn("x")} onClick={e=>{e.stopPropagation();removeDip(dip.id);}}>✕</button>
                </div>
              </div>
              {xDip===dip.id&&renderDip(dip)}
            </div>
          ))}
        </>}

        {tab===2&&<>
          <div style={{display:"flex",gap:"10px",marginBottom:"13px",alignItems:"center",flexWrap:"wrap"}}>
            <button style={{...C.btn("s"),padding:"7px 20px",fontSize:"13px"}} onClick={genera}>⚡ Genera XML</button>
            {xml&&<button style={{...C.btn("p"),padding:"7px 20px",fontSize:"13px"}} onClick={scarica}>⬇ Scarica XML</button>}
            {xml&&<span style={{fontSize:"11px",color:"#065F46",fontVariantNumeric:"tabular-nums"}}>✓ {xml.length.toLocaleString("it")} car. · {totPer} D0 in 1 PosPA{a.AnnoMeseDenuncia&&<> · UNIEV{a.AnnoMeseDenuncia.replace("-","").slice(2)}.xml</>}</span>}
          </div>
          {dupCount!==null&&(dupCount>0
            ?<div style={C.alert("w")}>⚠ Dedup: {dupCount} riga{dupCount>1?"he":""} EnteVersante duplicate rimosse.</div>
            :<div style={C.alert("o")}>✓ Dedup: nessuna riga duplicata.</div>
          )}
          {warns.map((w,i)=>(
            <div key={i} style={C.alert("e")}>
              ⚠ <strong>{w.code}</strong> · {w.who} · {w.period}<br/>
              {w.field}: Somma EV = {w.val} | Limite = {w.limit} | Eccesso = {w.excess}
            </div>
          ))}
          {warns.length===0&&dupCount!==null&&<div style={C.alert("o")}>✓ Nessuna violazione di congruità rilevata.</div>}
          {!xml&&<div style={C.empty}>Clicca "Genera XML" per produrre il flusso UniEmens variazione.</div>}
          {xml&&<textarea style={{width:"100%",height:"480px",background:"#040B14",border:"1px solid #E5E7EB",borderRadius:"6px",color:"#166534",fontFamily:"'Courier New',monospace",fontSize:"11px",padding:"11px",boxSizing:"border-box",outline:"none",resize:"vertical",lineHeight:"1.55"}} value={xml} readOnly/>}
        </>}
      </div>
    </div>
  );
}
