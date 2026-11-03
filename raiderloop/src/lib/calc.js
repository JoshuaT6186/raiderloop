/**
 * A small, safe math engine for the calculators. No eval(): input is
 * tokenized, turned into postfix (shunting-yard), and run on a tiny
 * stack machine, so typed text can never execute code.
 *
 * Supports + − × ÷ ^ !, parentheses, implicit multiplication (2x,
 * 3(4), (x+1)(x-1), 2π), constants pi/π and e, the variable x, and:
 * sin cos tan asin acos atan sinh cosh tanh sqrt √ cbrt abs ln log
 * (base 10) log2 exp floor ceil round.
 */

const FUNCS = {
  sin: 1, cos: 1, tan: 1, asin: 1, acos: 1, atan: 1, sinh: 1, cosh: 1, tanh: 1,
  sqrt: 1, cbrt: 1, abs: 1, ln: 1, log: 1, log2: 1, exp: 1, floor: 1, ceil: 1, round: 1,
};
const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, neg: 3, '^': 4 };
const RIGHT = { '^': true, neg: true };

export class CalcError extends Error {}

function normalize(src) {
  return String(src || '')
    .replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-')
    .replace(/π/g, 'pi').replace(/√/g, 'sqrt').replace(/²/g, '^2').replace(/³/g, '^3')
    .replace(/\*\*/g, '^')
    .replace(/^\s*(y|f\s*\(\s*x\s*\))\s*=/i, '')
    .trim();
}

function tokenize(src) {
  const s = normalize(src);
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++;
      if (s[j] === 'E' && /[-+0-9]/.test(s[j + 1] || '')) { j += 2; while (j < s.length && /[0-9]/.test(s[j])) j++; }
      const n = Number(s.slice(i, j));
      if (!Number.isFinite(n)) throw new CalcError(`"${s.slice(i, j)}" isn't a number`);
      out.push({ t: 'num', v: n }); i = j; continue;
    }
    if (/[a-z]/i.test(c)) {
      let j = i; while (j < s.length && /[a-z]/i.test(s[j])) j++;
      if (/log$/i.test(s.slice(i, j)) && s[j] === '2' && s[j + 1] === '(') j++; // log2(…)
      let word = s.slice(i, j).toLowerCase();
      // Split runs like "2xsin" or "pix" into known pieces.
      while (word.length) {
        const fn = Object.keys(FUNCS).sort((a, b) => b.length - a.length).find((f) => word.startsWith(f));
        if (fn) { out.push({ t: 'fn', v: fn }); word = word.slice(fn.length); continue; }
        if (word.startsWith('pi')) { out.push({ t: 'num', v: Math.PI, c: 'pi' }); word = word.slice(2); continue; }
        if (word[0] === 'e') { out.push({ t: 'num', v: Math.E, c: 'e' }); word = word.slice(1); continue; }
        if (word[0] === 'x') { out.push({ t: 'x' }); word = word.slice(1); continue; }
        throw new CalcError(`Flyer doesn't know "${s.slice(i, j)}"`);
      }
      i = j; continue;
    }
    if ('+-*/^(),!'.includes(c)) { out.push({ t: c }); i++; continue; }
    throw new CalcError(`"${c}" isn't something the calculator understands`);
  }
  // Implicit multiplication: 2x, 2(…), (…)(…), x(…), )x, 2pi, x sin(…)
  const res = [];
  const valueEnd = (k) => k && (k.t === 'num' || k.t === 'x' || k.t === ')' || k.t === '!');
  const valueStart = (k) => k && (k.t === 'num' || k.t === 'x' || k.t === '(' || k.t === 'fn');
  for (const k of out) {
    if (valueEnd(res[res.length - 1]) && valueStart(k)) res.push({ t: '*' });
    res.push(k);
  }
  return res;
}

function toPostfix(tokens) {
  const out = []; const ops = [];
  let prev = null;
  for (const k of tokens) {
    if (k.t === 'num' || k.t === 'x') out.push(k);
    else if (k.t === 'fn') ops.push(k);
    else if (k.t === '(') ops.push(k);
    else if (k.t === ')') {
      while (ops.length && ops[ops.length - 1].t !== '(') out.push(ops.pop());
      if (!ops.length) throw new CalcError('A ")" is missing its "("');
      ops.pop();
      if (ops.length && ops[ops.length - 1].t === 'fn') out.push(ops.pop());
    } else if (k.t === '!') out.push({ t: 'fact' });
    else if (k.t === ',') throw new CalcError('Commas aren\'t used here');
    else {
      let op = k.t;
      const unary = !prev || ['+', '-', '*', '/', '^', '(', 'neg', 'fn'].includes(prev.t);
      if (unary && op === '-') op = 'neg';
      else if (unary && op === '+') { prev = k; continue; }
      /* A prefix operator never pops anything: in 2^-1 the "-" belongs
         to the 1, so the ^ must stay on the stack. */
      if (op === 'neg') { ops.push({ t: op }); prev = { t: op }; continue; }
      while (ops.length) {
        const top = ops[ops.length - 1];
        if (top.t === '(') break;
        const tp = top.t === 'fn' ? 5 : PREC[top.t];
        if (tp > PREC[op] || (tp === PREC[op] && !RIGHT[op])) out.push(ops.pop()); else break;
      }
      ops.push({ t: op });
      prev = { t: op };
      continue;
    }
    prev = k;
  }
  while (ops.length) {
    const o = ops.pop();
    if (o.t === '(') throw new CalcError('A "(" is missing its ")"');
    out.push(o);
  }
  return out;
}

