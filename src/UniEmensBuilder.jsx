import { useState } from "react";

/* ═══ UTILITIES ═══ */
const uid = () => Math.random().toString(36).slice(2, 9);
const toIt = (v) => { const n = parseFloat(String(v || "0").replace(",", ".")); return isNaN(n) ? "0,00" : n.toFixed(2).replace(".", ","); };
const parseIt = (v) => { const n = parseFloat(String(v || "0").replace(",", ".")); return isNaN(n) ? 0 : n; };
const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ═══════════════════════════════════════════════════════════
   XML BUILDER
   FIX CRITICO 00124I: un solo <PosPA> per tutti i D0.
   Struttura errata (causa 00124I):  <PosPA><D0>1</D0></PosPA><PosPA><D0>2</D0></PosPA>
   Struttura corretta:               <PosPA><D0>1</D0><D0>2</D0></PosPA>
═══════════════════════════════════════════════════════════ */
function buildXML(m, a, dips) {
  let x = `<?xml version="1.0" encoding="UTF-8"?>\n<DenunceMensili>\n`;
  x += `   <DatiMittente Tipo="1">\n      <CFPersonaMittente>${esc(m.CFPersonaMittente)}</CFPersonaMittente>\n      <RagSocMittente>${esc(m.RagSocMittente)}</RagSocMittente>\n      <CFMittente>${esc(m.CFMittente)}</CFMittente>\n      <CFSoftwarehouse>${esc(m.CFSoftwarehouse)}</CFSoftwarehouse>\n      <SedeINPS>${esc(m.SedeINPS)}</SedeINPS>\n   </DatiMittente>\n`;
  x += `   <Azienda>\n      <AnnoMeseDenuncia>${esc(a.AnnoMeseDenuncia)}</AnnoMeseDenuncia>\n      <CFAzienda>${esc(a.CFAzienda)}</CFAzienda>\n      <RagSocAzienda>${esc(a.RagSocAzienda)}</RagSocAzienda>\n`;
  x += `      <ListaPosPA TipoListaPosPA="1">\n          <PRGAZIENDA>${esc(a.PRGAZIENDA || "00000")}</PRGAZIENDA>\n          <CFRappresentanteFirmatario>${esc(a.CFRappresentanteFirmatario)}</CFRappresentanteFirmatario>\n          <ISTAT>${esc(a.ISTAT)}</ISTAT>\n          <FormaGiuridica>${esc(a.FormaGiuridica)}</FormaGiuridica>\n`;
  x += `          <PosPA>\n`; // ← UNICO blocco PosPA per l'intero ente (fix errore 00124I)

  for (const d of dips) {
    for (const p of d.periodi) {
      x += `              <D0_DenunciaIndividuale>\n`;
      x += `                  <CFLavoratore>${esc(d.CFLavoratore)}</CFLavoratore>\n                  <Cognome>${esc(d.Cognome)}</Cognome>\n                  <Nome>${esc(d.Nome)}</Nome>\n`;
      x += `                  <DatiSedeLavoro>\n                      <CodiceComune>${esc(d.CodiceComune)}</CodiceComune>\n                      <CAP>${esc(d.CAP)}</CAP>\n                  </DatiSedeLavoro>\n`;
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
        x += `                      <EnteVersante>\n                          <TipoContributo>${esc(ev.TipoContributo)}</TipoContributo>\n                          <CFAzienda>${esc(ev.CFAzienda)}</CFAzienda>\n                          <PRGAZIENDA>${esc(ev.PRGAZIENDA || "00000")}</PRGAZIENDA>\n                          <Imponibile>${toIt(ev.Imponibile)}</Imponibile>\n                          <Contributo>${toIt(ev.Contributo)}</Contributo>\n                          <AnnoMeseErogazione>${esc(ev.AnnoMeseErogazione)}</AnnoMeseErogazione>\n                          <Aliquota>${esc(ev.Aliquota || "2")}</Aliquota>\n                      </EnteVersante>\n`;
      }
      x += `                  </V1_PeriodoPrecedente>\n              </D0_DenunciaIndividuale>\n`;
    }
  }

  x += `          </PosPA>\n      </ListaPosPA>\n   </Azienda>\n</DenunceMensili>`;
  return x;
}

/* ═══ DEDUP — rimuove EnteVersante duplicate prima dell'export ═══ */
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

/* ═══ VALIDATION — regola 00172I: Sum(TC1+TC5 EV) ≤ ContribCPDEL + Contrib1% ═══ */
function validateTC1Sum(dips) {
  return dips.flatMap(d =>
    d.periodi.flatMap(p => {
      if (!p.ImpCPDEL) return [];
      const sumTC1 = p.enteVersante.filter(e => e.TipoContributo === "1" || e.TipoContributo === "5").reduce((s, e) => s + parseIt(e.Contributo), 0);
      const limit = parseIt(p.ContribCPDEL) + parseIt(p.Contrib1Perc);
      if (sumTC1 > limit + 0.005) return [{ who: `${d.Cognome} ${d.Nome} (${d.CFLavoratore})`, period: `${p.GiornoInizio} → ${p.GiornoFine}`, sumTC1: toIt(String(sumTC1)), limit: toIt(String(limit)), excess: toIt(String(sumTC1 - limit)) }];
      return [];
    })
  );
}

