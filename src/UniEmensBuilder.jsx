import { useState } from "react";

/* ═══════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════ */
const uid = () => Math.random().toString(36).slice(2, 9);

const toIt = (v) => {
  const n = parseFloat(String(v || "0").replace(",", "."));
  return isNaN(n) ? "0,00" : n.toFixed(2).replace(".", ",");
};

const esc = (s) =>
  String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/* ═══════════════════════════════════════════════════════
   XML BUILDER
   Struttura: DenunceMensili > DatiMittente + Azienda >
   ListaPosPA (TipoListaPosPA="1") > PosPA > D0 > V1
═══════════════════════════════════════════════════════ */
function buildXML(m, a, dips) {
  let x = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  x += `<DenunceMensili>\n`;

  // DatiMittente
  x += `   <DatiMittente Tipo="1">\n`;
  x += `      <CFPersonaMittente>${esc(m.CFPersonaMittente)}</CFPersonaMittente>\n`;
  x += `      <RagSocMittente>${esc(m.RagSocMittente)}</RagSocMittente>\n`;
  x += `      <CFMittente>${esc(m.CFMittente)}</CFMittente>\n`;
  x += `      <CFSoftwarehouse>${esc(m.CFSoftwarehouse)}</CFSoftwarehouse>\n`;
  x += `      <SedeINPS>${esc(m.SedeINPS)}</SedeINPS>\n`;
  x += `   </DatiMittente>\n`;

  // Azienda
  x += `   <Azienda>\n`;
  x += `      <AnnoMeseDenuncia>${esc(a.AnnoMeseDenuncia)}</AnnoMeseDenuncia>\n`;
  x += `      <CFAzienda>${esc(a.CFAzienda)}</CFAzienda>\n`;
  x += `      <RagSocAzienda>${esc(a.RagSocAzienda)}</RagSocAzienda>\n`;
  x += `      <ListaPosPA TipoListaPosPA="1">\n`;
  x += `          <PRGAZIENDA>${esc(a.PRGAZIENDA || "00000")}</PRGAZIENDA>\n`;
  x += `          <CFRappresentanteFirmatario>${esc(a.CFRappresentanteFirmatario)}</CFRappresentanteFirmatario>\n`;
  x += `          <ISTAT>${esc(a.ISTAT)}</ISTAT>\n`;
  x += `          <FormaGiuridica>${esc(a.FormaGiuridica)}</FormaGiuridica>\n`;

  // PosPA per ogni dipendente × periodo
  for (const d of dips) {
    for (const p of d.periodi) {
      x += `          <PosPA>\n`;
      x += `              <D0_DenunciaIndividuale>\n`;
      x += `                  <CFLavoratore>${esc(d.CFLavoratore)}</CFLavoratore>\n`;
      x += `                  <Cognome>${esc(d.Cognome)}</Cognome>\n`;
      x += `                  <Nome>${esc(d.Nome)}</Nome>\n`;
      x += `                  <DatiSedeLavoro>\n`;
      x += `                      <CodiceComune>${esc(d.CodiceComune)}</CodiceComune>\n`;
      x += `                      <CAP>${esc(d.CAP)}</CAP>\n`;
      x += `                  </DatiSedeLavoro>\n`;

      // V1
      x += `                  <V1_PeriodoPrecedente CausaleVariazione="${esc(p.CausaleVariazione)}">\n`;
      x += `                      <GiornoInizio>${esc(p.GiornoInizio)}</GiornoInizio>\n`;
      x += `                      <GiornoFine>${esc(p.GiornoFine)}</GiornoFine>\n`;

      // Inquadramento
      x += `                      <InquadramentoLavPA>\n`;
      x += `                          <TipoImpiego>${esc(p.TipoImpiego)}</TipoImpiego>\n`;
      x += `                          <TipoServizio>${esc(p.TipoServizio)}</TipoServizio>\n`;
      x += `                          <Contratto>${esc(p.Contratto)}</Contratto>\n`;
      x += `                          <Qualifica>${esc(p.Qualifica)}</Qualifica>\n`;
      if (p.hasPartTime) {
        x += `                          <PartTimePA>\n`;
        x += `                              <TipoPartTime>${esc(p.TipoPartTime)}</TipoPartTime>\n`;
        x += `                              <PercPartTime>${esc(p.PercPartTime)}</PercPartTime>\n`;
        x += `                          </PartTimePA>\n`;
      }
      x += `                          <RegimeFineServizio>${esc(p.RegimeFineServizio)}</RegimeFineServizio>\n`;
      x += `                      </InquadramentoLavPA>\n`;

      // Gestioni
      x += `                      <Gestioni>\n`;
      if (p.ImpCPDEL) {
        x += `                          <GestPensionistica>\n`;
        x += `                              <CodGestione>2</CodGestione>\n`;
        x += `                              <Imponibile>${toIt(p.ImpCPDEL)}</Imponibile>\n`;
        x += `                              <Contributo>${toIt(p.ContribCPDEL)}</Contributo>\n`;
        if (p.Contrib1Perc)
          x += `                              <Contrib1PerCento>${toIt(p.Contrib1Perc)}</Contrib1PerCento>\n`;
        x += `                              <StipendioTabellare>${toIt(p.StipTabellare)}</StipendioTabellare>\n`;
        x += `                              <RetribIndivAnzianita>${toIt(p.RetribAnzianita)}</RetribIndivAnzianita>\n`;
        x += `                          </GestPensionistica>\n`;
      }
      if (p.ImpTFS) {
        const T = p.regimeTFS === "TFR" ? "TFR" : "TFS";
        x += `                          <GestPrevidenziale>\n`;
        x += `                              <CodGestione>6</CodGestione>\n`;
        x += `                              <Imponibile${T}>${toIt(p.ImpTFS)}</Imponibile${T}>\n`;
        x += `                              <Contributo${T}>${toIt(p.ContribTFS)}</Contributo${T}>\n`;
        x += `                          </GestPrevidenziale>\n`;
      }
      if (p.ImpCredito) {
        x += `                          <GestCredito>\n`;
        x += `                              <CodGestione>9</CodGestione>\n`;
        x += `                              <Imponibile>${toIt(p.ImpCredito)}</Imponibile>\n`;
        x += `                              <Contributo>${toIt(p.ContribCredito)}</Contributo>\n`;
        x += `                          </GestCredito>\n`;
      }
      x += `                      </Gestioni>\n`;

      if (p.CodiceCessazione)
        x += `                      <CodiceCessazione>${esc(p.CodiceCessazione)}</CodiceCessazione>\n`;

      // EnteVersante rows
      for (const ev of p.enteVersante) {
        x += `                      <EnteVersante>\n`;
        x += `                          <TipoContributo>${esc(ev.TipoContributo)}</TipoContributo>\n`;
        x += `                          <CFAzienda>${esc(ev.CFAzienda)}</CFAzienda>\n`;
        x += `                          <PRGAZIENDA>${esc(ev.PRGAZIENDA || "00000")}</PRGAZIENDA>\n`;
        x += `                          <Imponibile>${toIt(ev.Imponibile)}</Imponibile>\n`;
        x += `                          <Contributo>${toIt(ev.Contributo)}</Contributo>\n`;
        x += `                          <AnnoMeseErogazione>${esc(ev.AnnoMeseErogazione)}</AnnoMeseErogazione>\n`;
        x += `                          <Aliquota>${esc(ev.Aliquota || "2")}</Aliquota>\n`;
        x += `                      </EnteVersante>\n`;
      }

      x += `                  </V1_PeriodoPrecedente>\n`;
      x += `              </D0_DenunciaIndividuale>\n`;
      x += `          </PosPA>\n`;
    }
  }

  x += `      </ListaPosPA>\n`;
  x += `   </Azienda>\n`;
  x += `</DenunceMensili>`;
  return x;
}