function factorial(n) {
  if (n < 0 || !Number.isInteger(n)) throw new CalcError('! only works on whole numbers 0 or more');
  if (n > 170) return Infinity;
  let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
}

function run(postfix, x, deg) {
  const st = [];
  const trig = (f) => (v) => f(deg ? (v * Math.PI) / 180 : v);
  const atrig = (f) => (v) => (deg ? (f(v) * 180) / Math.PI : f(v));
  const F = {
    sin: trig(Math.sin), cos: trig(Math.cos), tan: trig(Math.tan),
    asin: atrig(Math.asin), acos: atrig(Math.acos), atan: atrig(Math.atan),
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
    ln: Math.log, log: Math.log10, log2: Math.log2, exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round,
  };
  for (const k of postfix) {
    if (k.t === 'num') st.push(k.v);
    else if (k.t === 'x') { if (x == null) throw new CalcError('Use the graph tab for expressions with x'); st.push(x); }
    else if (k.t === 'fn') { if (!st.length) throw new CalcError(`${k.v}() needs a number inside`); st.push(F[k.v](st.pop())); }
    else if (k.t === 'neg') { if (!st.length) throw new CalcError('Something is missing after "-"'); st.push(-st.pop()); }
    else if (k.t === 'fact') { if (!st.length) throw new CalcError('Something is missing before "!"'); st.push(factorial(st.pop())); }
    else {
      if (st.length < 2) throw new CalcError('Something is missing around an operator');
      const b = st.pop(); const a = st.pop();
      if (k.t === '+') st.push(a + b);
      else if (k.t === '-') st.push(a - b);
      else if (k.t === '*') st.push(a * b);
      else if (k.t === '/') st.push(a / b);
      else if (k.t === '^') st.push(a ** b);
    }
  }
  if (st.length !== 1) throw new CalcError("That expression isn't complete");
  return st[0];
}

/** Parse once, evaluate many times (for graphing). */
export function compile(expr) {
  const pf = toPostfix(tokenize(expr));
  if (!pf.length) throw new CalcError('Type something to calculate');
  const usesX = pf.some((k) => k.t === 'x');
  return { usesX, at: (x, deg = false) => run(pf, x, deg) };
}

export function evaluate(expr, { deg = false } = {}) {
  return compile(expr).at(null, deg);
}

/* Friendly number display: no floating-point noise like 0.30000000004. */
export function fmtNum(n) {
  if (n == null || Number.isNaN(n)) return 'undefined';
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '−∞';
  if (Math.abs(n) >= 1e12 || (Math.abs(n) < 1e-9 && n !== 0)) return n.toExponential(6).replace(/\.?0+e/, 'e');
  return String(Number(n.toPrecision(12)));
}

/* Sample a function across a window, splitting the path where the
   function jumps (like tan) or is undefined (like sqrt of negatives). */
export function samplePath(fn, { xMin, xMax, yMin, yMax, width, height, steps = 240, deg = false }) {
  const sx = (x) => ((x - xMin) / (xMax - xMin)) * width;
  const sy = (y) => height - ((y - yMin) / (yMax - yMin)) * height;
  let d = ''; let pen = false; let lastY = null;
  for (let i = 0; i <= steps; i++) {
    const x = xMin + ((xMax - xMin) * i) / steps;
    let y;
    try { y = fn.at(x, deg); } catch (e) { y = NaN; }
    if (!Number.isFinite(y) || (lastY != null && Math.abs(y - lastY) > (yMax - yMin) * 2)) { pen = false; lastY = Number.isFinite(y) ? y : null; continue; }
    const py = Math.max(-height, Math.min(height * 2, sy(y)));
    d += `${pen ? 'L' : 'M'}${sx(x).toFixed(1)} ${py.toFixed(1)} `;
    pen = true; lastY = y;
  }
  return d.trim();
}
