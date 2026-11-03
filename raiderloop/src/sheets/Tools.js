/**
 * Tools: a scientific calculator and a graphing calculator, built on
 * lib/calc.js (no eval, works offline). Graph paper, of course.
 */
import React, { useMemo, useState } from 'react';
import { View, Pressable, Text } from 'react-native';
import { Sheet, T, PostIt, PT, Card, Button, Chip, Field } from '../ui/Paper';
import Icon from '../ui/Icon';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { SvgLib, tap } from '../lib/native';
import { openUrl } from '../lib/links';
import { compile, evaluate, fmtNum, samplePath } from '../lib/calc';

const INK = '#1F2A44';

/* ---------- Scientific ---------- */
const KEYS = [
  ['C', '⌫', '(', ')', '÷'],
  ['sin', 'cos', 'tan', '^', '×'],
  ['7', '8', '9', '√', '−'],
  ['4', '5', '6', 'ln', '+'],
  ['1', '2', '3', 'log', 'π'],
  ['0', '.', 'ans', '!', '='],
];
const FN_KEYS = { sin: 'sin(', cos: 'cos(', tan: 'tan(', ln: 'ln(', log: 'log(', '√': '√(' };
const OPS = new Set(['÷', '×', '−', '+', '^', '=']);

function Key({ k, onPress }) {
  const { t, f } = useTheme();
  const isNum = /^[0-9.]$/.test(k);
  const bg = k === '=' ? t.highlight : OPS.has(k) ? t.postit.yellow : FN_KEYS[k] || k === 'π' || k === '!' || k === 'ans' ? t.postit.blue : k === 'C' || k === '⌫' ? t.postit.pink : t.card;
  const fg = isNum ? t.ink : INK;
  return (
    <Pressable onPress={() => { tap(); onPress(k); }} accessibilityRole="button" accessibilityLabel={{ '⌫': 'Backspace', C: 'Clear', '+': 'Plus', '−': 'Minus', '×': 'Times', '÷': 'Divide', '=': 'Equals', '√': 'Square root', '^': 'Power', '!': 'Factorial', '.': 'Decimal point', π: 'Pi', ans: 'Last answer' }[k] || k}
      style={({ pressed }) => ({ flex: 1, height: 50, margin: 3, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: bg, borderWidth: 1.5, borderColor: t.border, opacity: pressed ? 0.7 : 1, transform: [{ translateY: pressed ? 1 : 0 }] })}>
      {k === '⌫' ? <Icon name="chevronLeft" size={20} color={INK} /> : (
        <Text style={{ fontFamily: f.bodyHeavy, fontWeight: f.bodyHeavy ? undefined : '800', fontSize: k.length > 2 ? 15 : 19, color: fg }}>{k}</Text>
      )}
    </Pressable>
  );
}