/* ═══ STYLES ═══ */
const C = {
  app: { fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: "13px", background: "#0b1523", color: "#cce0f0", minHeight: "100vh", display: "flex", flexDirection: "column" },
  hdr: { background: "#0e1d30", borderBottom: "1px solid #1a334f", padding: "10px 16px", display: "flex", alignItems: "center", gap: "10px" },
  hdrT: { fontSize: "14px", fontWeight: "700", color: "#00c8e0" },
  hdrS: { fontSize: "10px", color: "#3a5a78", marginTop: "2px" },
  tabs: { display: "flex", background: "#0d1928", borderBottom: "1px solid #162840" },
  tab: (a) => ({ padding: "8px 18px", cursor: "pointer", fontSize: "12px", fontWeight: "600", border: "none", background: "transparent", color: a ? "#00c8e0" : "#3a5a78", borderBottom: a ? "2px solid #00c8e0" : "2px solid transparent" }),
  body: { flex: 1, overflowY: "auto", padding: "14px" },
  sec: { background: "#0f1e30", border: "1px solid #1a334f", borderRadius: "6px", padding: "13px", marginBottom: "12px" },
  sT: { fontSize: "10px", fontWeight: "700", color: "#00a8c0", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px", paddingBottom: "6px", borderBottom: "1px solid #162840" },
  row: { display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "8px" },
  lbl: { fontSize: "10px", color: "#3a6080", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "3px", display: "block" },
  inp: { background: "#080f1a", border: "1px solid #1a3550", borderRadius: "3px", color: "#c8dff0", padding: "4px 7px", fontSize: "12px", fontFamily: "monospace", outline: "none", width: "100%", boxSizing: "border-box" },
  inpG: { background: "#05160a", border: "1px solid #0a3a20", borderRadius: "3px", color: "#80e8a8", padding: "4px 7px", fontSize: "12px", fontFamily: "monospace", outline: "none", width: "100%", boxSizing: "border-box" },
  sel: { background: "#080f1a", border: "1px solid #1a3550", borderRadius: "3px", color: "#c8dff0", padding: "4px 7px", fontSize: "11px", outline: "none", width: "100%", boxSizing: "border-box" },
  btn: (v = "d") => ({ padding: "4px 11px", borderRadius: "3px", border: "none", cursor: "pointer", fontSize: "11px", fontWeight: "600", background: v === "p" ? "#005a80" : v === "s" ? "#006040" : v === "x" ? "#6a1515" : v === "w" ? "#5a4000" : "#162840", color: v === "p" ? "#b0e4f8" : v === "s" ? "#90f0d0" : v === "x" ? "#f0b0b0" : v === "w" ? "#f0d080" : "#7aaac8" }),
  card: { background: "#0e1c2c", border: "1px solid #1a334f", borderRadius: "5px", marginBottom: "7px", overflow: "hidden" },
  cHdr: { padding: "9px 13px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", background: "#0b1622" },
  cBody: { padding: "12px 13px" },
  sub: { background: "#07111e", border: "1px solid #162840", borderRadius: "4px", padding: "9px", marginBottom: "9px" },
  subT: { fontSize: "9px", fontWeight: "700", color: "#008aa0", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "7px" },
  th: { background: "#060e18", padding: "3px 6px", textAlign: "left", color: "#2a5070", fontWeight: "700", fontSize: "10px", borderBottom: "1px solid #162840", whiteSpace: "nowrap" },
  td: { padding: "3px 4px", borderBottom: "1px solid #0d1c2c", verticalAlign: "top" },
  bdg: (c) => ({ background: c + "22", color: c, padding: "1px 6px", borderRadius: "3px", fontSize: "10px", fontWeight: "700", fontFamily: "monospace", whiteSpace: "nowrap" }),
  mono: { fontFamily: "monospace", fontSize: "11px" },
  empty: { textAlign: "center", color: "#1a3050", padding: "30px", fontSize: "12px" },
  alert: (t) => ({ background: t === "e" ? "#1a0a0a" : t === "o" ? "#061a0e" : "#1a1200", border: `1px solid ${t === "e" ? "#5a2020" : t === "o" ? "#0a5a28" : "#5a4000"}`, borderRadius: "5px", padding: "10px 12px", marginBottom: "10px", fontSize: "11px", color: t === "e" ? "#e8a0a0" : t === "o" ? "#80e8b0" : "#e8d080", lineHeight: "1.6" }),
};

/* ═══ FIELD ═══ */
function F({ label, value, onChange, ph = "", w = "140px", full = false, opts = null, green = false, note = "" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: full ? "1 1 100%" : `1 1 ${w}`, minWidth: full ? "180px" : w }}>
      <label style={C.lbl}>{label}{note && <span style={{ color: "#20a060", marginLeft: "4px", fontWeight: "700" }}>{note}</span>}</label>
      {opts
        ? <select style={C.sel} value={value} onChange={e => onChange(e.target.value)}>{opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
        : <input style={green ? C.inpG : C.inp} value={value} onChange={e => onChange(e.target.value)} placeholder={ph} />}
    </div>
  );
}