/* ═══════════════════════════════════════════════════════
   STYLE CONSTANTS
═══════════════════════════════════════════════════════ */
const C = {
  app: {
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    fontSize: "13px",
    background: "#0b1523",
    color: "#cce0f0",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  hdr: {
    background: "#0e1d30",
    borderBottom: "1px solid #1a334f",
    padding: "10px 16px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  hdrTitle: { fontSize: "14px", fontWeight: "700", color: "#00c8e0" },
  hdrSub: { fontSize: "10px", color: "#3a5a78", marginTop: "2px" },
  hdrStat: { marginLeft: "auto", fontSize: "11px", color: "#1e3a58", textAlign: "right" },
  tabs: { display: "flex", background: "#0d1928", borderBottom: "1px solid #162840" },
  tab: (a) => ({
    padding: "8px 18px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
    border: "none",
    background: "transparent",
    color: a ? "#00c8e0" : "#3a5a78",
    borderBottom: a ? "2px solid #00c8e0" : "2px solid transparent",
    letterSpacing: "0.3px",
  }),
  body: { flex: 1, overflowY: "auto", padding: "14px", maxWidth: "960px" },
  sec: {
    background: "#0f1e30",
    border: "1px solid #1a334f",
    borderRadius: "6px",
    padding: "13px",
    marginBottom: "12px",
  },
  secTitle: {
    fontSize: "10px",
    fontWeight: "700",
    color: "#00a8c0",
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginBottom: "10px",
    paddingBottom: "6px",
    borderBottom: "1px solid #162840",
  },
  row: { display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "8px" },
  lbl: {
    fontSize: "10px",
    color: "#3a6080",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "3px",
    display: "block",
  },
  inp: {
    background: "#080f1a",
    border: "1px solid #1a3550",
    borderRadius: "3px",
    color: "#c8dff0",
    padding: "4px 7px",
    fontSize: "12px",
    fontFamily: "monospace",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  sel: {
    background: "#080f1a",
    border: "1px solid #1a3550",
    borderRadius: "3px",
    color: "#c8dff0",
    padding: "4px 7px",
    fontSize: "11px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  btn: (v = "primary") => ({
    padding: "4px 11px",
    borderRadius: "3px",
    border: "none",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: "600",
    background:
      v === "primary"
        ? "#005a80"
        : v === "success"
        ? "#006040"
        : v === "danger"
        ? "#6a1515"
        : "#162840",
    color:
      v === "primary"
        ? "#b0e4f8"
        : v === "success"
        ? "#90f0d0"
        : v === "danger"
        ? "#f0b0b0"
        : "#7aaac8",
  }),
  card: {
    background: "#0e1c2c",
    border: "1px solid #1a334f",
    borderRadius: "5px",
    marginBottom: "7px",
    overflow: "hidden",
  },
  cardHdr: {
    padding: "9px 13px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: "pointer",
    background: "#0b1622",
  },
  cardBody: { padding: "12px 13px" },
  sub: {
    background: "#07111e",
    border: "1px solid #162840",
    borderRadius: "4px",
    padding: "9px",
    marginBottom: "9px",
  },
  subTitle: {
    fontSize: "9px",
    fontWeight: "700",
    color: "#008aa0",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    marginBottom: "7px",
  },
  th: {
    background: "#060e18",
    padding: "3px 6px",
    textAlign: "left",
    color: "#2a5070",
    fontWeight: "700",
    fontSize: "10px",
    borderBottom: "1px solid #162840",
    whiteSpace: "nowrap",
  },
  td: { padding: "3px 4px", borderBottom: "1px solid #0d1c2c", verticalAlign: "top" },
  badge: (col) => ({
    background: col + "22",
    color: col,
    padding: "1px 6px",
    borderRadius: "3px",
    fontSize: "10px",
    fontWeight: "700",
    fontFamily: "monospace",
    whiteSpace: "nowrap",
  }),
  mono: { fontFamily: "monospace", fontSize: "11px" },
  empty: { textAlign: "center", color: "#1a3050", padding: "30px", fontSize: "12px" },
};

/* ═══════════════════════════════════════════════════════
   FIELD COMPONENT
═══════════════════════════════════════════════════════ */
function F({ label, value, onChange, type = "text", ph = "", w = "140px", full = false, opts = null }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: full ? "1 1 100%" : `1 1 ${w}`, minWidth: full ? "180px" : w }}>
      <label style={C.lbl}>{label}</label>
      {opts ? (
        <select style={C.sel} value={value} onChange={(e) => onChange(e.target.value)}>
          {opts.map((o) => (
            <option key={o.v} value={o.v}>{o.l}</option>
          ))}
        </select>
      ) : (
        <input style={C.inp} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   LOOKUP TABLES
═══════════════════════════════════════════════════════ */
const CAUSALE = [
  { v: "1", l: "1 – Integrazione dati inviati" },
  { v: "5", l: "5 – Sostituzione / mai denunciato" },
  { v: "6", l: "6 – Annullamento periodo" },
  { v: "7", l: "7 – Conguaglio previdenziale" },
];
const TIPO_IMPIEGO = [
  { v: "1", l: "1 – TI tempo pieno" },
  { v: "2", l: "2 – TI part-time" },
  { v: "8", l: "8 – TD tempo pieno" },
  { v: "9", l: "9 – TD part-time" },
];
const TIPO_SERVIZIO = [
  { v: "4", l: "4 – Ordinario" },
  { v: "5", l: "5 – Straordinario" },
  { v: "6", l: "6 – Lavoro autonomo" },
];
const REGIME_FS = [
  { v: "1", l: "1 – TFR privatistico" },
  { v: "2", l: "2 – TFR misto" },
  { v: "3", l: "3 – TFS (INADEL)" },
];
const TIPO_PT = [
  { v: "O", l: "O – Orizzontale" },
  { v: "V", l: "V – Verticale" },
  { v: "M", l: "M – Misto" },
  { v: "P", l: "P – Verticale ciclico" },
];
const TIPO_CONTRIBUTO = [
  { v: "1", l: "1 – CPDEL" },
  { v: "2", l: "2 – Cassa Pensioni Insegnanti" },
  { v: "3", l: "3 – Cassa Pensioni Sanitari" },
  { v: "6", l: "6 – Contr. Agg. 1%" },
  { v: "7", l: "7 – TFS/INADEL" },
  { v: "8", l: "8 – Credito 45/2007" },
  { v: "9", l: "9 – Fondo Credito/ECA" },
];
const FORMA_GIURIDICA = [
  { v: "2410", l: "2410 – Regione" },
  { v: "2420", l: "2420 – Provincia" },
  { v: "2430", l: "2430 – Comune" },
  { v: "2440", l: "2440 – Comunità montana/isolana" },
  { v: "2450", l: "2450 – Unione di comuni" },
  { v: "2460", l: "2460 – Città metropolitana" },
  { v: "2711", l: "2711 – Ente pubblico di ricerca" },
  { v: "2712", l: "2712 – IPAB" },
  { v: "2720", l: "2720 – Camera di commercio" },
  { v: "2740", l: "2740 – Consorzio diritto pubblico" },
  { v: "2790", l: "2790 – Altro ente pub. non economico" },
];

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════ */
export default function UniEmensBuilder() {
  const [tab, setTab] = useState(0);

  // DatiMittente state
  const [m, setM] = useState({
    CFPersonaMittente: "",
    RagSocMittente: "",
    CFMittente: "",
    CFSoftwarehouse: "00000000000",
    SedeINPS: "",
  });

  // Azienda state
  const [a, setA] = useState({
    AnnoMeseDenuncia: "",
    CFAzienda: "",
    RagSocAzienda: "",
    PRGAZIENDA: "00000",
    CFRappresentanteFirmatario: "",
    ISTAT: "",
    FormaGiuridica: "2430",
  });

  // Dipendenti list
  const [dips, setDips] = useState([]);

  // Expanded accordion IDs
  const [xDip, setXDip] = useState(null);
  const [xPer, setXPer] = useState(null);

  // Generated XML
  const [xml, setXml] = useState("");

  /* ── helpers ── */
  const mf = (k) => (v) => setM((p) => ({ ...p, [k]: v }));
  const af = (k) => (v) => setA((p) => ({ ...p, [k]: v }));

  const mkEV = () => ({
    id: uid(),
    TipoContributo: "1",
    CFAzienda: a.CFAzienda,
    PRGAZIENDA: a.PRGAZIENDA || "00000",
    Imponibile: "",
    Contributo: "",
    AnnoMeseErogazione: "",
    Aliquota: "2",
  });

  const mkPer = () => ({
    id: uid(),
    CausaleVariazione: "5",
    GiornoInizio: "",
    GiornoFine: "",
    TipoImpiego: "1",
    TipoServizio: "4",
    Contratto: "RALN",
    Qualifica: "",
    hasPartTime: false,
    TipoPartTime: "O",
    PercPartTime: "",
    RegimeFineServizio: "3",
    ImpCPDEL: "",
    ContribCPDEL: "",
    Contrib1Perc: "",
    StipTabellare: "0,00",
    RetribAnzianita: "0,00",
    regimeTFS: "TFS",
    ImpTFS: "",
    ContribTFS: "",
    ImpCredito: "",
    ContribCredito: "",
    CodiceCessazione: "",
    enteVersante: [mkEV()],
  });

  /* ── dipendente CRUD ── */
  const addDip = () => {
    const d = {
      id: uid(),
      CFLavoratore: "",
      Cognome: "",
      Nome: "",
      CodiceComune: "",
      CAP: "",
      periodi: [],
    };
    setDips((p) => [...p, d]);
    setXDip(d.id);
    setXPer(null);
  };

  const removeDip = (id) => {
    setDips((p) => p.filter((d) => d.id !== id));
    if (xDip === id) { setXDip(null); setXPer(null); }
  };

  const updDip = (id, k, v) =>
    setDips((p) => p.map((d) => (d.id === id ? { ...d, [k]: v } : d)));

  /* ── periodo CRUD ── */
  const addPer = (dipId) => {
    const p = mkPer();
    setDips((ds) =>
      ds.map((d) => (d.id === dipId ? { ...d, periodi: [...d.periodi, p] } : d))
    );
    setXPer(p.id);
  };

  const removePer = (dipId, perId) => {
    setDips((ds) =>
      ds.map((d) =>
        d.id === dipId ? { ...d, periodi: d.periodi.filter((p) => p.id !== perId) } : d
      )
    );
    if (xPer === perId) setXPer(null);
  };

  const updPer = (dipId, perId, k, v) =>
    setDips((ds) =>
      ds.map((d) =>
        d.id === dipId
          ? { ...d, periodi: d.periodi.map((p) => (p.id === perId ? { ...p, [k]: v } : p)) }
          : d
      )
    );

  /* ── EnteVersante CRUD ── */
  const addEV = (dipId, perId) => {
    const ev = mkEV();
    setDips((ds) =>
      ds.map((d) =>
        d.id === dipId
          ? {
              ...d,
              periodi: d.periodi.map((p) =>
                p.id === perId ? { ...p, enteVersante: [...p.enteVersante, ev] } : p
              ),
            }
          : d
      )
    );
  };

  const updEV = (dipId, perId, evId, k, v) =>
    setDips((ds) =>
      ds.map((d) =>
        d.id === dipId
          ? {
              ...d,
              periodi: d.periodi.map((p) =>
                p.id === perId
                  ? {
                      ...p,
                      enteVersante: p.enteVersante.map((ev) =>
                        ev.id === evId ? { ...ev, [k]: v } : ev
                      ),
                    }
                  : p
              ),
            }
          : d
      )
    );

  const removeEV = (dipId, perId, evId) =>
    setDips((ds) =>
      ds.map((d) =>
        d.id === dipId
          ? {
              ...d,
              periodi: d.periodi.map((p) =>
                p.id === perId
                  ? { ...p, enteVersante: p.enteVersante.filter((ev) => ev.id !== evId) }
                  : p
              ),
            }
          : d
      )
    );

  /* ── XML generation & download ── */
  const genera = () => setXml(buildXML(m, a, dips));

  const scarica = () => {
    if (!xml) return;
    const yymm = a.AnnoMeseDenuncia.replace("-", "").slice(2) || "XXXX";
    const fname = `UNIEV${yymm}.xml`;
    const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fname;
    link.click();
    URL.revokeObjectURL(url);
  };

  /* ── Summary counters ── */
  const totPer = dips.reduce((s, d) => s + d.periodi.length, 0);
  const totEV = dips.reduce(
    (s, d) => s + d.periodi.reduce((ss, p) => ss + p.enteVersante.length, 0),
    0
  );

  /* ══════════════════════════════════════
     RENDER – Period editor (V1)
  ══════════════════════════════════════ */
  const renderPer = (dip, p) => (
    <div style={C.cardBody}>
      {/* Periodo e causale */}
      <div style={C.sub}>
        <div style={C.subTitle}>Periodo e Causale Variazione</div>
        <div style={C.row}>
          <F label="Causale variazione" value={p.CausaleVariazione}
            onChange={(v) => updPer(dip.id, p.id, "CausaleVariazione", v)}
            opts={CAUSALE} w="240px" />
          <F label="Giorno inizio" value={p.GiornoInizio}
            onChange={(v) => updPer(dip.id, p.id, "GiornoInizio", v)}
            ph="YYYY-MM-DD" w="130px" />
          <F label="Giorno fine" value={p.GiornoFine}
            onChange={(v) => updPer(dip.id, p.id, "GiornoFine", v)}
            ph="YYYY-MM-DD" w="130px" />
          <F label="Codice cessazione" value={p.CodiceCessazione}
            onChange={(v) => updPer(dip.id, p.id, "CodiceCessazione", v)}
            ph="es. 4" w="120px" />
        </div>
      </div>

      {/* Inquadramento */}
      <div style={C.sub}>
        <div style={C.subTitle}>InquadramentoLavPA</div>
        <div style={C.row}>
          <F label="Tipo impiego" value={p.TipoImpiego}
            onChange={(v) => updPer(dip.id, p.id, "TipoImpiego", v)}
            opts={TIPO_IMPIEGO} w="200px" />
          <F label="Tipo servizio" value={p.TipoServizio}
            onChange={(v) => updPer(dip.id, p.id, "TipoServizio", v)}
            opts={TIPO_SERVIZIO} w="180px" />
          <F label="Contratto" value={p.Contratto}
            onChange={(v) => updPer(dip.id, p.id, "Contratto", v)}
            ph="RALN" w="90px" />
          <F label="Qualifica" value={p.Qualifica}
            onChange={(v) => updPer(dip.id, p.id, "Qualifica", v)}
            ph="es. 042000" w="120px" />
          <F label="Regime fine servizio" value={p.RegimeFineServizio}
            onChange={(v) => updPer(dip.id, p.id, "RegimeFineServizio", v)}
            opts={REGIME_FS} w="180px" />
        </div>
        <div style={{ ...C.row, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginRight: "6px" }}>
            <input
              type="checkbox"
              checked={p.hasPartTime}
              onChange={(e) => updPer(dip.id, p.id, "hasPartTime", e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            <span style={{ fontSize: "11px", color: "#7aaac8" }}>Part-time</span>
          </div>
          {p.hasPartTime && (
            <>
              <F label="Tipo PT" value={p.TipoPartTime}
                onChange={(v) => updPer(dip.id, p.id, "TipoPartTime", v)}
                opts={TIPO_PT} w="180px" />
              <F label="% part-time (es. 50000)" value={p.PercPartTime}
                onChange={(v) => updPer(dip.id, p.id, "PercPartTime", v)}
                ph="50000" w="160px" />
            </>
          )}
        </div>
      </div>

      {/* GestPensionistica – CPDEL */}
      <div style={C.sub}>
        <div style={C.subTitle}>GestPensionistica – CPDEL (CodGestione 2)</div>
        <div style={C.row}>
          <F label="Imponibile CPDEL" value={p.ImpCPDEL}
            onChange={(v) => updPer(dip.id, p.id, "ImpCPDEL", v)} ph="0,00" w="140px" />
          <F label="Contributo CPDEL" value={p.ContribCPDEL}
            onChange={(v) => updPer(dip.id, p.id, "ContribCPDEL", v)} ph="0,00" w="140px" />
          <F label="Contrib. 1%" value={p.Contrib1Perc}
            onChange={(v) => updPer(dip.id, p.id, "Contrib1Perc", v)} ph="0,00" w="100px" />
          <F label="Stipendio tabellare" value={p.StipTabellare}
            onChange={(v) => updPer(dip.id, p.id, "StipTabellare", v)} ph="0,00" w="140px" />
          <F label="Retrib. anzianità" value={p.RetribAnzianita}
            onChange={(v) => updPer(dip.id, p.id, "RetribAnzianita", v)} ph="0,00" w="130px" />
        </div>
      </div>

      {/* GestPrevidenziale – TFS/TFR */}
      <div style={C.sub}>
        <div style={C.subTitle}>GestPrevidenziale – INADEL/TFS/TFR (CodGestione 6)</div>
        <div style={C.row}>
          <F label="Regime" value={p.regimeTFS}
            onChange={(v) => updPer(dip.id, p.id, "regimeTFS", v)}
            opts={[{ v: "TFS", l: "TFS (INADEL)" }, { v: "TFR", l: "TFR" }]} w="150px" />
          <F label={`Imponibile ${p.regimeTFS}`} value={p.ImpTFS}
            onChange={(v) => updPer(dip.id, p.id, "ImpTFS", v)} ph="0,00" w="140px" />
          <F label={`Contributo ${p.regimeTFS}`} value={p.ContribTFS}
            onChange={(v) => updPer(dip.id, p.id, "ContribTFS", v)} ph="0,00" w="140px" />
        </div>
      </div>

      {/* GestCredito */}
      <div style={C.sub}>
        <div style={C.subTitle}>GestCredito – Fondo Credito/ECA (CodGestione 9)</div>
        <div style={C.row}>
          <F label="Imponibile credito" value={p.ImpCredito}
            onChange={(v) => updPer(dip.id, p.id, "ImpCredito", v)} ph="0,00" w="140px" />
          <F label="Contributo credito" value={p.ContribCredito}
            onChange={(v) => updPer(dip.id, p.id, "ContribCredito", v)} ph="0,00" w="140px" />
        </div>
      </div>

      {/* EnteVersante */}
      <div style={C.sub}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "7px" }}>
          <div style={C.subTitle}>Lista Contributi – Ente Versante ({p.enteVersante.length} righe)</div>
          <button style={C.btn()} onClick={() => addEV(dip.id, p.id)}>
            + Riga
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
            <thead>
              <tr>
                <th style={C.th}>Tipo Contributo</th>
                <th style={C.th}>CF Azienda</th>
                <th style={C.th}>PRGAZIENDA</th>
                <th style={C.th}>Imponibile</th>
                <th style={C.th}>Contributo</th>
                <th style={C.th}>AnnoMese Erog.</th>
                <th style={C.th}>Aliquota</th>
                <th style={C.th}></th>
              </tr>
            </thead>
            <tbody>
              {p.enteVersante.map((ev) => (
                <tr key={ev.id}>
                  <td style={C.td}>
                    <select
                      style={{ ...C.sel, width: "110px" }}
                      value={ev.TipoContributo}
                      onChange={(e) => updEV(dip.id, p.id, ev.id, "TipoContributo", e.target.value)}
                    >
                      {TIPO_CONTRIBUTO.map((o) => (
                        <option key={o.v} value={o.v}>{o.l}</option>
                      ))}
                    </select>
                  </td>
                  <td style={C.td}>
                    <input style={{ ...C.inp, width: "115px" }} value={ev.CFAzienda}
                      onChange={(e) => updEV(dip.id, p.id, ev.id, "CFAzienda", e.target.value)} />
                  </td>
                  <td style={C.td}>
                    <input style={{ ...C.inp, width: "65px" }} value={ev.PRGAZIENDA}
                      onChange={(e) => updEV(dip.id, p.id, ev.id, "PRGAZIENDA", e.target.value)} />
                  </td>
                  <td style={C.td}>
                    <input style={{ ...C.inp, width: "80px" }} value={ev.Imponibile}
                      onChange={(e) => updEV(dip.id, p.id, ev.id, "Imponibile", e.target.value)}
                      placeholder="0,00" />
                  </td>
                  <td style={C.td}>
                    <input style={{ ...C.inp, width: "80px" }} value={ev.Contributo}
                      onChange={(e) => updEV(dip.id, p.id, ev.id, "Contributo", e.target.value)}
                      placeholder="0,00" />
                  </td>
                  <td style={C.td}>
                    <input style={{ ...C.inp, width: "80px" }} value={ev.AnnoMeseErogazione}
                      onChange={(e) => updEV(dip.id, p.id, ev.id, "AnnoMeseErogazione", e.target.value)}
                      placeholder="YYYY-MM" />
                  </td>
                  <td style={C.td}>
                    <input style={{ ...C.inp, width: "40px" }} value={ev.Aliquota}
                      onChange={(e) => updEV(dip.id, p.id, ev.id, "Aliquota", e.target.value)} />
                  </td>
                  <td style={C.td}>
                    <button style={C.btn("danger")} onClick={() => removeEV(dip.id, p.id, ev.id)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  /* ══════════════════════════════════════
     RENDER – Dipendente editor (D0)
  ══════════════════════════════════════ */
  const renderDip = (dip) => (
    <div style={C.cardBody}>
      {/* D0 anagrafica */}
      <div style={C.sub}>
        <div style={C.subTitle}>Anagrafica Lavoratore (D0)</div>
        <div style={C.row}>
          <F label="Codice Fiscale Lavoratore" value={dip.CFLavoratore}
            onChange={(v) => updDip(dip.id, "CFLavoratore", v)}
            ph="XYZABC00X00X000X" w="180px" />
          <F label="Cognome" value={dip.Cognome}
            onChange={(v) => updDip(dip.id, "Cognome", v)} w="150px" />
          <F label="Nome" value={dip.Nome}
            onChange={(v) => updDip(dip.id, "Nome", v)} w="130px" />
          <F label="Codice Comune (4 car.)" value={dip.CodiceComune}
            onChange={(v) => updDip(dip.id, "CodiceComune", v)}
            ph="F943" w="140px" />
          <F label="CAP" value={dip.CAP}
            onChange={(v) => updDip(dip.id, "CAP", v)}
            ph="96017" w="80px" />
        </div>
      </div>

      {/* Periodi V1 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "7px" }}>
        <span style={{ ...C.subTitle, marginBottom: 0 }}>
          Quadri V1 — {dip.periodi.length} periodo{dip.periodi.length !== 1 ? "i" : ""}
        </span>
        <button style={C.btn("primary")} onClick={() => addPer(dip.id)}>
          + Aggiungi periodo V1
        </button>
      </div>

      {dip.periodi.length === 0 && (
        <div style={C.empty}>Nessun periodo V1. Aggiungi almeno un quadro V1 per questo dipendente.</div>
      )}

      {dip.periodi.map((p) => (
        <div key={p.id} style={C.card}>
          <div
            style={C.cardHdr}
            onClick={() => setXPer(xPer === p.id ? null : p.id)}
          >
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={C.badge("#00c8e0")}>caus.{p.CausaleVariazione}</span>
              <span style={{ ...C.mono, color: "#7aaac8" }}>
                {p.GiornoInizio || "???"} → {p.GiornoFine || "???"}
              </span>
              <span style={{ ...C.badge("#208060"), fontSize: "9px" }}>
                {p.enteVersante.length} EV
              </span>
              {p.CodiceCessazione && (
                <span style={{ ...C.badge("#c0780a"), fontSize: "9px" }}>
                  cess.{p.CodiceCessazione}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <span style={{ fontSize: "10px", color: xPer === p.id ? "#00c8e0" : "#1a3a58" }}>
                {xPer === p.id ? "▲" : "▼"}
              </span>
              <button
                style={C.btn("danger")}
                onClick={(e) => { e.stopPropagation(); removePer(dip.id, p.id); }}
              >✕</button>
            </div>
          </div>
          {xPer === p.id && renderPer(dip, p)}
        </div>
      ))}
    </div>
  );

  /* ══════════════════════════════════════
     MAIN RENDER
  ══════════════════════════════════════ */
  return (
    <div style={C.app}>
      {/* Header */}
      <div style={C.hdr}>
        <div>
          <div style={C.hdrTitle}>⬛ UniEmens Variazione Builder</div>
          <div style={C.hdrSub}>Generatore flusso XML DMA2 · ListaPosPA · Enti Locali CCNL Funzioni Locali</div>
        </div>
        <div style={C.hdrStat}>
          <div>{dips.length} dipendente{dips.length !== 1 ? "i" : ""} · {totPer} V1 · {totEV} EnteVersante</div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={C.tabs}>
        {["1. Intestazione", "2. Dipendenti / V1", "3. Genera XML"].map((t, i) => (
          <button key={i} style={C.tab(tab === i)} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>

      <div style={C.body}>

        {/* ════════════════════════════════
            TAB 0 – INTESTAZIONE
        ════════════════════════════════ */}
        {tab === 0 && (
          <>
            <div style={C.sec}>
              <div style={C.secTitle}>DatiMittente</div>
              <div style={C.row}>
                <F label="CF Persona Mittente" value={m.CFPersonaMittente}
                  onChange={mf("CFPersonaMittente")} ph="CF del firmatario" w="180px" />
                <F label="Ragione Sociale Mittente" value={m.RagSocMittente}
                  onChange={mf("RagSocMittente")} ph="COMUNE DI ..." full />
              </div>
              <div style={C.row}>
                <F label="CF Mittente (Ente)" value={m.CFMittente}
                  onChange={mf("CFMittente")} ph="11 cifre" w="160px" />
                <F label="CF Softwarehouse" value={m.CFSoftwarehouse}
                  onChange={mf("CFSoftwarehouse")} ph="11 cifre" w="160px" />
                <F label="Sede INPS" value={m.SedeINPS}
                  onChange={mf("SedeINPS")} ph="es. 7601" w="100px" />
              </div>
            </div>

            <div style={C.sec}>
              <div style={C.secTitle}>Azienda / ListaPosPA</div>
              <div style={C.row}>
                <F label="Anno-Mese Denuncia" value={a.AnnoMeseDenuncia}
                  onChange={af("AnnoMeseDenuncia")} ph="YYYY-MM" w="130px" />
                <F label="CF Azienda (Ente)" value={a.CFAzienda}
                  onChange={af("CFAzienda")} ph="11 cifre" w="160px" />
                <F label="Ragione Sociale Ente" value={a.RagSocAzienda}
                  onChange={af("RagSocAzienda")} ph="COMUNE DI ..." full />
              </div>
              <div style={C.row}>
                <F label="PRGAZIENDA" value={a.PRGAZIENDA}
                  onChange={af("PRGAZIENDA")} ph="00000" w="90px" />
                <F label="CF Rappresentante Firmatario" value={a.CFRappresentanteFirmatario}
                  onChange={af("CFRappresentanteFirmatario")} ph="CF rep. legale" w="200px" />
                <F label="Codice ISTAT Comune (6 car.)" value={a.ISTAT}
                  onChange={af("ISTAT")} ph="841110" w="160px" />
                <F label="Forma Giuridica" value={a.FormaGiuridica}
                  onChange={af("FormaGiuridica")} opts={FORMA_GIURIDICA} w="240px" />
              </div>
            </div>

            <div style={{ ...C.sec, background: "#07111c", borderColor: "#102030" }}>
              <div style={{ fontSize: "10px", color: "#1e4060", lineHeight: "1.6" }}>
                <strong style={{ color: "#005a70" }}>Note operative:</strong> Il CF Mittente e CF Azienda coincidono
                se l'ente dichiara per sé. Il CF Softwarehouse è quello di chi produce il file (es. il tuo codice
                consulente). PRGAZIENDA 00000 = nessuna unità produttiva. I campi CF Azienda e PRGAZIENDA vengono
                pre-compilati nelle nuove righe EnteVersante.
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════
            TAB 1 – DIPENDENTI
        ════════════════════════════════ */}
        {tab === 1 && (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "10px" }}>
              <button style={{ ...C.btn("primary"), padding: "6px 16px", fontSize: "12px" }} onClick={addDip}>
                + Aggiungi dipendente
              </button>
            </div>

            {dips.length === 0 && (
              <div style={C.empty}>
                Nessun dipendente. Clicca "+ Aggiungi dipendente" per iniziare.<br />
                <span style={{ fontSize: "11px", color: "#0e2030" }}>
                  Ogni dipendente può avere N quadri V1 (uno per ciascun periodo da regolarizzare).
                </span>
              </div>
            )}

            {dips.map((dip) => (
              <div key={dip.id} style={C.card}>
                <div
                  style={C.cardHdr}
                  onClick={() => {
                    setXDip(xDip === dip.id ? null : dip.id);
                    setXPer(null);
                  }}
                >
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <span style={{ ...C.mono, color: "#00c8e0", fontWeight: "700", fontSize: "12px" }}>
                      {dip.CFLavoratore || "— CF —"}
                    </span>
                    <span style={{ color: "#8ab8d0" }}>
                      {dip.Cognome || "Cognome"} {dip.Nome || "Nome"}
                    </span>
                    <span style={{ ...C.badge("#208060"), fontSize: "9px" }}>
                      {dip.periodi.length} V1
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <span style={{ fontSize: "10px", color: xDip === dip.id ? "#00c8e0" : "#1a3a58" }}>
                      {xDip === dip.id ? "▲" : "▼"}
                    </span>
                    <button
                      style={C.btn("danger")}
                      onClick={(e) => { e.stopPropagation(); removeDip(dip.id); }}
                    >✕</button>
                  </div>
                </div>
                {xDip === dip.id && renderDip(dip)}
              </div>
            ))}
          </>
        )}

        {/* ════════════════════════════════
            TAB 2 – GENERA XML
        ════════════════════════════════ */}
        {tab === 2 && (
          <>
            <div style={{ display: "flex", gap: "10px", marginBottom: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <button
                style={{ ...C.btn("success"), padding: "7px 20px", fontSize: "13px" }}
                onClick={genera}
              >
                ⚡ Genera XML
              </button>
              {xml && (
                <button
                  style={{ ...C.btn("primary"), padding: "7px 20px", fontSize: "13px" }}
                  onClick={scarica}
                >
                  ⬇ Scarica XML
                </button>
              )}
              {xml && (
                <span style={{ fontSize: "11px", color: "#208060" }}>
                  ✓ {xml.length.toLocaleString("it")} car. · {totPer} PosPA · {totEV} EnteVersante
                  {a.AnnoMeseDenuncia && (
                    <> · file: UNIEV{a.AnnoMeseDenuncia.replace("-", "").slice(2)}.xml</>
                  )}
                </span>
              )}
            </div>

            {!xml && (
              <div style={C.empty}>
                Clicca "Genera XML" per produrre il flusso UniEmens variazione.<br />
                <span style={{ fontSize: "11px" }}>Il file sarà conforme allo schema ListaPosPA TipoListaPosPA="1".</span>
              </div>
            )}

            {xml && (
              <textarea
                style={{
                  width: "100%",
                  height: "520px",
                  background: "#040c14",
                  border: "1px solid #1a334f",
                  borderRadius: "5px",
                  color: "#70c890",
                  fontFamily: "monospace",
                  fontSize: "11px",
                  padding: "10px",
                  boxSizing: "border-box",
                  outline: "none",
                  resize: "vertical",
                  lineHeight: "1.5",
                }}
                value={xml}
                readOnly
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