function Scientific() {
  const { t, f } = useTheme();
  const [expr, setExpr] = useState('');
  const [deg, setDeg] = useState(true);
  const [ans, setAns] = useState(null);
  const [err, setErr] = useState(null);
  const [history, setHistory] = useState([]);
  const preview = useMemo(() => {
    if (!expr) return null;
    try { return fmtNum(evaluate(expr, { deg })); } catch (e) { return null; }
  }, [expr, deg]);

  const press = (k) => {
    setErr(null);
    if (k === 'C') { setExpr(''); return; }
    if (k === '⌫') { setExpr((e) => e.replace(/(sin\(|cos\(|tan\(|ln\(|log\(|√\(|.)$/, '')); return; }
    if (k === 'ans') { if (ans != null) setExpr((e) => e + fmtNum(ans)); return; }
    if (k === '=') {
      if (!expr) return;
      try {
        const v = evaluate(expr, { deg });
        setHistory((h) => [{ expr, result: fmtNum(v) }, ...h].slice(0, 5));
        setAns(v); setExpr(fmtNum(v));
      } catch (e) { setErr(e.message); }
      return;
    }
    setExpr((e) => e + (FN_KEYS[k] || k));
  };

  return (
    <View>
      <Card header={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Chip label={deg ? 'Degrees' : 'Radians'} active onPress={() => setDeg(!deg)} style={{ marginBottom: 0 }} />
          <T kind="small" style={{ fontSize: 11 }}>tap to switch</T>
        </View>
        <Text accessibilityLabel={`Expression ${expr || 'empty'}`} style={{ fontFamily: f.body, fontSize: expr.length > 22 ? 18 : 24, color: t.ink, textAlign: 'right', minHeight: 32 }} numberOfLines={2}>{expr || ' '}</Text>
        <Text accessibilityLiveRegion="polite" style={{ fontFamily: f.bodyHeavy, fontWeight: f.bodyHeavy ? undefined : '800', fontSize: 30, color: err ? t.redPen : t.accent, textAlign: 'right', minHeight: 38 }} numberOfLines={1} adjustsFontSizeToFit>
          {err ? '' : preview != null && preview !== expr ? `= ${preview}` : ' '}
        </Text>
        {err ? <T kind="small" color={t.redPen} style={{ textAlign: 'right' }}>{err}</T> : null}
      </Card>
      <View style={{ marginTop: 10 }}>
        {KEYS.map((row, i) => <View key={i} style={{ flexDirection: 'row' }}>{row.map((k) => <Key key={k} k={k} onPress={press} />)}</View>)}
      </View>
      {history.length ? (
        <View style={{ marginTop: 12 }}>
          <T kind="tiny" style={{ marginBottom: 4 }}>Recent</T>
          {history.map((h, i) => (
            <Pressable key={i} onPress={() => setExpr(h.expr)} accessibilityRole="button" style={{ flexDirection: 'row', paddingVertical: 4 }}>
              <T kind="small" style={{ flex: 1 }} numberOfLines={1}>{h.expr}</T>
              <T kind="bold">= {h.result}</T>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/* ---------- Graphing ---------- */
const COLORS = ['#2F5DA8', '#C8413B', '#2E8256'];
function niceStep(raw) {
  const p = 10 ** Math.floor(Math.log10(raw));
  const n = raw / p;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
}

function GraphPaper({ fns, deg, view, width, height }) {
  const { t } = useTheme();
  if (!SvgLib || !width) return <View style={{ height }} />;
  const { default: Svg, Path, Text: SvgText } = SvgLib;
  const { xMin, xMax, yMin, yMax } = view;
  const sx = (x) => ((x - xMin) / (xMax - xMin)) * width;
  const sy = (y) => height - ((y - yMin) / (yMax - yMin)) * height;
  const step = niceStep((xMax - xMin) / 8);
  let minor = ''; let major = '';
  for (let x = Math.ceil(xMin / (step / 2)) * (step / 2); x <= xMax; x += step / 2) {
    const d = `M${sx(x).toFixed(1)} 0 V${height} `;
    if (Math.abs((x / step) - Math.round(x / step)) < 1e-6) major += d; else minor += d;
  }
  for (let y = Math.ceil(yMin / (step / 2)) * (step / 2); y <= yMax; y += step / 2) {
    const d = `M0 ${sy(y).toFixed(1)} H${width} `;
    if (Math.abs((y / step) - Math.round(y / step)) < 1e-6) major += d; else minor += d;
  }
  const axisY = yMin <= 0 && yMax >= 0 ? sy(0) : null;
  const axisX = xMin <= 0 && xMax >= 0 ? sx(0) : null;
  const labels = [];
  for (let x = Math.ceil(xMin / step) * step; x <= xMax; x += step) {
    if (Math.abs(x) < step / 2) continue;
    labels.push(<SvgText key={`x${x}`} x={sx(x)} y={Math.min(height - 3, Math.max(11, (axisY ?? height - 3) + 12))} fontSize={9.5} fill={t.pencil} textAnchor="middle">{fmtNum(Number(x.toPrecision(6)))}</SvgText>);
  }
  for (let y = Math.ceil(yMin / step) * step; y <= yMax; y += step) {
    if (Math.abs(y) < step / 2) continue;
    labels.push(<SvgText key={`y${y}`} x={Math.min(width - 3, Math.max(3, (axisX ?? 3) + 4))} y={sy(y) + 3} fontSize={9.5} fill={t.pencil}>{fmtNum(Number(y.toPrecision(6)))}</SvgText>);
  }
  return (
    <Svg width={width} height={height}>
      <Path d={minor} stroke={t.rule} strokeWidth={0.6} />
      <Path d={major} stroke={t.rule} strokeWidth={1.2} />
      {axisY != null ? <Path d={`M0 ${axisY} H${width}`} stroke={t.ink} strokeWidth={1.4} /> : null}
      {axisX != null ? <Path d={`M${axisX} 0 V${height}`} stroke={t.ink} strokeWidth={1.4} /> : null}
      {labels}
      {fns.map((c, i) => (c && c.ok ? (
        <Path key={i} d={samplePath(c.fn, { ...view, width, height, deg, steps: 300 })} stroke={COLORS[i]} strokeWidth={2.4} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      ) : null))}
    </Svg>
  );
}

function Graphing() {
  const { t } = useTheme();
  const [exprs, setExprs] = useState(['x^2 - 2x - 3', '', '']);
  const [deg, setDeg] = useState(false);
  const [range, setRange] = useState(10);
  const [center, setCenter] = useState({ x: 0, y: 0 });
  const [w, setW] = useState(0);
  const [atX, setAtX] = useState('');
  const H = 280;
  const fns = useMemo(() => exprs.map((s) => {
    if (!s.trim()) return null;
    try { return { ok: true, fn: compile(s) }; } catch (e) { return { ok: false, err: e.message }; }
  }), [exprs]);
  const yRange = w ? (range * H) / w : range;
  const view = { xMin: center.x - range, xMax: center.x + range, yMin: center.y - yRange, yMax: center.y + yRange };
  const pan = (dx, dy) => setCenter((c) => ({ x: c.x + dx * range * 0.5, y: c.y + dy * yRange * 0.5 }));
  const xVal = (() => { try { return atX.trim() ? evaluate(atX) : null; } catch (e) { return null; } })();

  return (
    <View>
      {exprs.map((s, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS[i], marginTop: 16, marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Field placeholder={i === 0 ? 'y = x^2 - 2x - 3' : 'y = another function (optional)'} value={s} autoCapitalize="none" autoCorrect={false}
              onChangeText={(v) => setExprs((a) => a.map((x, k) => (k === i ? v : x)))} style={{ marginBottom: fns[i] && !fns[i].ok ? 2 : 8 }} />
            {fns[i] && !fns[i].ok ? <T kind="small" color={t.redPen} style={{ marginBottom: 8 }}>{fns[i].err}</T> : null}
          </View>
        </View>
      ))}
      <View onLayout={(e) => setW(Math.floor(e.nativeEvent.layout.width))} style={{ height: H, borderWidth: 1.5, borderColor: t.borderStrong, borderRadius: 8, overflow: 'hidden', backgroundColor: t.card }}>
        <GraphPaper fns={fns} deg={deg} view={view} width={w} height={H} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
        <Chip label="Zoom in" icon="plus" onPress={() => setRange((r) => Math.max(0.01, r / 2))} />
        <Chip label="Zoom out" onPress={() => setRange((r) => Math.min(1e6, r * 2))} />
        <Chip label="Reset" icon="refresh" onPress={() => { setRange(10); setCenter({ x: 0, y: 0 }); }} />
        <Chip label={deg ? 'Degrees' : 'Radians'} onPress={() => setDeg(!deg)} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip label="← Left" onPress={() => pan(-1, 0)} />
        <Chip label="Right →" onPress={() => pan(1, 0)} />
        <Chip label="↑ Up" onPress={() => pan(0, 1)} />
        <Chip label="↓ Down" onPress={() => pan(0, -1)} />
      </View>
      <Card style={{ marginTop: 6 }}>
        <Field label="Find y at x =" placeholder="e.g. 3" value={atX} onChangeText={setAtX} keyboardType="numbers-and-punctuation" style={{ marginBottom: 6 }} />
        {xVal != null ? fns.map((c, i) => (c && c.ok ? (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS[i], marginRight: 8 }} />
            <T kind="body">y = {(() => { try { return fmtNum(c.fn.at(xVal, deg)); } catch (e) { return 'undefined'; } })()}</T>
          </View>
        ) : null)) : <T kind="small">Type an x value to read each graph.</T>}
      </Card>
    </View>
  );
}

export function ToolsSheet({ onClose, initialTab }) {
  const { t } = useTheme();
  const { setTab, showToast } = useApp();
  const [tab, setToolTab] = useState(initialTab || 'sci');
  return (
    <Sheet title="Tools" hand="Calculators that work offline." onClose={onClose} height={0.94}>
      <View style={{ flexDirection: 'row', marginBottom: 14 }}>
        {[['sci', 'Scientific', 'calculator'], ['graph', 'Graphing', 'grid']].map(([id, label, icon]) => (
          <Pressable key={id} onPress={() => setToolTab(id)} accessibilityRole="tab" accessibilityState={{ selected: tab === id }}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderBottomWidth: 3, borderColor: tab === id ? t.accent : 'transparent' }}>
            <Icon name={icon} size={18} color={tab === id ? t.accent : t.pencil} />
            <T kind="small" color={tab === id ? t.accent : t.pencil} style={{ fontSize: 12 }}>{label}</T>
          </Pressable>
        ))}
      </View>
      {tab === 'sci' ? <Scientific /> : <Graphing />}
      <PostIt color="pink" tilt={-0.8} style={{ marginTop: 18 }}>
        <PT kind="bold">Heads up</PT>
        <PT kind="small">Most exams don't allow phone calculators. Check your syllabus before test day.</PT>
      </PostIt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 }}>
        <Button title="Open Desmos" icon="link" small kind="ghost" onPress={() => openUrl('https://www.desmos.com/calculator')} style={{ marginRight: 8, marginBottom: 8 }} />
        <Button title="GPA calculator" icon="percent" small kind="ghost" onPress={() => { onClose(); setTab('schedule'); showToast('Tap the GPA tab'); }} style={{ marginBottom: 8 }} />
      </View>
    </Sheet>
  );
}