/* ═══ LOOKUP TABLES ═══ */
const CAUSALE = [{ v: "1", l: "1 – Integrazione" }, { v: "5", l: "5 – Sostituzione / mai denunciato" }, { v: "6", l: "6 – Annullamento" }, { v: "7", l: "7 – Conguaglio previdenziale" }];
const TIPO_IMPIEGO = [{ v: "1", l: "1 – TI tempo pieno" }, { v: "2", l: "2 – TI part-time" }, { v: "8", l: "8 – TD tempo pieno" }, { v: "9", l: "9 – TD part-time" }];
const TIPO_SERVIZIO = [{ v: "4", l: "4 – Ordinario" }, { v: "5", l: "5 – Straordinario" }, { v: "6", l: "6 – Lavoro autonomo" }];
const REGIME_FS = [{ v: "1", l: "1 – TFR privatistico" }, { v: "2", l: "2 – TFR misto" }, { v: "3", l: "3 – TFS (INADEL)" }];
const TIPO_PT = [{ v: "O", l: "O – Orizzontale" }, { v: "V", l: "V – Verticale" }, { v: "M", l: "M – Misto" }, { v: "P", l: "P – Verticale ciclico" }];
const TC_OPTS = [{ v: "1", l: "1 – CPDEL" }, { v: "2", l: "2 – Cassa Ins." }, { v: "3", l: "3 – Cassa San." }, { v: "5", l: "5 – Agg. spec." }, { v: "6", l: "6 – Agg. 1%" }, { v: "7", l: "7 – TFS/INADEL" }, { v: "8", l: "8 – Cred.45/07" }, { v: "9", l: "9 – Fondo Cred." }];
const FG_OPTS = [{ v: "2410", l: "2410 – Regione" }, { v: "2420", l: "2420 – Provincia" }, { v: "2430", l: "2430 – Comune" }, { v: "2440", l: "2440 – Comunità montana" }, { v: "2450", l: "2450 – Unione comuni" }, { v: "2460", l: "2460 – Città metropolitana" }, { v: "2711", l: "2711 – Ente pubblico ricerca" }, { v: "2712", l: "2712 – IPAB" }, { v: "2720", l: "2720 – Camera di commercio" }, { v: "2740", l: "2740 – Consorzio dir. pub." }, { v: "2790", l: "2790 – Altro ente pub." }];

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════ */
export default function UniEmensBuilder() {
  const [tab, setTab] = useState(0);
  const [m, setM] = useState({ CFPersonaMittente: "", RagSocMittente: "", CFMittente: "", CFSoftwarehouse: "00000000000", SedeINPS: "" });
  const [a, setA] = useState({ AnnoMeseDenuncia: "", CFAzienda: "", RagSocAzienda: "", PRGAZIENDA: "00000", CFRappresentanteFirmatario: "", ISTAT: "", FormaGiuridica: "2430" });
  const [dips, setDips] = useState([]);
  const [xDip, setXDip] = useState(null);
  const [xPer, setXPer] = useState(null);
  const [xml, setXml] = useState("");
  const [dupCount, setDupCount] = useState(null);
  const [warns, setWarns] = useState([]);

  const mf = (k) => (v) => setM(p => ({ ...p, [k]: v }));
  const af = (k) => (v) => setA(p => ({ ...p, [k]: v }));

  // mkPer: periodo con coppia TC1+TC9 pre-abbinata
  const mkPer = () => {
    const tc1id = uid(), tc9id = uid();
    return {
      id: uid(), CausaleVariazione: "5", GiornoInizio: "", GiornoFine: "",
      TipoImpiego: "1", TipoServizio: "4", Contratto: "RALN", Qualifica: "",
      hasPartTime: false, TipoPartTime: "O", PercPartTime: "", RegimeFineServizio: "3",
      ImpCPDEL: "", ContribCPDEL: "", Contrib1Perc: "", StipTabellare: "0,00", RetribAnzianita: "0,00",
      regimeTFS: "TFS", ImpTFS: "", ContribTFS: "",
      ImpCredito: "", ContribCredito: "", // auto-sync con ImpCPDEL
      CodiceCessazione: "",
      enteVersante: [
        { id: tc1id, TipoContributo: "1", CFAzienda: a.CFAzienda, PRGAZIENDA: a.PRGAZIENDA || "00000", Imponibile: "", Contributo: "", AnnoMeseErogazione: "", Aliquota: "2", pairedTc9: tc9id },
        { id: tc9id, TipoContributo: "9", CFAzienda: a.CFAzienda, PRGAZIENDA: a.PRGAZIENDA || "00000", Imponibile: "", Contributo: "", AnnoMeseErogazione: "", Aliquota: "2", pairedWith: tc1id },
      ],
    };
  };

  // Dipendenti CRUD
  const addDip = () => { const d = { id: uid(), CFLavoratore: "", Cognome: "", Nome: "", CodiceComune: "", CAP: "", periodi: [] }; setDips(p => [...p, d]); setXDip(d.id); setXPer(null); };
  const removeDip = (id) => { setDips(p => p.filter(d => d.id !== id)); if (xDip === id) { setXDip(null); setXPer(null); } };
  const updDip = (id, k, v) => setDips(p => p.map(d => d.id === id ? { ...d, [k]: v } : d));

  // Periodi CRUD
  const addPer = (dipId) => { const p = mkPer(); setDips(ds => ds.map(d => d.id === dipId ? { ...d, periodi: [...d.periodi, p] } : d)); setXPer(p.id); };
  const removePer = (dipId, perId) => { setDips(ds => ds.map(d => d.id === dipId ? { ...d, periodi: d.periodi.filter(p => p.id !== perId) } : d)); if (xPer === perId) setXPer(null); };

  // updPer: ImpCPDEL → ImpCredito auto-sync
  const updPer = (dipId, perId, k, v) =>
    setDips(ds => ds.map(d => d.id === dipId
      ? { ...d, periodi: d.periodi.map(p => { if (p.id !== perId) return p; const u = { [k]: v }; if (k === "ImpCPDEL") u.ImpCredito = v; return { ...p, ...u }; }) }
      : d
    ));

  // addEV: crea sempre coppia TC1+TC9
  const addEV = (dipId, perId) => {
    const tc1id = uid(), tc9id = uid();
    const base = { CFAzienda: a.CFAzienda, PRGAZIENDA: a.PRGAZIENDA || "00000", Imponibile: "", Contributo: "", AnnoMeseErogazione: "", Aliquota: "2" };
    const tc1 = { id: tc1id, ...base, TipoContributo: "1", pairedTc9: tc9id };
    const tc9 = { id: tc9id, ...base, TipoContributo: "9", pairedWith: tc1id };
    setDips(ds => ds.map(d => d.id === dipId ? { ...d, periodi: d.periodi.map(p => p.id === perId ? { ...p, enteVersante: [...p.enteVersante, tc1, tc9] } : p) } : d));
  };

  // updEV: TC1 Imponibile/AnnoMese → auto-sync TC9 abbinata
  const updEV = (dipId, perId, evId, k, v) =>
    setDips(ds => ds.map(d => {
      if (d.id !== dipId) return d;
      return {
        ...d,
        periodi: d.periodi.map(p => {
          if (p.id !== perId) return p;
          const upd = p.enteVersante.map(ev => ev.id === evId ? { ...ev, [k]: v } : ev);
          const ch = upd.find(ev => ev.id === evId);
          if (ch && ch.TipoContributo === "1" && ch.pairedTc9 && (k === "Imponibile" || k === "AnnoMeseErogazione"))
            return { ...p, enteVersante: upd.map(ev => ev.id === ch.pairedTc9 ? { ...ev, [k]: v } : ev) };
          return { ...p, enteVersante: upd };
        }),
      };
    }));

  const removeEV = (dipId, perId, evId) =>
    setDips(ds => ds.map(d => d.id === dipId ? { ...d, periodi: d.periodi.map(p => p.id === perId ? { ...p, enteVersante: p.enteVersante.filter(ev => ev.id !== evId) } : p) } : d));

  // Genera con dedup + validation
  const genera = () => {
    const { dips: dd, count } = deduplicateEV(dips);
    setDupCount(count);
    setWarns(validateTC1Sum(dd));
    setXml(buildXML(m, a, dd));
  };

  const scarica = () => {
    if (!xml) return;
    const yymm = a.AnnoMeseDenuncia.replace("-", "").slice(2) || "XXXX";
    const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const l = document.createElement("a");
    l.href = url; l.download = `UNIEV${yymm}.xml`; l.click();
    URL.revokeObjectURL(url);
  };

  const totPer = dips.reduce((s, d) => s + d.periodi.length, 0);
  const totEV = dips.reduce((s, d) => s + d.periodi.reduce((ss, p) => ss + p.enteVersante.length, 0), 0);

  // helper: check TC1 warning per periodo
  const tc1Warn = (p) => {
    if (!p.ImpCPDEL || !p.ContribCPDEL) return false;
    const s = p.enteVersante.filter(e => e.TipoContributo === "1" || e.TipoContributo === "5").reduce((acc, e) => acc + parseIt(e.Contributo), 0);
    return s > parseIt(p.ContribCPDEL) + parseIt(p.Contrib1Perc) + 0.005;
  };

  /* ════ RENDER periodo ════ */
  const renderPer = (dip, p) => (
    <div style={C.cBody}>
      <div style={C.sub}>
        <div style={C.subT}>Periodo e Causale</div>
        <div style={C.row}>
          <F label="Causale variazione" value={p.CausaleVariazione} onChange={v => updPer(dip.id, p.id, "CausaleVariazione", v)} opts={CAUSALE} w="230px" />
          <F label="Giorno inizio" value={p.GiornoInizio} onChange={v => updPer(dip.id, p.id, "GiornoInizio", v)} ph="YYYY-MM-DD" w="130px" />
          <F label="Giorno fine" value={p.GiornoFine} onChange={v => updPer(dip.id, p.id, "GiornoFine", v)} ph="YYYY-MM-DD" w="130px" />
          <F label="Cod. cessazione" value={p.CodiceCessazione} onChange={v => updPer(dip.id, p.id, "CodiceCessazione", v)} ph="es. 3" w="110px" />
        </div>
      </div>

      <div style={C.sub}>
        <div style={C.subT}>InquadramentoLavPA</div>
        <div style={C.row}>
          <F label="Tipo impiego" value={p.TipoImpiego} onChange={v => updPer(dip.id, p.id, "TipoImpiego", v)} opts={TIPO_IMPIEGO} w="200px" />
          <F label="Tipo servizio" value={p.TipoServizio} onChange={v => updPer(dip.id, p.id, "TipoServizio", v)} opts={TIPO_SERVIZIO} w="180px" />
          <F label="Contratto" value={p.Contratto} onChange={v => updPer(dip.id, p.id, "Contratto", v)} ph="RALN" w="88px" />
          <F label="Qualifica" value={p.Qualifica} onChange={v => updPer(dip.id, p.id, "Qualifica", v)} ph="042000" w="108px" />
          <F label="Regime fine servizio" value={p.RegimeFineServizio} onChange={v => updPer(dip.id, p.id, "RegimeFineServizio", v)} opts={REGIME_FS} w="180px" />
        </div>
        <div style={{ ...C.row, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <input type="checkbox" checked={p.hasPartTime} onChange={e => updPer(dip.id, p.id, "hasPartTime", e.target.checked)} style={{ cursor: "pointer" }} />
            <span style={{ fontSize: "11px", color: "#7aaac8" }}>Part-time</span>
          </div>
          {p.hasPartTime && <>
            <F label="Tipo PT" value={p.TipoPartTime} onChange={v => updPer(dip.id, p.id, "TipoPartTime", v)} opts={TIPO_PT} w="180px" />
            <F label="% (es. 50000)" value={p.PercPartTime} onChange={v => updPer(dip.id, p.id, "PercPartTime", v)} ph="50000" w="140px" />
          </>}
        </div>
      </div>

      <div style={C.sub}>
        <div style={C.subT}>GestPensionistica — CPDEL (CodGestione 2)</div>
        <div style={C.row}>
          <F label="Imponibile CPDEL" value={p.ImpCPDEL} onChange={v => updPer(dip.id, p.id, "ImpCPDEL", v)} ph="0,00" w="138px" />
          <F label="Contributo CPDEL" value={p.ContribCPDEL} onChange={v => updPer(dip.id, p.id, "ContribCPDEL", v)} ph="0,00" w="138px" />
          <F label="Contrib. 1%" value={p.Contrib1Perc} onChange={v => updPer(dip.id, p.id, "Contrib1Perc", v)} ph="0,00" w="98px" />
          <F label="Stipendio tabellare" value={p.StipTabellare} onChange={v => updPer(dip.id, p.id, "StipTabellare", v)} ph="0,00" w="138px" />
          <F label="Retrib. anzianità" value={p.RetribAnzianita} onChange={v => updPer(dip.id, p.id, "RetribAnzianita", v)} ph="0,00" w="128px" />
        </div>
        {tc1Warn(p) && (() => {
          const s = p.enteVersante.filter(e => e.TipoContributo === "1" || e.TipoContributo === "5").reduce((acc, e) => acc + parseIt(e.Contributo), 0);
          const lim = parseIt(p.ContribCPDEL) + parseIt(p.Contrib1Perc);
          return <div style={{ fontSize: "10px", color: "#e8a060", background: "#1a1000", padding: "4px 7px", borderRadius: "3px", marginTop: "4px" }}>
            ⚠ Errore 00172I: Sum TC1 EV {toIt(String(s))} &gt; CPDEL+1% {toIt(String(lim))} (eccesso {toIt(String(s - lim))})
          </div>;
        })()}
      </div>

      <div style={C.sub}>
        <div style={C.subT}>GestPrevidenziale — TFS / TFR (CodGestione 6)</div>
        <div style={C.row}>
          <F label="Regime" value={p.regimeTFS} onChange={v => updPer(dip.id, p.id, "regimeTFS", v)} opts={[{ v: "TFS", l: "TFS (INADEL)" }, { v: "TFR", l: "TFR" }]} w="148px" />
          <F label={`Imponibile ${p.regimeTFS}`} value={p.ImpTFS} onChange={v => updPer(dip.id, p.id, "ImpTFS", v)} ph="0,00" w="138px" />
          <F label={`Contributo ${p.regimeTFS}`} value={p.ContribTFS} onChange={v => updPer(dip.id, p.id, "ContribTFS", v)} ph="0,00" w="138px" />
        </div>
      </div>

      <div style={C.sub}>
        <div style={C.subT}>GestCredito — Fondo Credito (CodGestione 9)</div>
        <div style={C.row}>
          <F label="Imponibile credito" value={p.ImpCredito} onChange={v => updPer(dip.id, p.id, "ImpCredito", v)} ph="0,00" w="138px"
            green={!!p.ImpCredito && p.ImpCredito === p.ImpCPDEL}
            note={p.ImpCredito && p.ImpCredito === p.ImpCPDEL ? "↔ CPDEL" : ""} />
          <F label="Contributo credito" value={p.ContribCredito} onChange={v => updPer(dip.id, p.id, "ContribCredito", v)} ph="0,00" w="138px" />
        </div>
        <div style={{ fontSize: "9px", color: "#1a5030" }}>Imponibile Credito = Imponibile CPDEL (auto-sync al cambio ImpCPDEL). Campo editabile per override.</div>
      </div>

      <div style={C.sub}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "7px" }}>
          <div style={C.subT}>Lista Contributi — Ente Versante ({p.enteVersante.length} righe)</div>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <span style={{ fontSize: "9px", color: "#1a5030" }}>+Riga = coppia TC1+TC9</span>
            <button style={C.btn()} onClick={() => addEV(dip.id, p.id)}>+ Riga</button>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
            <thead>
              <tr>
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
              {p.enteVersante.map(ev => {
                const isSyncedTc9 = ev.pairedWith && p.enteVersante.find(e => e.id === ev.pairedWith)?.TipoContributo === "1";
                const bg = ev.TipoContributo === "1" ? "#08190e" : isSyncedTc9 ? "#05100a" : "transparent";
                return (
                  <tr key={ev.id} style={{ background: bg }}>
                    <td style={C.td}>
                      <select style={{ ...C.sel, width: "95px", fontSize: "10px" }} value={ev.TipoContributo}
                        onChange={e => updEV(dip.id, p.id, ev.id, "TipoContributo", e.target.value)}>
                        {TC_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                    </td>
                    <td style={C.td}><input style={{ ...C.inp, width: "108px" }} value={ev.CFAzienda} onChange={e => updEV(dip.id, p.id, ev.id, "CFAzienda", e.target.value)} /></td>
                    <td style={C.td}><input style={{ ...C.inp, width: "60px" }} value={ev.PRGAZIENDA} onChange={e => updEV(dip.id, p.id, ev.id, "PRGAZIENDA", e.target.value)} /></td>
                    <td style={C.td}><input style={{ ...(isSyncedTc9 ? C.inpG : C.inp), width: "78px" }} value={ev.Imponibile} onChange={e => updEV(dip.id, p.id, ev.id, "Imponibile", e.target.value)} placeholder="0,00" /></td>
                    <td style={C.td}><input style={{ ...C.inp, width: "78px" }} value={ev.Contributo} onChange={e => updEV(dip.id, p.id, ev.id, "Contributo", e.target.value)} placeholder="0,00" /></td>
                    <td style={C.td}><input style={{ ...(isSyncedTc9 ? C.inpG : C.inp), width: "76px" }} value={ev.AnnoMeseErogazione} onChange={e => updEV(dip.id, p.id, ev.id, "AnnoMeseErogazione", e.target.value)} placeholder="YYYY-MM" /></td>
                    <td style={C.td}><input style={{ ...C.inp, width: "36px" }} value={ev.Aliquota} onChange={e => updEV(dip.id, p.id, ev.id, "Aliquota", e.target.value)} /></td>
                    <td style={C.td}><button style={C.btn("x")} onClick={() => removeEV(dip.id, p.id, ev.id)}>✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: "9px", color: "#1a5030", marginTop: "4px" }}>
          Sfondo verde = TC9 abbinata. Imponibile e AnnoMese sincronizzati con TC1 corrispondente (editabili per override).
        </div>
      </div>
    </div>
  );

  /* ════ RENDER dipendente ════ */
  const renderDip = (dip) => (
    <div style={C.cBody}>
      <div style={C.sub}>
        <div style={C.subT}>Anagrafica Lavoratore (D0)</div>
        <div style={C.row}>
          <F label="Codice Fiscale" value={dip.CFLavoratore} onChange={v => updDip(dip.id, "CFLavoratore", v)} ph="XYZABC00X00X000X" w="178px" />
          <F label="Cognome" value={dip.Cognome} onChange={v => updDip(dip.id, "Cognome", v)} w="148px" />
          <F label="Nome" value={dip.Nome} onChange={v => updDip(dip.id, "Nome", v)} w="128px" />
          <F label="Codice Comune" value={dip.CodiceComune} onChange={v => updDip(dip.id, "CodiceComune", v)} ph="F943" w="128px" />
          <F label="CAP" value={dip.CAP} onChange={v => updDip(dip.id, "CAP", v)} ph="96017" w="72px" />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "7px" }}>
        <span style={{ ...C.subT, marginBottom: 0 }}>V1 — {dip.periodi.length} periodo{dip.periodi.length !== 1 ? "i" : ""}</span>
        <button style={C.btn("p")} onClick={() => addPer(dip.id)}>+ Aggiungi periodo V1</button>
      </div>
      {dip.periodi.length === 0 && <div style={C.empty}>Nessun periodo V1.</div>}
      {dip.periodi.map(p => (
        <div key={p.id} style={C.card}>
          <div style={C.cHdr} onClick={() => setXPer(xPer === p.id ? null : p.id)}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={C.bdg("#00c8e0")}>caus.{p.CausaleVariazione}</span>
              <span style={{ ...C.mono, color: "#7aaac8" }}>{p.GiornoInizio || "???"} → {p.GiornoFine || "???"}</span>
              <span style={{ ...C.bdg("#208060"), fontSize: "9px" }}>{p.enteVersante.length} EV</span>
              {p.CodiceCessazione && <span style={{ ...C.bdg("#c0780a"), fontSize: "9px" }}>cess.{p.CodiceCessazione}</span>}
              {tc1Warn(p) && <span style={{ ...C.bdg("#e08040"), fontSize: "9px" }}>⚠ TC1</span>}
            </div>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <span style={{ fontSize: "10px", color: xPer === p.id ? "#00c8e0" : "#1a3a58" }}>{xPer === p.id ? "▲" : "▼"}</span>
              <button style={C.btn("x")} onClick={e => { e.stopPropagation(); removePer(dip.id, p.id); }}>✕</button>
            </div>
          </div>
          {xPer === p.id && renderPer(dip, p)}
        </div>
      ))}
    </div>
  );

  /* ════ MAIN RENDER ════ */
  return (
    <div style={C.app}>
      <div style={C.hdr}>
        <div>
          <div style={C.hdrT}>⬛ UniEmens Variazione Builder v2</div>
          <div style={C.hdrS}>Fix 00124I (PosPA unico) · auto-sync CPDEL↔Credito · coppia TC1+TC9 · dedup · validazione 00172I</div>
        </div>
        <div style={{ marginLeft: "auto", fontSize: "11px", color: "#1e3a58" }}>{dips.length} dip. · {totPer} V1 · {totEV} EV</div>
      </div>
      <div style={C.tabs}>
        {["1. Intestazione", "2. Dipendenti / V1", "3. Genera XML"].map((t, i) => (
          <button key={i} style={C.tab(tab === i)} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>
      <div style={C.body}>

        {tab === 0 && <>
          <div style={C.sec}>
            <div style={C.sT}>DatiMittente</div>
            <div style={C.row}>
              <F label="CF Persona Mittente" value={m.CFPersonaMittente} onChange={mf("CFPersonaMittente")} ph="CF firmatario" w="178px" />
              <F label="Ragione Sociale Mittente" value={m.RagSocMittente} onChange={mf("RagSocMittente")} ph="COMUNE DI ..." full />
            </div>
            <div style={C.row}>
              <F label="CF Mittente (Ente)" value={m.CFMittente} onChange={mf("CFMittente")} ph="11 cifre" w="158px" />
              <F label="CF Softwarehouse" value={m.CFSoftwarehouse} onChange={mf("CFSoftwarehouse")} ph="11 cifre" w="158px" />
              <F label="Sede INPS" value={m.SedeINPS} onChange={mf("SedeINPS")} ph="7601" w="98px" />
            </div>
          </div>
          <div style={C.sec}>
            <div style={C.sT}>Azienda / ListaPosPA</div>
            <div style={C.row}>
              <F label="Anno-Mese Denuncia" value={a.AnnoMeseDenuncia} onChange={af("AnnoMeseDenuncia")} ph="YYYY-MM" w="128px" />
              <F label="CF Azienda" value={a.CFAzienda} onChange={af("CFAzienda")} ph="11 cifre" w="158px" />
              <F label="Ragione Sociale Ente" value={a.RagSocAzienda} onChange={af("RagSocAzienda")} ph="COMUNE DI ..." full />
            </div>
            <div style={C.row}>
              <F label="PRGAZIENDA" value={a.PRGAZIENDA} onChange={af("PRGAZIENDA")} ph="00000" w="88px" />
              <F label="CF Rappresentante Firmatario" value={a.CFRappresentanteFirmatario} onChange={af("CFRappresentanteFirmatario")} ph="CF rep." w="198px" />
              <F label="Codice ISTAT" value={a.ISTAT} onChange={af("ISTAT")} ph="841110" w="148px" />
              <F label="Forma Giuridica" value={a.FormaGiuridica} onChange={af("FormaGiuridica")} opts={FG_OPTS} w="238px" />
            </div>
          </div>
          <div style={{ ...C.sec, background: "#060e18", borderColor: "#0e2030", fontSize: "11px", color: "#1a4060", lineHeight: "1.8" }}>
            <strong style={{ color: "#005070" }}>Logiche auto attive:</strong>&nbsp;
            ImpCPDEL → ImpCredito (campo verde, editabile) ·
            Ogni "+Riga" EV crea coppia TC1+TC9 abbinata (Imponibile e AnnoMese sincronizzati) ·
            Dedup automatico su genera ·
            Tutti i D0 in un unico PosPA (fix 00124I)
          </div>
        </>}

        {tab === 1 && <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "10px" }}>
            <button style={{ ...C.btn("p"), padding: "6px 16px", fontSize: "12px" }} onClick={addDip}>+ Aggiungi dipendente</button>
          </div>
          {dips.length === 0 && <div style={C.empty}>Nessun dipendente.</div>}
          {dips.map(dip => (
            <div key={dip.id} style={C.card}>
              <div style={C.cHdr} onClick={() => { setXDip(xDip === dip.id ? null : dip.id); setXPer(null); }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <span style={{ ...C.mono, color: "#00c8e0", fontWeight: "700", fontSize: "12px" }}>{dip.CFLavoratore || "— CF —"}</span>
                  <span style={{ color: "#8ab8d0" }}>{dip.Cognome || "Cognome"} {dip.Nome || "Nome"}</span>
                  <span style={{ ...C.bdg("#208060"), fontSize: "9px" }}>{dip.periodi.length} V1</span>
                  {dip.periodi.some(p => tc1Warn(p)) && <span style={{ ...C.bdg("#e08040"), fontSize: "9px" }}>⚠ TC1</span>}
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <span style={{ fontSize: "10px", color: xDip === dip.id ? "#00c8e0" : "#1a3a58" }}>{xDip === dip.id ? "▲" : "▼"}</span>
                  <button style={C.btn("x")} onClick={e => { e.stopPropagation(); removeDip(dip.id); }}>✕</button>
                </div>
              </div>
              {xDip === dip.id && renderDip(dip)}
            </div>
          ))}
        </>}

        {tab === 2 && <>
          <div style={C.sec}>
            <div style={C.sT}>Analisi errori — file 28/04/2026</div>
            <div style={C.alert("e")}>
              <strong>00124I</strong> · PosPA · Gravità 3<br />
              "Non può essere presente la stessa coppia EnteAppartenenza/SedeServizio per PosPA differenti."<br />
              <span style={{ color: "#a06060" }}>Causa: file con 2 blocchi &lt;PosPA&gt; separati (FRANZA + FAVACCIO).</span><br />
              <span style={{ color: "#60a080" }}>✓ Corretto: questa versione genera un solo &lt;PosPA&gt; contenente tutti i D0.</span>
            </div>
            <div style={C.alert("e")}>
              <strong>00172I</strong> · V1/EnteVersante · Gravità 3 · FAVACCIO GIUSEPPE · 2021-06<br />
              "Sum TC1+TC5 EV &gt; ContribCPDEL + Contrib1%."<br />
              <span style={{ color: "#a06060" }}>Sum TC1 EV nel file = 4.443,29 · Limite = 4.363,29 + 2,00 = 4.365,29 · Eccesso = 78,00.<br />
              Da verificare nei dati FAVACCIO: righe TC1 duplicate o Contrib1% incluso nelle righe TC1 invece di TC6 separata.</span><br />
              <span style={{ color: "#c0c060" }}>⚠ Correggere manualmente: Sum(TC1 EV Contributo) deve essere = ContribCPDEL esatto.</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", marginBottom: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <button style={{ ...C.btn("s"), padding: "7px 20px", fontSize: "13px" }} onClick={genera}>⚡ Genera XML</button>
            {xml && <button style={{ ...C.btn("p"), padding: "7px 20px", fontSize: "13px" }} onClick={scarica}>⬇ Scarica XML</button>}
            {xml && <span style={{ fontSize: "11px", color: "#208060" }}>
              ✓ {xml.length.toLocaleString("it")} car. · {totPer} D0 in 1 PosPA{a.AnnoMeseDenuncia && <> · UNIEV{a.AnnoMeseDenuncia.replace("-", "").slice(2)}.xml</>}
            </span>}
          </div>

          {dupCount !== null && (
            dupCount > 0
              ? <div style={C.alert("w")}>⚠ Dedup: {dupCount} riga{dupCount > 1 ? "he" : ""} EnteVersante duplicate rimosse automaticamente prima dell'export XML.</div>
              : <div style={C.alert("o")}>✓ Dedup: nessuna riga EnteVersante duplicata.</div>
          )}
          {warns.map((w, i) => (
            <div key={i} style={C.alert("e")}>
              ⚠ <strong>00172I potenziale</strong> · {w.who} · {w.period}<br />
              Sum TC1+TC5 EV = {w.sumTC1} · Limite CPDEL+1% = {w.limit} · Eccesso = {w.excess}
            </div>
          ))}
          {warns.length === 0 && dupCount !== null && (
            <div style={C.alert("o")}>✓ Nessuna violazione Sum TC1 rilevata.</div>
          )}

          {!xml && <div style={C.empty}>Clicca "Genera XML" per produrre il flusso UniEmens variazione.</div>}
          {xml && (
            <textarea style={{ width: "100%", height: "480px", background: "#040c14", border: "1px solid #1a334f", borderRadius: "5px", color: "#70c890", fontFamily: "monospace", fontSize: "11px", padding: "10px", boxSizing: "border-box", outline: "none", resize: "vertical", lineHeight: "1.5" }}
              value={xml} readOnly />
          )}
        </>}

      </div>
    </div>
  );
}
