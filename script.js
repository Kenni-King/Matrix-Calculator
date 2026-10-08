/* ============================================
   Kenni Matrix — Professional Matrix Calculator
   Script — All Matrix Operations & UI Logic
   ============================================ */

/* ============================================
   UTILITY FUNCTIONS
   ============================================ */

const Utils = {
  isSquare(m) {
    return m.length === m[0].length;
  },

  clone(m) {
    return m.map(row => [...row]);
  },

  isZeroMatrix(m) {
    return m.every(row => row.every(cell => Math.abs(cell) < 1e-10));
  },

  isIdentityMatrix(m) {
    if (!this.isSquare(m)) return false;
    return m.every((row, i) =>
      row.every((cell, j) =>
        i === j ? Math.abs(cell - 1) < 1e-10 : Math.abs(cell) < 1e-10
      )
    );
  },

  isDiagonal(m) {
    if (!this.isSquare(m)) return false;
    return m.every((row, i) =>
      row.every((cell, j) => i !== j ? Math.abs(cell) < 1e-10 : true)
    );
  },

  isUpperTriangular(m) {
    if (!this.isSquare(m)) return false;
    return m.every((row, i) =>
      row.every((cell, j) => j < i ? Math.abs(cell) < 1e-10 : true)
    );
  },

  isLowerTriangular(m) {
    if (!this.isSquare(m)) return false;
    return m.every((row, i) =>
      row.every((cell, j) => j > i ? Math.abs(cell) < 1e-10 : true)
    );
  },

  isSymmetric(m) {
    if (!this.isSquare(m)) return false;
    for (let i = 0; i < m.length; i++) {
      for (let j = 0; j < m[0].length; j++) {
        if (Math.abs(m[i][j] - m[j][i]) > 1e-10) return false;
      }
    }
    return true;
  },

  isSkewSymmetric(m) {
    if (!this.isSquare(m)) return false;
    for (let i = 0; i < m.length; i++) {
      for (let j = 0; j < m[0].length; j++) {
        if (Math.abs(m[i][j] + m[j][i]) > 1e-10) return false;
      }
    }
    return true;
  },

  isPositiveDefinite(m) {
    if (!this.isSymmetric(m)) return false;
    try {
      const chol = MatrixMath.choleskyDecomposition(m);
      return chol !== null;
    } catch {
      return false;
    }
  },

  formatNumber(n) {
    if (n === undefined || n === null || !isFinite(n)) return '—';
    if (Math.abs(n) < 1e-12) return '0';
    const s = n.toFixed(6);
    return parseFloat(s).toString();
  },

  /* Exact fraction ("1/3", "-7/3") when possible, otherwise decimal */
  formatFraction(n, maxDen = 12) {
    if (n === undefined || n === null || !isFinite(n)) return '—';
    if (Math.abs(n) < 1e-12) return '0';
    if (Number.isInteger(n)) return String(n);
    const sign = n < 0 ? -1 : 1;
    const x = Math.abs(n);
    for (let den = 2; den <= maxDen; den++) {
      const num = Math.round(x * den);
      if (num > 0 && Math.abs(x - num / den) < 1e-9) {
        return (sign < 0 ? '-' : '') + num + '/' + den;
      }
    }
    return this.formatNumber(n);
  },

  /* Fraction with a typographic minus — for equations and prose */
  formatMath(n) {
    return this.formatFraction(n).replace(/-/g, '−');
  },

  formatTime(ms) {
    if (ms < 0.001) return '< 0.001 ms';
    if (ms < 1) return ms.toFixed(3) + ' ms';
    if (ms < 1000) return ms.toFixed(2) + ' ms';
    return (ms / 1000).toFixed(2) + ' s';
  }
};

/* ============================================
   EQUATION PARSER (systems of linear equations)
   Turns text such as "2x + 3y = 7" into the
   coefficient matrix A and the constants vector b
   ============================================ */

const Equations = {
  /* Accept equations pasted from textbooks / PDFs: mathematical italic letters
     (𝑥 𝑦 𝑧), typographic minus (− – —), × ÷, fullwidth ＝ ＋ and exotic spaces
     are all folded down to plain ASCII before tokenising. */
  normalize(text) {
    return String(text)
      .normalize('NFKC')
      .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\u2796]/g, '-')
      .replace(/[\u00D7\u22C5\u2219\u2022]/g, '*')
      .replace(/[\u00F7\u2215\u2044]/g, '/')
      .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g, ' ');
  },

  parse(text) {
    const rawLines = this.normalize(text).split(/\r?\n/);
    const lines = [];
    rawLines.forEach((raw, i) => {
      const trimmed = raw.trim();
      if (trimmed) lines.push({ text: trimmed, no: i + 1 });
    });

    if (lines.length === 0) {
      throw new Error('Enter at least one equation (one per line).');
    }

    const varNames = [];
    const rows = [];

    for (const line of lines) {
      const parsed = this.parseLine(line.text, line.no);
      rows.push(parsed);
      for (const v of parsed.order) {
        if (!varNames.includes(v)) varNames.push(v);
      }
    }

    const A = rows.map(r => varNames.map(v => {
      const c = r.coeffs[v] || 0;
      return Math.abs(c) < 1e-12 ? 0 : c;
    }));
    const b = rows.map(r => r.constant);

    if (varNames.length === 0) {
      throw new Error('The equations contain no variables — there is nothing to solve for.');
    }

    return { A, b, vars: varNames, equations: lines.map(l => l.text) };
  },

  parseLine(line, lineNo) {
    if (!line.includes('=')) {
      throw new Error(`Line ${lineNo}: "${line}" has no "=" sign. Write each equation like: 2x + 3y = 7`);
    }
    const parts = line.split('=');
    if (parts.length !== 2) {
      throw new Error(`Line ${lineNo}: "${line}" contains more than one "=" sign. Use exactly one per line.`);
    }

    const badLHS = parts[0].match(/[^0-9a-zA-Z_.+\-*/=\s]/);
    const badRHS = parts[1].match(/[^0-9a-zA-Z_.+\-*/=\s]/);
    if (badLHS || badRHS) {
      const ch = (badLHS || badRHS)[0];
      throw new Error(`Line ${lineNo}: unsupported character "${ch}". Use numbers, variable names and + - * / only (brackets are not supported).`);
    }

    const lhs = this.parseSide(parts[0], lineNo);
    const rhs = this.parseSide(parts[1], lineNo);

    // Move everything to the left: (lhs − rhs)·x = rhsConstant − lhsConstant
    const coeffs = {};
    const order = [];
    for (const v of lhs.order) {
      coeffs[v] = lhs.coeffs[v];
      order.push(v);
    }
    for (const v of rhs.order) {
      const c = rhs.coeffs[v] || 0;
      if (coeffs[v] === undefined) {
        coeffs[v] = 0;
        order.push(v);
      }
      coeffs[v] -= c;
    }

    return { coeffs, order, constant: rhs.constant - lhs.constant };
  },

  /* Parse one side of an equation into coefficients + constant term */
  parseSide(s, lineNo) {
    const str = String(s).replace(/\s+/g, '');
    const n = str.length;
    let i = 0;
    const coeffs = {};
    const order = [];
    let constant = 0;

    const readNumber = () => {
      const start = i;
      while (i < n && /[0-9.]/.test(str[i])) i++;
      if (i < n && (str[i] === 'e' || str[i] === 'E')) {
        let j = i + 1;
        if (j < n && (str[j] === '+' || str[j] === '-')) j++;
        if (j < n && /[0-9]/.test(str[j])) {
          while (j < n && /[0-9]/.test(str[j])) j++;
          i = j;
        }
      }
      if (i === start) return null;
      const val = parseFloat(str.slice(start, i));
      if (isNaN(val)) throw new Error(`Line ${lineNo}: "${str.slice(start, i)}" is not a valid number.`);
      return val;
    };

    const readVar = () => {
      const start = i;
      while (i < n && /[a-zA-Z0-9_]/.test(str[i])) i++;
      if (i === start) return null;
      return str.slice(start, i);
    };

    if (str === '') return { coeffs, order, constant };

    while (i < n) {
      let sign = 1;
      if (str[i] === '+') { i++; continue; }
      if (str[i] === '-') { sign = -1; i++; if (i >= n || !/[0-9.a-zA-Z_]/.test(str[i])) throw new Error(`Line ${lineNo}: dangling "-" sign.`); }

      let coef = null;
      if (/[0-9.]/.test(str[i])) {
        coef = readNumber();
        if (i < n && str[i] === '/') {
          i++;
          const d = readNumber();
          if (d === null) throw new Error(`Line ${lineNo}: expected a number after "/".`);
          coef = coef / d;
        } else if (i < n && str[i] === '*') {
          i++;
        }
      }

      if (i < n && /[a-zA-Z_]/.test(str[i])) {
        const name = readVar();
        let c = coef === null ? 1 : coef;
        if (i < n && str[i] === '/') {
          i++;
          const d = readNumber();
          if (d === null) throw new Error(`Line ${lineNo}: expected a number after "/".`);
          c = c / d;
        }
        if (coeffs[name] === undefined) order.push(name);
        coeffs[name] = (coeffs[name] || 0) + sign * c;
      } else if (coef !== null) {
        constant += sign * coef;
      } else {
        throw new Error(`Line ${lineNo}: could not read "${str.slice(i, i + 8)}" in "${str}".`);
      }

      if (i < n && str[i] !== '+' && str[i] !== '-') {
        throw new Error(`Line ${lineNo}: unexpected "${str[i]}" in "${str}". Separate terms with + or -.`);
      }
    }

    return { coeffs, order, constant };
  }
};

/* ============================================
   MATRIX MATH ENGINE
   ============================================ */

const MatrixMath = {
  add(A, B) {
    return A.map((row, i) => row.map((val, j) => val + B[i][j]));
  },

  subtract(A, B) {
    return A.map((row, i) => row.map((val, j) => val - B[i][j]));
  },

  multiply(A, B) {
    const m = A.length, n = A[0].length, p = B[0].length;
    const result = Array.from({ length: m }, () => new Array(p).fill(0));
    for (let i = 0; i < m; i++) {
      for (let k = 0; k < n; k++) {
        const aik = A[i][k];
        if (aik === 0) continue;
        for (let j = 0; j < p; j++) {
          result[i][j] += aik * B[k][j];
        }
      }
    }
    return result;
  },

  scalarMultiply(A, k) {
    return A.map(row => row.map(val => val * k));
  },

  transpose(A) {
    return A[0].map((_, j) => A.map(row => row[j]));
  },

  determinant(A) {
    const n = A.length;
    if (n === 1) return A[0][0];
    if (n === 2) return A[0][0] * A[1][1] - A[0][1] * A[1][0];
    if (n <= 6) return this._detRecursive(A);
    return this._detRowReduce(A);
  },

  _detRecursive(A) {
    const n = A.length;
    if (n === 1) return A[0][0];
    if (n === 2) return A[0][0] * A[1][1] - A[0][1] * A[1][0];
    let det = 0;
    for (let j = 0; j < n; j++) {
      det += A[0][j] * this.cofactor(A, 0, j);
    }
    return det;
  },

  _detRowReduce(A) {
    const m = Utils.clone(A);
    const n = m.length;
    let det = 1;
    for (let i = 0; i < n; i++) {
      let pivot = i;
      while (pivot < n && Math.abs(m[pivot][i]) < 1e-12) pivot++;
      if (pivot === n) return 0;
      if (pivot !== i) {
        [m[i], m[pivot]] = [m[pivot], m[i]];
        det *= -1;
      }
      det *= m[i][i];
      for (let j = i + 1; j < n; j++) {
        const factor = m[j][i] / m[i][i];
        for (let k = i; k < n; k++) {
          m[j][k] -= factor * m[i][k];
        }
      }
    }
    return det;
  },

  cofactor(A, row, col) {
    const minor = this.minorMatrix(A, row, col);
    return ((row + col) % 2 === 0 ? 1 : -1) * this.determinant(minor);
  },

  minorMatrix(A, row, col) {
    return A.filter((_, i) => i !== row).map(r => r.filter((_, j) => j !== col));
  },

  cofactorMatrix(A) {
    const n = A.length;
    return A.map((row, i) => row.map((_, j) => this.cofactor(A, i, j)));
  },

  adjoint(A) {
    return this.transpose(this.cofactorMatrix(A));
  },

  inverse(A) {
    const n = A.length;
    const det = this.determinant(A);
    if (Math.abs(det) < 1e-12) return null;
    const adj = this.adjoint(A);
    return this.scalarMultiply(adj, 1 / det);
  },

  rank(A) {
    const m = Utils.clone(A);
    let rows = m.length, cols = m[0].length;
    let rank = 0;
    for (let col = 0; col < cols && rank < rows; col++) {
      let pivot = rank;
      while (pivot < rows && Math.abs(m[pivot][col]) < 1e-12) pivot++;
      if (pivot === rows) continue;
      [m[rank], m[pivot]] = [m[pivot], m[rank]];
      const pivotVal = m[rank][col];
      for (let j = col; j < cols; j++) m[rank][j] /= pivotVal;
      for (let i = 0; i < rows; i++) {
        if (i !== rank && Math.abs(m[i][col]) > 1e-12) {
          const factor = m[i][col];
          for (let j = col; j < cols; j++) {
            m[i][j] -= factor * m[rank][j];
          }
        }
      }
      rank++;
    }
    return rank;
  },

  trace(A) {
    return A.reduce((sum, row, i) => sum + row[i], 0);
  },

  frobeniusNorm(A) {
    const sum = A.reduce((s, row) => s + row.reduce((ss, v) => ss + v * v, 0), 0);
    return Math.sqrt(sum);
  },

  matrixPower(A, power) {
    const n = A.length;
    if (power === 0) {
      return Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => i === j ? 1 : 0)
      );
    }
    if (power === 1) return Utils.clone(A);
    const half = this.matrixPower(A, Math.floor(power / 2));
    const squared = this.multiply(half, half);
    if (power % 2 === 0) return squared;
    return this.multiply(squared, A);
  },

  identity(n) {
    return Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => i === j ? 1 : 0)
    );
  },

  zeros(rows, cols) {
    return Array.from({ length: rows }, () => new Array(cols).fill(0));
  },

  random(rows, cols, min = -10, max = 10) {
    return Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () =>
        Math.round((Math.random() * (max - min) + min) * 100) / 100
      )
    );
  },

  detectType(A) {
    const types = [];
    if (Utils.isSquare(A)) {
      if (Utils.isIdentityMatrix(A)) types.push('Identity');
      else if (Utils.isDiagonal(A)) types.push('Diagonal');
      if (Utils.isUpperTriangular(A)) types.push('Upper Triangular');
      if (Utils.isLowerTriangular(A)) types.push('Lower Triangular');
      if (Utils.isSymmetric(A)) types.push('Symmetric');
      if (Utils.isSkewSymmetric(A)) types.push('Skew-Symmetric');
      if (Utils.isPositiveDefinite(A)) types.push('Positive Definite');
    }
    if (Utils.isZeroMatrix(A)) types.unshift('Zero');
    if (types.length === 0) types.push('General');
    return types.join(', ');
  },

  /* ------------------------------------------
     Variable names & equation formatting
     ------------------------------------------ */

  defaultVarNames(n) {
    const base = ['x', 'y', 'z', 'w', 'v', 'u', 't', 's'];
    const out = [];
    for (let i = 0; i < n; i++) out.push(i < base.length ? base[i] : `x${i + 1}`);
    return out;
  },

  varName(names, j) {
    return (names && names[j]) || `x${j + 1}`;
  },

  /* Render the rows of [A|b] as human-readable equations */
  formatEquations(A, b, names) {
    const vars = names || this.defaultVarNames(A[0].length);
    return A.map((row, i) => {
      const parts = [];
      row.forEach((coef, j) => {
        if (Math.abs(coef) < 1e-12) return;
        const neg = coef < 0;
        const abs = Math.abs(coef);
        const isOne = Math.abs(abs - 1) < 1e-12;
        const num = isOne ? '' : Utils.formatMath(abs);
        const gap = num.includes('/') ? ' ' : '';
        parts.push({ neg, text: num + gap + this.varName(vars, j) });
      });
      let lhs = '';
      parts.forEach((p, idx) => {
        if (idx === 0) lhs = (p.neg ? '−' : '') + p.text;
        else lhs += (p.neg ? ' − ' : ' + ') + p.text;
      });
      if (!lhs) lhs = '0';
      const rhs = b ? ` = ${Utils.formatMath(b[i])}` : '';
      return `${lhs}${rhs}`;
    });
  },

  /* ------------------------------------------
     Row reduction core
     Shared by Gaussian elimination, Gauss-Jordan,
     RREF and every linear-system solver.
     Produces detailed, explanatory steps.
     ------------------------------------------ */

  rowReduce(input, rhs, opts = {}) {
    const mode = opts.mode || 'rref';      // 'forward' | 'rref'
    const varNames = opts.varNames || null;
    const phase = opts.phase || 'Row reduction';
    const maxCols = opts.maxCols || Infinity;
    const m = Utils.clone(input);
    const rows = m.length, cols = m[0].length;
    const b = rhs ? rhs.slice() : null;
    const steps = [];
    const pivotCols = [];
    const detailed = rows * cols <= 400;
    const label = opts.label || (b ? '[A|b]' : 'A');
    let r = 0;

    const equations = () => (b ? this.formatEquations(m, b, varNames) : null);
    const snap = () => ({ matrix: Utils.clone(m), rhs: b ? b.slice() : null, label });

    /* Textbook row-operation line: "R2 → R2 − R1", "R1 → R1 − (2/3) × R3", ... */
    const rowOpText = (tj, factor, pr) => {
      const op = factor < 0 ? '+' : '−';
      const a = Utils.formatFraction(Math.abs(factor));
      const term = a === '1' ? `R${pr}` : (a.includes('/') ? `(${a}) × R${pr}` : `${a} × R${pr}`);
      return `R${tj} → R${tj} ${op} ${term}`;
    };

    steps.push({
      phase,
      title: b ? 'Write the system as an augmented matrix [A|b]' : 'Write out the matrix',
      detail: b
        ? 'Row i of the matrix is equation i: the leading columns hold the variable coefficients and the last column holds the constants. Every legal row operation — swapping two rows, multiplying a row by a non-zero number, or adding a multiple of one row to another — is exactly the same move you may make on the equations themselves, so the solution set never changes.'
        : 'The matrix is written out and is now ready for row operations.',
      equations: equations(),
      ...snap()
    });

    for (let c = 0; c < cols && r < rows && c < maxCols; c++) {
      // 1. Find a pivot in column c, starting from row r
      let p = r;
      while (p < rows && Math.abs(m[p][c]) < 1e-12) p++;

      if (p === rows) {
        steps.push({
          phase,
          title: `Column ${c + 1}: no pivot available`,
          detail: `Every entry in column ${c + 1} from row ${r + 1} downwards is already 0, so no row can serve as a pivot here. This column does not produce a leading 1 — it will be a free (non-pivot) column — and we move on to column ${c + 2}.`
        });
        continue;
      }

      // 2. Swap the pivot row into place if needed
      if (p !== r) {
        [m[r], m[p]] = [m[p], m[r]];
        if (b) { const t = b[r]; b[r] = b[p]; b[p] = t; }
        steps.push({
          phase,
          title: `Interchange rows ${r + 1} and ${p + 1}`,
          detail: `The pivot position (row ${r + 1}, column ${c + 1}) holds a 0, which cannot be used to eliminate anything. Row ${p + 1} has a non-zero entry in that column, so the two rows are swapped. Reordering equations does not change the solution set.`,
          math: `R${r + 1} ↔ R${p + 1}`,
          equations: equations(),
          ...snap()
        });
      }

      const pivotVal = m[r][c];

      // 3. Scale the pivot to 1 (RREF only) — skipped when it already is 1
      if (mode === 'rref' && Math.abs(pivotVal - 1) > 1e-12) {
        for (let k = c; k < cols; k++) m[r][k] /= pivotVal;
        if (b) b[r] /= pivotVal;
        const isInt = Math.abs(pivotVal - Math.round(pivotVal)) < 1e-12;
        steps.push({
          phase,
          title: `Scale row ${r + 1} so the pivot becomes 1`,
          detail: isInt
            ? `The pivot is ${Utils.formatMath(pivotVal)}. Dividing the whole row by that value turns it into 1, which is required for reduced row echelon form and keeps the rest of the arithmetic simple.`
            : `The pivot is ${Utils.formatMath(pivotVal)}. Multiplying the whole row by its reciprocal ${Utils.formatMath(1 / pivotVal)} turns it into 1, which is required for reduced row echelon form and keeps the rest of the arithmetic simple.`,
          math: isInt
            ? `R${r + 1} → R${r + 1} ÷ ${pivotVal < 0 ? '(' + Utils.formatMath(pivotVal) + ')' : Utils.formatFraction(pivotVal)}`
            : `R${r + 1} → R${r + 1} × (${Utils.formatMath(1 / pivotVal)})`,
          equations: equations(),
          ...snap()
        });
      }

      // 4. Eliminate the rest of the column — one row operation per step,
      //    so every snapshot shows exactly the effect of that single operation
      const pivotNow = m[r][c];
      const targets = [];
      const firstTarget = mode === 'rref' ? 0 : r + 1;
      for (let j = firstTarget; j < rows; j++) {
        if (j === r) continue;
        const factor = m[j][c] / pivotNow;
        if (Math.abs(factor) < 1e-12) continue;
        targets.push({ j, factor, orig: m[j][c] });
      }

      const applyTarget = (t) => {
        for (let k = 0; k < cols; k++) m[t.j][k] -= t.factor * m[r][k];
        if (b) b[t.j] -= t.factor * b[r];
      };

      const varLabel = this.varName(varNames, c);
      if (targets.length) {
        if (detailed) {
          for (const t of targets) {
            applyTarget(t);
            const where = t.j > r ? 'below' : 'above';
            const mathLine = rowOpText(t.j + 1, t.factor, r + 1);
            steps.push({
              phase,
              title: `Clear column ${c + 1} in row ${t.j + 1} (${where} the pivot)`,
              detail: `The multiple is factor = (entry ÷ pivot) = ${Utils.formatMath(t.orig)} ÷ ${Utils.formatMath(pivotNow)} = ${Utils.formatMath(t.factor)}. The row operation ${mathLine} then makes the entry in row ${t.j + 1}, column ${c + 1} equal to 0 — in equation language this cancels the "${varLabel}" term of equation ${t.j + 1} without changing the solution.`,
              math: mathLine,
              equations: equations(),
              ...snap()
            });
          }
        } else {
          targets.forEach(applyTarget);
          steps.push({
            phase,
            title: `Clear column ${c + 1} using pivot row ${r + 1}`,
            detail: `Each listed row has a multiple of the pivot row subtracted from it, which zeroes out every other entry in column ${c + 1} — i.e. it cancels the "${varLabel}" term in those equations.`,
            math: targets.map(t => rowOpText(t.j + 1, t.factor, r + 1)).join('   '),
            ...snap()
          });
        }
      }

      pivotCols.push(c);
      r++;
    }

    const rank = pivotCols.length;
    steps.push({
      phase,
      title: mode === 'rref' ? 'Finished: reduced row echelon form (RREF)' : 'Finished: forward elimination (upper triangular form)',
      detail: mode === 'rref'
        ? `Every pivot is 1 and is the only non-zero entry in its column. The pivot columns are ${pivotCols.length ? pivotCols.map(c => c + 1).join(', ') : '(none)'}, so the number of pivots — and therefore the rank — is ${rank}.`
        : `All entries below each pivot are 0, so the matrix is in upper triangular (row echelon) form. There are ${rank} pivots, so the rank is ${rank}.`,
      equations: equations(),
      ...snap()
    });

    return {
      matrix: m,
      rhs: b,
      steps,
      pivotCols,
      rank,
      singular: rows === cols && rank < cols
    };
  },

  /* Gaussian Elimination (forward elimination) */
  gaussianElimination(A, b, opts = {}) {
    return this.rowReduce(A, b, Object.assign({ mode: 'forward', phase: 'Gaussian elimination — forward elimination' }, opts));
  },

  /* Gauss-Jordan Elimination (full reduction to RREF) */
  gaussJordan(A, b, opts = {}) {
    return this.rowReduce(A, b, Object.assign({ mode: 'rref', phase: 'Gauss-Jordan elimination' }, opts));
  },

  /* RREF (Reduced Row Echelon Form) */
  rref(A, opts = {}) {
    return this.rowReduce(A, null, Object.assign({ mode: 'rref', phase: 'Reduced row echelon form (RREF)' }, opts));
  },

  /* LU Decomposition (Doolittle) */
  luDecomposition(A, phase = 'LU decomposition') {
    const n = A.length;
    const L = this.zeros(n, n);
    const U = this.zeros(n, n);
    const steps = [];
    const detailed = n <= 8;

    steps.push({
      phase,
      title: 'Goal: factor A as A = L × U',
      detail: 'Doolittle’s method builds a unit lower triangular matrix L (all diagonal entries equal to 1) and an upper triangular matrix U. The formulas used at each step are u(i,j) = a(i,j) − Σ(k<i) l(i,k)·u(k,j) for the rows of U, and l(j,i) = ( a(j,i) − Σ(k<i) l(j,k)·u(k,i) ) ÷ u(i,i) for the columns of L.',
      matrix: Utils.clone(A),
      label: 'A'
    });

    for (let i = 0; i < n; i++) {
      L[i][i] = 1;
      for (let j = i; j < n; j++) {
        let sum = 0;
        for (let k = 0; k < i; k++) sum += L[i][k] * U[k][j];
        U[i][j] = A[i][j] - sum;
      }
      if (Math.abs(U[i][i]) < 1e-12) {
        steps.push({
          phase,
          title: `Zero pivot at u(${i + 1},${i + 1}) — decomposition impossible`,
          detail: `The formula for column ${i + 1} of L requires dividing by u(${i + 1},${i + 1}) = 0. Without row exchanges (pivoting) this matrix has no LU factorisation; note that a zero pivot also implies det(A) = 0.`,
          matrix: Utils.clone(U),
          label: 'U'
        });
        return { L: null, U: null, steps, singular: true };
      }
      for (let j = i + 1; j < n; j++) {
        let sum = 0;
        for (let k = 0; k < i; k++) sum += L[j][k] * U[k][i];
        L[j][i] = (A[j][i] - sum) / U[i][i];
      }
      steps.push({
        phase: 'LU decomposition',
        title: `Compute row ${i + 1} of U and column ${i + 1} of L`,
        detail: `Row ${i + 1} of U comes from row ${i + 1} of A minus the overlap of the already-known parts of L and U; then each entry of column ${i + 1} of L divides that overlap by the pivot u(${i + 1},${i + 1}) = ${Utils.formatNumber(U[i][i])}.`,
        math: `u(${i + 1},${i + 1}) = ${Utils.formatNumber(U[i][i])}`,
        matrices: detailed ? [{ label: 'L', matrix: Utils.clone(L) }, { label: 'U', matrix: Utils.clone(U) }] : null
      });
    }

    steps.push({
      phase: 'Result',
      title: 'LU decomposition complete: A = L × U',
      detail: `Check by multiplying: L × U returns the original matrix A. This factorisation can now be used to solve Ax = b efficiently in two triangular solves.`,
      matrices: [{ label: 'L', matrix: Utils.clone(L) }, { label: 'U', matrix: Utils.clone(U) }]
    });
    return { L, U, steps, singular: false };
  },

  /* QR Decomposition (Gram-Schmidt) */
  qrDecomposition(A) {
    const m = A.length, n = A[0].length;
    const Q = this.zeros(m, n);
    const R = this.zeros(n, n);
    const steps = [];
    const detailed = m * n <= 64;

    steps.push({
      phase: 'QR decomposition',
      title: 'Goal: factor A as A = Q × R',
      detail: 'The modified Gram-Schmidt process turns the columns a₁ … aₙ of A into an orthonormal set q₁ … qₙ (these become the columns of Q) while recording how much of each earlier q was used in the coefficients r(i,j). R is upper triangular with r(j,j) = ‖v(j)‖, the length of the residual vector after removing earlier directions.',
      matrix: Utils.clone(A),
      label: 'A'
    });

    for (let j = 0; j < n; j++) {
      let v = A.map(row => row[j]);
      const projections = [];
      for (let i = 0; i < j; i++) {
        let dot = 0;
        for (let k = 0; k < m; k++) dot += v[k] * Q[k][i];
        R[i][j] = dot;
        for (let k = 0; k < m; k++) v[k] -= dot * Q[k][i];
        projections.push(`r(${i + 1},${j + 1}) = q${i + 1} · a${j + 1} = ${Utils.formatNumber(dot)}`);
      }
      let norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
      if (norm < 1e-12) {
        steps.push({
          phase: 'QR decomposition',
          title: `Column ${j + 1} is linearly dependent`,
          detail: `After removing the earlier directions the residual vector is the zero vector, so column ${j + 1} adds no new direction. The factorisation is incomplete (this signals a rank-deficient matrix); a value of 1 is stored in r(${j + 1},${j + 1}) to keep the arithmetic defined.`
        });
        norm = 1;
      }
      R[j][j] = norm;
      for (let k = 0; k < m; k++) Q[k][j] = v[k] / norm;
      steps.push({
        phase: 'QR decomposition',
        title: `Orthogonalise column ${j + 1}`,
        detail: `Project a${j + 1} onto the previous orthonormal columns q1 … q${j || '(none)'}, subtract those projections to obtain the residual v, then normalise it: r(${j + 1},${j + 1}) = ‖v‖ = ${Utils.formatNumber(norm)} and q${j + 1} = v ÷ ‖v‖.${projections.length ? ' ' + projections.join('; ') + '.' : ''}`,
        matrices: detailed ? [{ label: 'Q', matrix: Utils.clone(Q) }, { label: 'R', matrix: Utils.clone(R) }] : null
      });
    }

    steps.push({
      phase: 'Result',
      title: 'QR decomposition complete: A = Q × R',
      detail: 'Q has orthonormal columns (QᵀQ = I) and R is upper triangular. Multiplying Q × R reproduces A.',
      matrices: [{ label: 'Q', matrix: Utils.clone(Q) }, { label: 'R', matrix: Utils.clone(R) }]
    });
    return { Q, R, steps };
  },

  /* Cholesky Decomposition */
  choleskyDecomposition(A) {
    const n = A.length;
    const L = this.zeros(n, n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = 0;
        for (let k = 0; k < j; k++) {
          sum += L[i][k] * L[j][k];
        }
        if (i === j) {
          const val = A[i][i] - sum;
          if (val <= 1e-12) return null;
          L[i][j] = Math.sqrt(val);
        } else {
          L[i][j] = (A[i][j] - sum) / L[j][j];
        }
      }
    }
    return L;
  },

  /* Solve linear system Ax = b (delegates to the full system engine) */
  solveLinearSystem(A, b, method, varNames) {
    return this.solveSystem(A, b, method || 'auto', varNames);
  },

  /* ------------------------------------------
     Determinant with explanatory steps
     ------------------------------------------ */

  determinantDetailed(A) {
    const n = A.length;
    const steps = [];

    if (n === 1) {
      steps.push({
        phase: 'Determinant',
        title: '1×1 determinant',
        detail: 'The determinant of a 1×1 matrix is simply its only entry.',
        math: `det(A) = ${Utils.formatNumber(A[0][0])}`,
        matrix: Utils.clone(A)
      });
      return { det: A[0][0], steps };
    }

    if (n === 2) {
      const a = A[0][0], bb = A[0][1], c = A[1][0], d = A[1][1];
      const det = a * d - bb * c;
      steps.push({
        phase: 'Determinant',
        title: '2×2 formula: det = ad − bc',
        detail: `Multiply the diagonal entries and subtract the product of the off-diagonal entries: (${Utils.formatNumber(a)})(${Utils.formatNumber(d)}) − (${Utils.formatNumber(bb)})(${Utils.formatNumber(c)}).`,
        math: `det(A) = ${Utils.formatNumber(a)}·${Utils.formatNumber(d)} − ${Utils.formatNumber(bb)}·${Utils.formatNumber(c)} = ${Utils.formatNumber(det)}`,
        matrix: Utils.clone(A)
      });
      return { det, steps };
    }

    if (n <= 6) {
      steps.push({
        phase: 'Determinant',
        title: `Cofactor expansion along row 1 (${n}×${n} matrix)`,
        detail: `det(A) = Σⱼ (−1)^(1+j) · a(1,j) · det(M(1,j)), where M(1,j) is the minor matrix obtained by deleting row 1 and column j. Each term is the entry times its signed minor.`,
        matrix: Utils.clone(A)
      });
      let total = 0;
      for (let j = 0; j < n; j++) {
        const minor = this.minorMatrix(A, 0, j);
        const dm = this.determinant(minor);
        const sign = j % 2 === 0 ? 1 : -1;
        const term = A[0][j] * sign * dm;
        total += term;
        steps.push({
          phase: 'Determinant',
          title: `Term j = ${j + 1}: minor M(1,${j + 1})`,
          detail: `Delete row 1 and column ${j + 1} to get the minor below; its determinant is ${Utils.formatNumber(dm)}. The sign factor is (−1)^(1+${j + 1}) = ${sign > 0 ? '+1' : '−1'}.`,
          math: `${sign > 0 ? '+' : '−'} a(1,${j + 1}) · det(M(1,${j + 1})) = ${sign > 0 ? '+' : '−'}(${Utils.formatNumber(A[0][j])})(${Utils.formatNumber(dm)}) = ${Utils.formatNumber(term)}`,
          matrix: minor
        });
      }
      steps.push({
        phase: 'Determinant',
        title: 'Add the signed terms',
        detail: Math.abs(total) < 1e-12
          ? 'The terms cancel out completely: det(A) = 0, so A is singular (not invertible).'
          : `Summing the ${n} terms gives a non-zero value, so A is invertible.`,
        math: `det(A) = ${Utils.formatNumber(total)}`
      });
      return { det: total, steps };
    }

    // Large matrices: row reduction instead of cofactor expansion
    const m = Utils.clone(A);
    let det = 1;
    let swaps = 0;
    steps.push({
      phase: 'Determinant',
      title: 'Row reduction for a large matrix',
      detail: `Cofactor expansion needs ${n}! operations, which is far too many, so A is reduced to upper triangular form instead. Each row swap flips the sign of the determinant, and the determinant of a triangular matrix is the product of its diagonal entries.`,
      matrix: Utils.clone(m)
    });
    for (let i = 0; i < n; i++) {
      let p = i;
      while (p < n && Math.abs(m[p][i]) < 1e-12) p++;
      if (p === n) {
        steps.push({
          phase: 'Determinant',
          title: `Column ${i + 1} is entirely zero below the diagonal`,
          detail: 'A whole column of zeros means the columns are linearly dependent, so the determinant is 0.',
          matrix: Utils.clone(m)
        });
        return { det: 0, steps };
      }
      if (p !== i) {
        [m[i], m[p]] = [m[p], m[i]];
        swaps++;
        det *= -1;
        steps.push({
          phase: 'Determinant',
          title: `Row swap ${i + 1} ↔ ${p + 1}`,
          detail: 'Swapping two rows multiplies the determinant by −1.',
          math: `R${i + 1} ↔ R${p + 1}   (sign flipped, swaps so far: ${swaps})`,
          matrix: Utils.clone(m)
        });
      }
      det *= m[i][i];
      for (let j = i + 1; j < n; j++) {
        const f = m[j][i] / m[i][i];
        if (Math.abs(f) < 1e-14) continue;
        for (let k = i; k < n; k++) m[j][k] -= f * m[i][k];
      }
    }
    steps.push({
      phase: 'Determinant',
      title: 'Multiply the diagonal entries',
      detail: `The product of the diagonal entries, corrected by (−1)^${swaps} for the ${swaps} row swap${swaps === 1 ? '' : 's'}, gives the determinant.`,
      math: `det(A) = ${swaps % 2 === 0 ? '+' : '−'}(${m.map((row, i) => Utils.formatNumber(row[i])).join(' · ')}) = ${Utils.formatNumber(det)}`,
      matrix: Utils.clone(m)
    });
    return { det, steps };
  },

  /* ------------------------------------------
     Inverse via Gauss-Jordan on [A | I]
     ------------------------------------------ */

  inverseDetailed(A, phase = 'Computing A⁻¹ with Gauss-Jordan elimination') {
    const n = A.length;
    const steps = [];
    const id = this.identity(n);
    const aug = A.map((row, i) => [...row, ...id[i]]);

    steps.push({
      phase,
      title: 'Augment A with the identity: [A | I]',
      detail: 'Performing row operations on [A | I] applies exactly the same operations to A and to I simultaneously. The instant the left block becomes I, the right block has been transformed into A⁻¹ — because we will have turned the equation "A · X = I" into "I · X = A⁻¹".',
      matrix: aug,
      label: '[A | I]'
    });

    const red = this.rowReduce(aug, null, { mode: 'rref', maxCols: n, phase, label: '[A | I]' });
    steps.push(...red.steps);

    const left = red.matrix.map(row => row.slice(0, n));
    const right = red.matrix.map(row => row.slice(n));

    if (!Utils.isIdentityMatrix(left)) {
      steps.push({
        phase,
        title: 'The left block never became the identity matrix',
        detail: `Only ${red.rank} pivot(s) were found for ${n} columns, so A is singular (det(A) = 0) and no inverse exists.`
      });
      return { inverse: null, steps, singular: true };
    }

    steps.push({
      phase,
      title: 'Read off A⁻¹ from the right block',
      detail: 'The left block is now the identity, so the right block is the inverse matrix.',
      matrix: right,
      label: 'A⁻¹'
    });

    const product = this.multiply(A, right);
    steps.push({
      phase: 'Verification',
      title: 'Check: A × A⁻¹ should be the identity',
      detail: 'Multiplying a matrix by its inverse must give the identity matrix; any deviation would signal an arithmetic error.',
      matrix: product,
      label: 'A · A⁻¹'
    });

    return { inverse: right, steps, singular: false };
  },

  /* ------------------------------------------
     SYSTEMS OF LINEAR EQUATIONS (Ax = b)
     ------------------------------------------ */

  /* Kronecker–Capelli analysis: unique / infinite / none */
  analyzeSystem(A, b) {
    const m = A.length, n = A[0].length;
    const aug = A.map((row, i) => [...row, b[i]]);
    const rankA = this.rank(A);
    const rankAug = this.rank(aug);
    let status;
    if (rankAug > rankA) status = 'none';
    else if (rankA === n) status = 'unique';
    else status = 'infinite';
    return { m, n, rankA, rankAug, status, freeCount: n - rankA };
  },

  /* Describe the solution set from a reduced augmented system */
  describeSolution(R, names) {
    const m = R.matrix.length, n = R.matrix[0].length;
    const pivotCols = R.pivotCols;
    const freeCols = [];
    for (let c = 0; c < n; c++) if (!pivotCols.includes(c)) freeCols.push(c);

    const rowOfPivot = {};
    for (let i = 0; i < m; i++) {
      const c = R.matrix[i].findIndex(v => Math.abs(v) > 1e-10);
      if (c !== -1) rowOfPivot[c] = i;
    }

    let contradiction = null;
    for (let i = 0; i < m; i++) {
      const allZero = R.matrix[i].every(v => Math.abs(v) < 1e-10);
      if (allZero && R.rhs && Math.abs(R.rhs[i]) >= 1e-10) {
        contradiction = { row: i, value: R.rhs[i] };
        break;
      }
    }

    const pivotExprs = [];
    for (const c of pivotCols) {
      const i = rowOfPivot[c];
      let expr = `${this.varName(names, c)} = ${Utils.formatMath(R.rhs[i])}`;
      for (const f of freeCols) {
        const coef = R.matrix[i][f];
        if (Math.abs(coef) < 1e-12) continue;
        const abs = Math.abs(coef);
        const num = Math.abs(abs - 1) < 1e-12 ? '' : Utils.formatMath(abs) + (Utils.formatFraction(abs).includes('/') ? ' ' : '');
        expr += ` ${coef < 0 ? '+' : '−'} ${num}${this.varName(names, f)}`;
      }
      pivotExprs.push(expr);
    }

    return {
      pivotExprs,
      freeCols,
      freeNames: freeCols.map(c => this.varName(names, c)),
      contradiction,
      rowOfPivot
    };
  },

  /* Build the substitution-check lines for the verification phase */
  verifySolution(A, b, x, names) {
    const lines = [];
    let ok = true;
    const maxShow = Math.min(A.length, 8);
    for (let i = 0; i < A.length; i++) {
      let sum = 0;
      const parts = [];
      for (let j = 0; j < A[0].length; j++) {
        sum += A[i][j] * x[j];
        if (Math.abs(A[i][j]) < 1e-12) continue;
        const neg = A[i][j] < 0;
        const abs = Math.abs(A[i][j]);
        const num = Math.abs(abs - 1) < 1e-12 ? '' : Utils.formatNumber(abs);
        parts.push({ neg, text: `${num}(${Utils.formatNumber(x[j])})` });
      }
      let lhs = '';
      parts.forEach((p, idx) => {
        if (idx === 0) lhs = (p.neg ? '−' : '') + p.text;
        else lhs += (p.neg ? ' − ' : ' + ') + p.text;
      });
      if (!lhs) lhs = '0';
      const passed = Math.abs(sum - b[i]) < 1e-8;
      if (!passed) ok = false;
      if (i < maxShow) {
        lines.push(`Equation ${i + 1}:  ${lhs} = ${Utils.formatNumber(sum)}  ${passed ? '=' : '≠'}  ${Utils.formatNumber(b[i])}  ${passed ? '✓' : '✗'}`);
      }
    }
    if (A.length > maxShow) lines.push(`… ${A.length - maxShow} more equation(s) checked the same way`);
    return { ok, lines };
  },

  _methodName(method) {
    return {
      cramer: 'Cramer’s rule',
      inverse: 'The matrix-inverse method (x = A⁻¹b)',
      lu: 'LU decomposition',
      gaussjordan: 'Gauss-Jordan elimination'
    }[method] || 'This method';
  },

  /* Gauss-Jordan based solver (works for every consistent/inconsistent system) */
  _solveSystemGaussJordan(A, b, names, phase) {
    const steps = [];
    const R = this.rowReduce(A, b, { mode: 'rref', varNames: names, phase });
    steps.push(...R.steps);
    const desc = this.describeSolution(R, names);

    let solution = null;
    if (!desc.contradiction && desc.freeCols.length === 0) {
      solution = R.matrix[0].map((_, c) => R.rhs[desc.rowOfPivot[c]]);
    }

    return {
      solution,
      methodLabel: 'Gauss-Jordan elimination',
      parametric: desc.pivotExprs,
      freeNames: desc.freeNames,
      contradiction: desc.contradiction,
      rref: R,
      steps
    };
  },

  /* Cramer's rule solver */
  _solveSystemCramer(A, b, names, phase) {
    const n = A.length;
    const steps = [];
    const det = this.determinant(A);

    steps.push({
      phase,
      title: 'Cramer’s rule: x(i) = det(Aᵢ) ÷ det(A)',
      detail: `For each variable, form Aᵢ by replacing column i of A with the constants b, then divide det(Aᵢ) by det(A) = ${Utils.formatNumber(det)}. Cramer’s rule is only valid for a square system with det(A) ≠ 0 — the rank analysis above already confirmed this.`,
      matrix: Utils.clone(A),
      rhs: b.slice(),
      label: '[A|b]'
    });

    const solution = [];
    for (let i = 0; i < n; i++) {
      const Di = A.map((row, r) => row.map((v, c) => (c === i ? b[r] : v)));
      const di = this.determinant(Di);
      const xi = di / det;
      solution.push(xi);
      steps.push({
        phase,
        title: `Column ${i + 1}: solve for ${this.varName(names, i)}`,
        detail: `Replace column ${i + 1} of A with b to get A${i + 1} (shown below). Its determinant is ${Utils.formatNumber(di)}, so ${this.varName(names, i)} = ${Utils.formatNumber(di)} ÷ ${Utils.formatNumber(det)} = ${Utils.formatNumber(xi)}.`,
        math: `${this.varName(names, i)} = det(A${i + 1}) / det(A) = ${Utils.formatNumber(di)} / ${Utils.formatNumber(det)} = ${Utils.formatNumber(xi)}`,
        matrix: Di,
        label: `A${i + 1}`
      });
    }

    steps.push({
      phase,
      title: 'Collect the values',
      detail: 'Every unknown has been obtained as a ratio of two determinants; together they form the solution vector.',
      math: solution.map((v, i) => `${this.varName(names, i)} = ${Utils.formatNumber(v)}`).join(', ')
    });

    return {
      solution,
      methodLabel: 'Cramer’s rule',
      parametric: solution.map((v, i) => `${this.varName(names, i)} = ${Utils.formatNumber(v)}`),
      freeNames: [],
      contradiction: null,
      rref: null,
      steps
    };
  },

  /* Matrix-inverse solver: x = A⁻¹b */
  _solveSystemInverse(A, b, names, phase) {
    const steps = [];
    const invRes = this.inverseDetailed(A, phase);
    steps.push(...invRes.steps);

    if (!invRes.inverse) {
      return {
        solution: null,
        methodLabel: 'The matrix-inverse method (x = A⁻¹b)',
        parametric: null,
        freeNames: [],
        contradiction: null,
        rref: null,
        steps
      };
    }

    const x = this.multiply(invRes.inverse, b.map(v => [v])).map(row => row[0]);
    steps.push({
      phase,
      title: 'Multiply: x = A⁻¹ b',
      detail: 'Because A·x = b is equivalent to x = A⁻¹·b (once A⁻¹ is known), the solution is a single matrix–vector product: the rows of A⁻¹ are dotted with b.',
      math: x.map((v, i) => `${this.varName(names, i)} = ${Utils.formatNumber(v)}`).join(', '),
      matrices: [{ label: 'A⁻¹', matrix: invRes.inverse }, { label: 'x = A⁻¹b', matrix: x.map(v => [v]) }]
    });

    return {
      solution: x,
      methodLabel: 'The matrix-inverse method (x = A⁻¹b)',
      parametric: x.map((v, i) => `${this.varName(names, i)} = ${Utils.formatNumber(v)}`),
      freeNames: [],
      contradiction: null,
      rref: null,
      steps
    };
  },

  /* LU solver: A = LU, then Ly = b (forward), Ux = y (backward) */
  _solveSystemLU(A, b, names, phase) {
    const steps = [];
    const lu = this.luDecomposition(A, phase);

    if (lu.singular) {
      steps.push(...lu.steps);
      steps.push({
        phase,
        title: 'LU solve abandoned — A has a zero pivot',
        detail: 'Without a valid factorisation the system cannot be solved this way; falling back to Gauss-Jordan elimination.'
      });
      const fallback = this._solveSystemGaussJordan(A, b, names, phase);
      return Object.assign(fallback, { methodLabel: 'LU decomposition (fell back to Gauss-Jordan)' });
    }

    steps.push(...lu.steps);
    steps.push({
      phase,
      title: 'Solve L y = b by forward substitution',
      detail: 'L is lower triangular with unit diagonal, so we can read the solution of L·y = b one unknown at a time from the top row downwards.'
    });
    const fwd = this._forwardSubstitution(lu.L, b, names, phase);
    steps.push(...fwd.steps);

    steps.push({
      phase,
      title: 'Solve U x = y by back substitution',
      detail: 'U is upper triangular, so the last equation gives the last unknown directly; substitute upwards until every unknown is known.'
    });
    const back = this._backSubstitution(lu.U, fwd.y, names, phase);
    steps.push(...back.steps);

    steps.push({
      phase,
      title: 'Solution complete',
      detail: 'The two triangular solves together are equivalent to solving Ax = b, but far cheaper than computing A⁻¹.',
      math: back.x.map((v, i) => `${this.varName(names, i)} = ${Utils.formatNumber(v)}`).join(', ')
    });

    return {
      solution: back.x,
      methodLabel: 'LU decomposition (forward + back substitution)',
      parametric: back.x.map((v, i) => `${this.varName(names, i)} = ${Utils.formatNumber(v)}`),
      freeNames: [],
      contradiction: null,
      rref: null,
      steps
    };
  },

  _forwardSubstitution(L, b, names, phase) {
    const n = L.length;
    const y = new Array(n).fill(0);
    const steps = [];
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let k = 0; k < i; k++) sum += L[i][k] * y[k];
      y[i] = (b[i] - sum) / L[i][i];
      steps.push({
        phase,
        title: `Forward substitution: find y${i + 1}`,
        detail: `y${i + 1} = ( b${i + 1} − Σ l(${i + 1},k)·y(k) ) ÷ l(${i + 1},${i + 1}) = (${Utils.formatNumber(b[i])} − ${Utils.formatNumber(sum)}) ÷ ${Utils.formatNumber(L[i][i])} = ${Utils.formatNumber(y[i])}.`,
        math: `y${i + 1} = ${Utils.formatNumber(y[i])}`
      });
    }
    return { y, steps };
  },

  _backSubstitution(U, y, names, phase) {
    const n = U.length;
    const x = new Array(n).fill(0);
    const steps = [];
    for (let i = n - 1; i >= 0; i--) {
      let sum = 0;
      for (let k = i + 1; k < n; k++) sum += U[i][k] * x[k];
      x[i] = (y[i] - sum) / U[i][i];
      steps.push({
        phase,
        title: `Back substitution: find ${this.varName(names, i)}`,
        detail: `${this.varName(names, i)} = ( y${i + 1} − Σ u(${i + 1},k)·x(k) ) ÷ u(${i + 1},${i + 1}) = (${Utils.formatNumber(y[i])} − ${Utils.formatNumber(sum)}) ÷ ${Utils.formatNumber(U[i][i])} = ${Utils.formatNumber(x[i])}.`,
        math: `${this.varName(names, i)} = ${Utils.formatNumber(x[i])}`
      });
    }
    return { x, steps };
  },

  /* ------------------------------------------
     Full system solver — the heart of the
     "System of Equations" operation
     ------------------------------------------ */

  solveSystem(A, b, method = 'auto', varNames = null) {
    const names = Array.isArray(varNames) && varNames.length === A[0].length
      ? varNames
      : this.defaultVarNames(A[0].length);
    const steps = [];
    const analysis = this.analyzeSystem(A, b);
    const { m, n, rankA, rankAug, status, freeCount } = analysis;
    const isSquare = m === n;
    const det = isSquare ? this.determinant(A) : null;

    /* ---- Phase 1: set-up ---- */
    const setupPhase = '1. Setting up the system';
    steps.push({
      phase: setupPhase,
      title: `The system has ${m} equation(s) and ${n} unknown(s)`,
      detail: 'Standard form puts every variable on the left-hand side and the constant alone on the right, so the columns of the coefficient matrix line up with the unknowns.',
      equations: this.formatEquations(A, b, names)
    });
    steps.push({
      phase: setupPhase,
      title: 'Encode the system as the single matrix equation A x = b',
      detail: `Column j of A holds the coefficients of unknown ${names.join(', ').replace(/, ([^,]*)$/, ' and $1')} taken from every equation, and b holds the right-hand constants. The vector x of unknowns is exactly what we are after, so the entire system compresses to A x = b — from here on the problem is solved with matrix row operations rather than by juggling equations one at a time.`,
      matrices: [
        { label: `A — coefficient matrix (${m}×${n})`, matrix: Utils.clone(A) },
        { label: 'b — constants vector', matrix: b.map(v => [v]) }
      ]
    });
    steps.push({
      phase: setupPhase,
      title: 'Form the augmented matrix [A|b]',
      detail: 'Gluing b onto A as an extra column encodes every equation at once: row i is equation i, the first n columns hold the coefficients and the last column holds the constants. Any legal row operation — interchanging rows, scaling a row by a non-zero number, or adding a multiple of one row to another — acts identically on the matrix and on the equations, so the solution set is preserved while the matrix is reduced.',
      equations: this.formatEquations(A, b, names),
      matrix: Utils.clone(A),
      rhs: b.slice(),
      label: '[A|b]'
    });

    /* ---- Phase 2: consistency & rank analysis ---- */
    const analysisPhase = '2. Consistency & rank analysis';
    steps.push({
      phase: analysisPhase,
      title: `Rank test (Kronecker–Capelli theorem): rank(A) = ${rankA}, rank([A|b]) = ${rankAug}`,
      detail: `The theorem states that a linear system is solvable if and only if the coefficient matrix and the augmented matrix have the same rank. When they do, the solution set has n − rank(A) = ${n} − ${rankA} = ${freeCount} free parameter(s).`
    });

    if (isSquare) {
      steps.push({
        phase: analysisPhase,
        title: `Determinant of A: det(A) = ${Utils.formatNumber(det)}`,
        detail: Math.abs(det) > 1e-12
          ? 'det(A) ≠ 0, so A is invertible and has full rank. By Cramer’s condition the system therefore has exactly one solution — and the inverse and LU methods may also be used.'
          : 'det(A) = 0, so A is singular: its rows carry redundant or conflicting information, so the system has either no solution or infinitely many. Cramer’s rule and the inverse method are off the table; elimination will settle it.',
        matrix: Utils.clone(A),
        label: 'A'
      });
    } else {
      steps.push({
        phase: analysisPhase,
        title: `Rectangular system (${m}×${n}): determinants do not apply`,
        detail: `A is not square, so det(A) does not exist and Cramer’s rule / A⁻¹ cannot be used. Comparing ranks is the correct tool: rank(A) = ${rankA} out of ${n} possible columns.`
      });
    }

    steps.push({
      phase: analysisPhase,
      title: status === 'unique'
        ? `Verdict: consistent with a UNIQUE solution`
        : status === 'infinite'
          ? `Verdict: consistent with INFINITELY MANY solutions (${freeCount} free parameter${freeCount === 1 ? '' : 's'})`
          : 'Verdict: INCONSISTENT — no solution exists',
      detail: status === 'unique'
        ? `rank(A) = rank([A|b]) = ${rankA}, and this equals the number of unknowns, so one single set of values satisfies every equation.`
        : status === 'infinite'
          ? `rank(A) = rank([A|b]) = ${rankA} < ${n} unknowns, so ${freeCount} variable(s) can be chosen freely and the others follow.`
          : `rank([A|b]) = ${rankAug} exceeds rank(A) = ${rankA}, which can only happen when a reduced row reads "0 = (non-zero)" — an outright contradiction.`
    });

    /* ---- Phase 3: compute the solution ---- */
    const solPhase = '3. Computing the solution';
    const needsUnique = ['cramer', 'inverse', 'lu'].includes(method);
    let outcome;

    if (status === 'none') {
      outcome = this._solveSystemGaussJordan(A, b, names, solPhase);
    } else if (needsUnique && status !== 'unique') {
      steps.push({
        phase: solPhase,
        title: `${this._methodName(method)} needs a unique solution — using Gauss-Jordan instead`,
        detail: 'This method only works when det(A) ≠ 0. Since the solution is not unique, Gauss-Jordan elimination is used so that the entire solution set (with its free parameters) can still be described.'
      });
      outcome = this._solveSystemGaussJordan(A, b, names, solPhase);
    } else if (needsUnique && !isSquare) {
      steps.push({
        phase: solPhase,
        title: `${this._methodName(method)} needs a square matrix — using Gauss-Jordan instead`,
        detail: 'The method requires an n×n coefficient matrix, so Gauss-Jordan elimination on the augmented matrix is used instead.'
      });
      outcome = this._solveSystemGaussJordan(A, b, names, solPhase);
    } else {
      switch (method) {
        case 'cramer':
          outcome = this._solveSystemCramer(A, b, names, solPhase);
          break;
        case 'inverse':
          outcome = this._solveSystemInverse(A, b, names, solPhase);
          if (!outcome.solution && outcome.rref === null && !outcome.contradiction) {
            const fb = this._solveSystemGaussJordan(A, b, names, solPhase);
            outcome = fb;
          }
          break;
        case 'lu':
          outcome = this._solveSystemLU(A, b, names, solPhase);
          break;
        default:
          outcome = this._solveSystemGaussJordan(A, b, names, solPhase);
      }
    }
    steps.push(...outcome.steps);

    /* ---- Phase 4: interpret ---- */
    const intPhase = '4. Interpreting the result';
    if (status === 'none') {
      const c = outcome.contradiction;
      steps.push({
        phase: intPhase,
        title: 'Conclusion: the system has no solution',
        detail: c
          ? `Row ${c.row + 1} of the reduced system reads 0 = ${Utils.formatNumber(c.value)}. Zero can never equal ${Utils.formatNumber(c.value)}, so the original equations contradict one another: no assignment of the unknowns can satisfy them all.`
          : 'The reduced system contains a row of the form "0 = (non-zero)", so no solution exists.'
      });
      if (outcome.rref) {
        steps.push({
          phase: intPhase,
          title: 'The contradictory system, written out as equations',
          detail: 'This is the original system after the row operations; compare the last equation with the original ones.',
          equations: this.formatEquations(outcome.rref.matrix, outcome.rref.rhs, names),
          matrix: outcome.rref.matrix,
          rhs: outcome.rref.rhs,
          label: '[A|b]'
        });
      }
    } else if (status === 'unique') {
      steps.push({
        phase: intPhase,
        title: 'Conclusion: unique solution',
        detail: outcome.rref
          ? 'The augmented matrix has been reduced to the identity form [I | x]: the left block is I = A⁻¹A, so the right block reads I·x = A⁻¹b — the solution itself. Every column is a pivot column, so each unknown is pinned down to exactly one value.'
          : 'Every unknown is pinned down to exactly one value — the method above produced a single point solution.',
        equations: outcome.parametric || null
      });
      const verify = this.verifySolution(A, b, outcome.solution, names);
      steps.push({
        phase: '5. Verification',
        title: 'Substitute the solution back into the original equations',
        detail: 'Placing the computed values into the original equations must reproduce the original right-hand sides exactly — the final safety net against arithmetic slips.',
        math: verify.lines.join('\n')
      });
    } else {
      steps.push({
        phase: intPhase,
        title: `Conclusion: infinitely many solutions (${freeCount} free parameter${freeCount === 1 ? '' : 's'})`,
        detail: `Variables belonging to non-pivot columns are free — they may take any value — and every pivot variable is then expressed in terms of them.${outcome.freeNames && outcome.freeNames.length ? ` Here the free variable(s) are: ${outcome.freeNames.join(', ')}.` : ''}`,
        equations: outcome.parametric || null
      });
    }

    return {
      status,
      solution: outcome.solution,
      names,
      methodLabel: outcome.methodLabel,
      parametric: outcome.parametric,
      freeNames: outcome.freeNames || [],
      freeCount,
      contradiction: outcome.contradiction,
      rankA,
      rankAug,
      m,
      n,
      det,
      steps
    };
  },

  /* Eigenvalues via QR Algorithm (basic version) */
  eigenvalues(A) {
    const n = A.length;
    let Ak = Utils.clone(A);
    const maxIter = 1000;
    const steps = [];
    steps.push({ text: 'Starting QR Algorithm for eigenvalues' });

    for (let iter = 0; iter < maxIter; iter++) {
      const { Q, R } = this.qrDecomposition(Ak);
      Ak = this.multiply(R, Q);
      const offDiagonal = Ak.reduce((s, row, i) =>
        s + row.reduce((ss, v, j) => i > j ? ss + v * v : ss, 0), 0);
      if (Math.sqrt(offDiagonal) < 1e-8) {
        steps.push({ text: `Converged after ${iter + 1} iterations` });
        break;
      }
      if (iter % 100 === 0 && iter > 0) {
        steps.push({ text: `Iteration ${iter + 1}: off-diagonal norm = ${Math.sqrt(offDiagonal).toExponential(3)}` });
      }
    }

    const evals = Ak.map((row, i) => {
      if (Math.abs(row[i]) < 1e-12) return 0;
      return Math.round(row[i] * 1e8) / 1e8;
    });

    steps.push({ text: `Eigenvalues: [${evals.join(', ')}]` });
    return { values: evals, steps };
  },

  /* Eigenvectors by solving (A - λI)v = 0 */
  eigenvectors(A, eigenvalues) {
    const n = A.length;
    const vectors = [];
    const steps = [];
    steps.push({ text: 'Computing eigenvectors for each eigenvalue' });

    for (let idx = 0; idx < eigenvalues.length; idx++) {
      const lambda = eigenvalues[idx];
      steps.push({ text: `Finding eigenvector for λ = ${Utils.formatNumber(lambda)}` });
      const M = A.map((row, i) =>
        row.map((val, j) => i === j ? val - lambda : val)
      );
      const { matrix: rrefM } = this.rref(M);
      if (!rrefM) {
        steps.push({ text: `Could not find eigenvector for λ = ${Utils.formatNumber(lambda)}` });
        vectors.push(null);
        continue;
      }
      const freeVar = rrefM[0].length - 1;
      const vec = new Array(n).fill(0);
      let solved = false;
      for (let i = n - 1; i >= 0; i--) {
        let leadingCol = -1;
        for (let j = 0; j < n; j++) {
          if (Math.abs(rrefM[i][j]) > 1e-10) { leadingCol = j; break; }
        }
        if (leadingCol === -1) continue;
        if (leadingCol === freeVar) continue;
        let sum = 0;
        for (let j = leadingCol + 1; j < n; j++) {
          sum -= rrefM[i][j] * (j === freeVar ? 1 : vec[j]);
        }
        if (leadingCol < n) {
          if (Math.abs(rrefM[i][leadingCol]) > 1e-10) {
            vec[leadingCol] = sum / rrefM[i][leadingCol];
          }
          solved = true;
        }
      }
      if (!solved) {
        vec[freeVar] = 1;
        vec[0] = 1;
      }
      const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
      if (norm > 1e-10) {
        for (let i = 0; i < n; i++) vec[i] = Math.round((vec[i] / norm) * 1e8) / 1e8;
      }
      vectors.push(vec);
    }
    return { vectors, steps };
  },

  /* Diagonalization */
  diagonalize(A) {
    const evRes = this.eigenvalues(A);
    const ev = evRes.values;
    const vecRes = this.eigenvectors(A, ev);
    const P = this.transpose(vecRes.vectors);
    if (P.some(row => row === null)) {
      return { P: null, D: null, steps: [...evRes.steps, ...vecRes.steps], error: 'Could not compute all eigenvectors' };
    }
    const D = this.zeros(ev.length, ev.length);
    for (let i = 0; i < ev.length; i++) D[i][i] = ev[i];
    return { P, D, steps: [...evRes.steps, ...vecRes.steps] };
  },

  /* SVD via eigenvalue approach */
  svd(A) {
    const steps = [];
    steps.push({ text: 'Starting SVD computation' });
    const At = this.transpose(A);
    const AtA = this.multiply(At, A);
    const AAt = this.multiply(A, At);

    const evVRes = this.eigenvalues(AtA);
    const sigmaValues = evVRes.values.map(v => v < 0 ? 0 : Math.sqrt(v)).sort((a, b) => b - a);
    const rank = sigmaValues.filter(s => s > 1e-10).length;
    const S = A.map((row, i) =>
      A[0].map((_, j) => i === j && i < sigmaValues.length ? sigmaValues[i] : 0)
    );

    const vecRes = this.eigenvectors(AtA, evVRes.values);
    const V = this.transpose(vecRes.vectors).map(row =>
      row.map(v => Math.abs(v) < 1e-12 ? 0 : Math.round(v * 1e8) / 1e8)
    );

    steps.push({ text: `Computed SVD with ${rank} singular values` });
    steps.push({ text: `Singular values: [${sigmaValues.filter(s => s > 1e-10).map(s => Utils.formatNumber(s)).join(', ')}]` });

    return { U: null, S, V: V.length > 0 ? V : null, steps, rank };
  },

  /* Matrix size info */
  getSize(A) {
    return { rows: A.length, cols: A[0].length };
  },

  /* Generate identity matrix of given size */
  generateIdentity(rows, cols) {
    const n = Math.min(rows, cols);
    return Array.from({ length: rows }, (_, i) =>
      Array.from({ length: cols }, (_, j) => i === j && i < n ? 1 : 0)
    );
  },

  /* Generate zero matrix of given size */
  generateZeros(rows, cols) {
    return this.zeros(rows, cols);
  },

  /* Generate a specific minor matrix display step */
  getMinorSteps(A) {
    const steps = [];
    const n = A.length;
    for (let i = 0; i < Math.min(n, 4); i++) {
      for (let j = 0; j < Math.min(n, 4); j++) {
        const minor = this.minorMatrix(A, i, j);
        const det = this.determinant(minor);
        steps.push({
          text: `M[${i + 1},${j + 1}] — minor determinant = ${Utils.formatNumber(det)}`,
          matrix: minor
        });
      }
    }
    if (n > 4) {
      steps.push({ text: `... showing first 4×4 minors (${n}×${n} matrix has ${n * n} minors)` });
    }
    return steps;
  }
};

/* ============================================
   APPLICATION CONTROLLER
   ============================================ */

class MatrixApp {
  constructor() {
    this.state = {
      operation: null,
      history: JSON.parse(localStorage.getItem('matrixlab_history') || '[]'),
      favorites: JSON.parse(localStorage.getItem('matrixlab_favorites') || '[]'),
      darkMode: localStorage.getItem('matrixlab_dark') === 'true',
      undoStack: [],
      redoStack: []
    };

    this.init();
  }

  init() {
    this.cacheDOM();
    this.bindEvents();
    this.loadTheme();
    this.generateGrid('a');
    this.generateGrid('b');
    this.showToast('Welcome to Kenni Matrix!', 'success');
  }

  cacheDOM() {
    this.dom = {
      // Matrix A
      rowsA: document.getElementById('rows-a'),
      colsA: document.getElementById('cols-a'),
      gridA: document.getElementById('matrix-a-grid'),
      containerA: document.getElementById('matrix-a-container'),
      randomA: document.getElementById('random-a'),
      identityA: document.getElementById('identity-a'),
      zerosA: document.getElementById('zeros-a'),
      fillA: document.getElementById('fill-a'),

      // Matrix B
      rowsB: document.getElementById('rows-b'),
      colsB: document.getElementById('cols-b'),
      gridB: document.getElementById('matrix-b-grid'),
      containerB: document.getElementById('matrix-b-container'),
      randomB: document.getElementById('random-b'),
      identityB: document.getElementById('identity-b'),
      zerosB: document.getElementById('zeros-b'),
      fillB: document.getElementById('fill-b'),

      // Buttons
      btnGenerate: document.getElementById('btn-generate'),
      btnCalculate: document.getElementById('btn-calculate'),
      btnReset: document.getElementById('btn-reset'),
      btnClear: document.getElementById('btn-clear'),
      btnUndo: document.getElementById('btn-undo'),
      btnRedo: document.getElementById('btn-redo'),
      btnDarkMode: document.getElementById('btn-dark-mode'),
      btnHistory: document.getElementById('btn-history'),
      btnFullscreen: document.getElementById('btn-fullscreen'),
      btnToggleSteps: document.getElementById('btn-toggle-steps'),
      toggleStepsLabel: document.getElementById('toggle-steps-label'),
      btnCopy: document.getElementById('btn-copy'),
      btnPrint: document.getElementById('btn-print'),
      btnDownloadTxt: document.getElementById('btn-download-txt'),
      btnDownloadPdf: document.getElementById('btn-download-pdf'),
      btnCloseHistory: document.getElementById('btn-close-history'),
      btnClearHistory: document.getElementById('btn-clear-history'),

      // Operation buttons
      opBtns: document.querySelectorAll('.op-btn'),

      // Power & Scalar inputs
      powerGroup: document.getElementById('power-input-group'),
      powerValue: document.getElementById('power-value'),
      scalarGroup: document.getElementById('scalar-input-group'),
      scalarValue: document.getElementById('scalar-value'),

      // System of equations panel
      systemPanel: document.getElementById('system-panel'),
      systemEquations: document.getElementById('system-equations'),
      systemMethod: document.getElementById('system-method'),
      btnParseEquations: document.getElementById('btn-parse-equations'),
      btnExampleEquations: document.getElementById('btn-example-equations'),

      // Error
      errorArea: document.getElementById('error-area'),
      errorMessage: document.getElementById('error-message'),
      errorClose: document.getElementById('error-close'),

      // Results
      resultsSection: document.getElementById('results-section'),
      resultOperation: document.getElementById('result-operation'),
      resultTime: document.getElementById('result-time'),
      resultMatrix: document.getElementById('result-matrix'),
      inputMatricesDisplay: document.getElementById('input-matrices-display'),
      workingSteps: document.getElementById('working-steps'),
      stepsContent: document.getElementById('steps-content'),
      loadingOverlay: document.getElementById('loading-overlay'),

      // History
      historySidebar: document.getElementById('history-sidebar'),
      historyList: document.getElementById('history-list'),
      historySearch: document.getElementById('history-search'),

      // Toast
      toastContainer: document.getElementById('toast-container'),

      // Theme icons
      iconSun: document.getElementById('icon-sun'),
      iconMoon: document.getElementById('icon-moon')
    };
  }

  bindEvents() {
    // Generate
    this.dom.btnGenerate.addEventListener('click', () => this.handleGenerate());

    // Calculate
    this.dom.btnCalculate.addEventListener('click', () => this.handleCalculate());

    // Reset & Clear
    this.dom.btnReset.addEventListener('click', () => this.handleReset());
    this.dom.btnClear.addEventListener('click', () => this.handleClear());

    // Undo/Redo
    this.dom.btnUndo.addEventListener('click', () => this.handleUndo());
    this.dom.btnRedo.addEventListener('click', () => this.handleRedo());

    // Theme
    this.dom.btnDarkMode.addEventListener('click', () => this.toggleTheme());

    // Fullscreen
    this.dom.btnFullscreen.addEventListener('click', () => this.toggleFullscreen());

    // History
    this.dom.btnHistory.addEventListener('click', () => this.openHistory());
    this.dom.btnCloseHistory.addEventListener('click', () => this.closeHistory());
    this.dom.btnClearHistory.addEventListener('click', () => this.clearHistory());
    this.dom.historySearch.addEventListener('input', () => this.filterHistory());

    // Operation buttons
    this.dom.opBtns.forEach(btn => {
      btn.addEventListener('click', () => this.selectOperation(btn));
    });

    // Power/Scalar visibility based on operation
    this.dom.powerValue.addEventListener('change', () => this.handleCalculate());
    this.dom.scalarValue.addEventListener('change', () => this.handleCalculate());

    // Error close
    this.dom.errorClose.addEventListener('click', () => this.hideError());

    // Steps toggle
    this.dom.btnToggleSteps.addEventListener('click', () => this.toggleSteps());

    // Copy / Print / Download
    this.dom.btnCopy.addEventListener('click', () => this.copyResult());
    this.dom.btnPrint.addEventListener('click', () => window.print());
    this.dom.btnDownloadTxt.addEventListener('click', () => this.downloadTxt());
    this.dom.btnDownloadPdf.addEventListener('click', () => this.downloadPdf());

    // Matrix A action buttons
    this.dom.randomA.addEventListener('click', () => this.fillRandom('a'));
    this.dom.identityA.addEventListener('click', () => this.fillIdentity('a'));
    this.dom.zerosA.addEventListener('click', () => this.fillZeros('a'));
    this.dom.fillA.addEventListener('click', () => this.fillAll('a'));

    // Matrix B action buttons
    this.dom.randomB.addEventListener('click', () => this.fillRandom('b'));
    this.dom.identityB.addEventListener('click', () => this.fillIdentity('b'));
    this.dom.zerosB.addEventListener('click', () => this.fillZeros('b'));
    this.dom.fillB.addEventListener('click', () => this.fillAll('b'));

    // System of equations panel
    this.dom.btnParseEquations.addEventListener('click', () => this.handleParseEquations());
    this.dom.btnExampleEquations.addEventListener('click', () => this.loadExampleEquations());
    this.dom.systemEquations.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.handleCalculate();
      }
    });

    // Dimension change → auto-generate
    [this.dom.rowsA, this.dom.colsA, this.dom.rowsB, this.dom.colsB].forEach(el => {
      el.addEventListener('change', () => this.handleGenerate());
      el.addEventListener('keydown', e => { if (e.key === 'Enter') this.handleGenerate(); });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));

    // Close history on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeHistory();
    });
  }

  /* ==========================================
     MATRIX GENERATION
     ========================================== */

  generateGrid(side) {
    const rows = parseInt(document.getElementById(`rows-${side}`).value) || 2;
    const cols = parseInt(document.getElementById(`cols-${side}`).value) || 2;
    const grid = document.getElementById(`matrix-${side}-grid`);
    const container = document.getElementById(`matrix-${side}-container`);

    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `repeat(${cols}, auto)`;

    for (let i = 0; i < rows * cols; i++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.inputMode = 'decimal';
      input.value = '0';
      input.dataset.index = i;
      input.setAttribute('aria-label', `Matrix ${side.toUpperCase()} cell ${Math.floor(i / cols) + 1},${(i % cols) + 1}`);
      input.addEventListener('focus', () => input.select());
      input.addEventListener('change', () => this.saveUndoState());
      grid.appendChild(input);
    }

    // Auto-size inputs for large matrices
    const isLarge = rows * cols > 100;
    if (isLarge) {
      grid.querySelectorAll('input').forEach(inp => {
        inp.style.width = '44px';
        inp.style.height = '28px';
        inp.style.fontSize = '0.7rem';
      });
    }

    // Scroll to show the grid
    container.scrollTop = 0;
    container.scrollLeft = 0;
  }

  readMatrix(side) {
    const rows = parseInt(document.getElementById(`rows-${side}`).value) || 2;
    const cols = parseInt(document.getElementById(`cols-${side}`).value) || 2;
    const grid = document.getElementById(`matrix-${side}-grid`);
    const inputs = grid.querySelectorAll('input');
    const matrix = [];

    for (let i = 0; i < rows; i++) {
      const row = [];
      for (let j = 0; j < cols; j++) {
        const idx = i * cols + j;
        const val = idx < inputs.length ? inputs[idx].value.trim() : '0';
        const num = val === '' ? 0 : parseFloat(val);
        row.push(isNaN(num) ? 0 : num);
      }
      matrix.push(row);
    }
    return matrix;
  }

  writeMatrix(side, matrix) {
    const grid = document.getElementById(`matrix-${side}-grid`);
    const inputs = grid.querySelectorAll('input');
    for (let i = 0; i < matrix.length; i++) {
      for (let j = 0; j < matrix[i].length; j++) {
        const idx = i * matrix[i].length + j;
        if (idx < inputs.length) {
          inputs[idx].value = Utils.formatNumber(matrix[i][j]);
        }
      }
    }
  }

  /* ==========================================
     OPERATION SELECTION
     ========================================== */

  selectOperation(btn) {
    this.dom.opBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this.state.operation = btn.dataset.op;

    // Show/hide extra inputs
    const op = this.state.operation;
    this.dom.powerGroup.classList.toggle('hidden', op !== 'power');
    this.dom.scalarGroup.classList.toggle('hidden', op !== 'scalar');
    this.dom.systemPanel.classList.toggle('hidden', op !== 'system');
    if (op === 'system') {
      this.dom.systemEquations.focus();
    }

    this.hideError();
  }

  /* ==========================================
     VALIDATION
     ========================================== */

  validateOperation(op, A, B) {
    const rowsA = A.length, colsA = A[0].length;
    const rowsB = B ? B.length : 0, colsB = B ? B[0].length : 0;

    switch (op) {
      case 'add':
      case 'subtract':
        if (rowsA !== rowsB || colsA !== colsB) {
          return 'Matrices must have identical dimensions for ' + (op === 'add' ? 'addition.' : 'subtraction.');
        }
        return null;

      case 'multiply':
        if (colsA !== rowsB) {
          return 'Matrix multiplication requires the number of columns of Matrix A to equal the number of rows of Matrix B.';
        }
        return null;

      case 'determinant':
      case 'inverse':
      case 'adjoint':
      case 'cofactor':
      case 'minor':
      case 'trace':
      case 'power':
      case 'cholesky':
      case 'eigenvalues':
      case 'eigenvectors':
      case 'diagonalize':
        if (rowsA !== colsA) {
          const names = {
            determinant: 'Determinant', inverse: 'Inverse', adjoint: 'Adjoint',
            cofactor: 'Cofactor', minor: 'Minor', trace: 'Trace',
            power: 'Matrix power', cholesky: 'Cholesky decomposition',
            eigenvalues: 'Eigenvalues', eigenvectors: 'Eigenvectors',
            diagonalize: 'Diagonalization'
          };
          return `${names[op] || 'This operation'} is defined only for square matrices.`;
        }
        if ((op === 'inverse' || op === 'cholesky') && Math.abs(MatrixMath.determinant(A)) < 1e-12) {
          return op === 'inverse'
            ? 'This matrix is singular. Its inverse does not exist.'
            : 'This matrix is not positive definite (determinant is zero).';
        }
        if (op === 'cholesky') {
          const chol = MatrixMath.choleskyDecomposition(A);
          if (!chol) return 'Matrix is not symmetric positive definite. Cholesky decomposition requires a symmetric positive definite matrix.';
        }
        return null;

      case 'svd':
        return null;

      case 'gaussian':
      case 'gaussjordan':
      case 'rref':
      case 'lu':
      case 'qr':
      case 'rank':
      case 'norm':
      case 'size':
      case 'type':
      case 'transpose':
      case 'scalar':
        return null;

      case 'solve':
        if (rowsA !== colsA) return 'Solve Ax = b requires a square coefficient matrix.';
        if (!B || rowsB !== rowsA || colsB !== 1) return 'Matrix B must be a column vector with the same number of rows as Matrix A.';
        return null;

      case 'system':
        if (!B || B.length === 0) return 'Matrix B must be a column vector holding the constants of the system.';
        if (B[0].length !== 1) return 'Matrix B must be a single column vector (one constant per equation).';
        if (rowsB !== rowsA) return `Matrix B needs exactly one constant per equation: Matrix A has ${rowsA} row(s), but Matrix B has ${rowsB}.`;
        return null;

      case 'identity':
      case 'zero':
        return null;

      default:
        return 'Unknown operation.';
    }
  }

  /* ==========================================
     CALCULATION ENGINE
     ========================================== */

  handleCalculate() {
    const op = this.state.operation;
    if (!op) {
      this.showError('Please select an operation.');
      return;
    }

    this.hideError();
    this.showLoading();

    const startTime = performance.now();

    setTimeout(() => {
      try {
        let A = this.readMatrix('a');
        let B = this.readMatrix('b');
        let systemVars = null;
        this._lastSystemEquations = null;

        if (op === 'system') {
          const prep = this.prepareSystemInput();
          A = prep.A;
          B = prep.b.map(v => [v]);
          systemVars = prep.names;
          this._lastSystemEquations = prep.equations || null;
        }

        const result = this.executeOperation(op, A, B, systemVars);
        const elapsed = performance.now() - startTime;
        this.hideLoading();
        this.renderResults(result, op, A, B, elapsed);
        this.addToHistory({ op, dimsA: `${A.length}×${A[0].length}`, dimsB: B.length ? `${B.length}×${B[0].length}` : '—', timestamp: new Date().toISOString() });
      } catch (err) {
        this.hideLoading();
        this.showError(err.message || 'An unexpected error occurred.');
        console.error(err);
      }
    }, 50);
  }

  /* ==========================================
     SYSTEM OF EQUATIONS — INPUT HANDLING
     ========================================== */

  /* Reads the equation box (if filled) or falls back to matrices A / B */
  prepareSystemInput() {
    const text = this.dom.systemEquations.value.trim();
    if (!text) {
      const A = this.readMatrix('a');
      const B = this.readMatrix('b');
      return { A, b: B.map(row => row[0]), names: null, equations: null };
    }

    const parsed = Equations.parse(text);
    this.setMatrixSize('a', parsed.A.length, parsed.A[0].length);
    this.writeMatrix('a', parsed.A);
    this.setMatrixSize('b', parsed.b.length, 1);
    this.writeMatrix('b', parsed.b.map(v => [v]));
    this.showToast(`Loaded ${parsed.A.length} equation(s) in ${parsed.vars.length} unknown(s)`, 'success');
    return { A: parsed.A, b: parsed.b, names: parsed.vars, equations: parsed.equations };
  }

  handleParseEquations() {
    try {
      const prep = this.prepareSystemInput();
      if (!prep.equations) {
        this.showToast('Type your equations in the box first', 'warning');
        return;
      }
      this.showToast(`Parsed: ${prep.A.length} equation(s), ${prep.names.length} unknown(s) (${prep.names.join(', ')})`, 'success');
    } catch (err) {
      this.showError(err.message);
    }
  }

  loadExampleEquations() {
    this.dom.systemEquations.value = 'x + y + z = 6\n2x - y + z = 3\nx + 2y - z = 2';
    this.dom.rowsA.value = '3';
    this.dom.colsA.value = '3';
    this.dom.rowsB.value = '3';
    this.dom.colsB.value = '1';
    this.showToast('Example system loaded — press Calculate', 'info');
  }

  setMatrixSize(side, rows, cols) {
    const rowsEl = document.getElementById(`rows-${side}`);
    const colsEl = document.getElementById(`cols-${side}`);
    if (rowsEl.value !== String(rows)) rowsEl.value = String(rows);
    if (colsEl.value !== String(cols)) colsEl.value = String(cols);
    this.generateGrid(side);
  }

  executeOperation(op, A, B, systemVars) {
    const validationError = this.validateOperation(op, A, B);
    if (validationError) {
      throw new Error(validationError);
    }

    let steps = [];

    switch (op) {
      case 'add': {
        steps.push({ phase: '1. Setup', title: `Addition of two ${A.length}×${A[0].length} matrices`, detail: 'Matrix addition is done entry by entry: c(i,j) = a(i,j) + b(i,j). Both matrices must share the same shape, and the sum keeps that shape.', matrix: Utils.clone(A), label: 'A' });
        steps.push({ phase: '1. Setup', title: 'The second matrix B', matrix: Utils.clone(B), label: 'B' });
        const sample = [];
        let s = 0;
        for (let i = 0; i < A.length && s < 3; i++) {
          for (let j = 0; j < A[0].length && s < 3; j++, s++) {
            const sum = A[i][j] + B[i][j];
            sample.push(`c(${i + 1},${j + 1}) = ${Utils.formatNumber(A[i][j])} ${B[i][j] < 0 ? '−' : '+'} ${Utils.formatNumber(Math.abs(B[i][j]))} = ${Utils.formatNumber(sum)}`);
          }
        }
        steps.push({ phase: '2. Computation', title: 'Work out the first few entries', detail: 'The same pattern is applied to every position of the matrix.', math: sample.join('\n') });
        const result = MatrixMath.add(A, B);
        steps.push({ phase: '3. Result', title: 'Sum matrix A + B', matrix: result });
        return { result, type: 'matrix', steps, label: 'A + B', dims: `${A.length}×${A[0].length}` };
      }

      case 'subtract': {
        steps.push({ phase: '1. Setup', title: `Subtraction of two ${A.length}×${A[0].length} matrices`, detail: 'Matrix subtraction is entry by entry: c(i,j) = a(i,j) − b(i,j). Watch the signs carefully when an entry of B is itself negative.', matrix: Utils.clone(A), label: 'A' });
        steps.push({ phase: '1. Setup', title: 'The second matrix B', matrix: Utils.clone(B), label: 'B' });
        const sample = [];
        let s = 0;
        for (let i = 0; i < A.length && s < 3; i++) {
          for (let j = 0; j < A[0].length && s < 3; j++, s++) {
            const diff = A[i][j] - B[i][j];
            sample.push(`c(${i + 1},${j + 1}) = ${Utils.formatNumber(A[i][j])} ${B[i][j] < 0 ? '+' : '−'} ${Utils.formatNumber(Math.abs(B[i][j]))} = ${Utils.formatNumber(diff)}`);
          }
        }
        steps.push({ phase: '2. Computation', title: 'Work out the first few entries', detail: 'The same pattern is applied to every position of the matrix.', math: sample.join('\n') });
        const result = MatrixMath.subtract(A, B);
        steps.push({ phase: '3. Result', title: 'Difference matrix A − B', matrix: result });
        return { result, type: 'matrix', steps, label: 'A − B', dims: `${A.length}×${A[0].length}` };
      }

      case 'multiply': {
        steps.push({ phase: '1. Setup', title: `Multiply a ${A.length}×${A[0].length} matrix by a ${B.length}×${B[0].length} matrix`, detail: `The inner dimensions must match: A has ${A[0].length} column(s) and B has ${B.length} row(s). The product then exists and has size ${A.length}×${B[0].length} (rows of A × columns of B).`, matrix: Utils.clone(A), label: 'A' });
        steps.push({ phase: '1. Setup', title: 'The second matrix B', matrix: Utils.clone(B), label: 'B' });
        const sample = [];
        const maxColsShow = Math.min(3, B[0].length);
        for (let j = 0; j < maxColsShow; j++) {
          const parts = [];
          let val = 0;
          for (let k = 0; k < A[0].length; k++) {
            parts.push(`(${Utils.formatNumber(A[0][k])})(${Utils.formatNumber(B[k][j])})`);
            val += A[0][k] * B[k][j];
          }
          sample.push(`c(1,${j + 1}) = row 1 of A · column ${j + 1} of B = ${parts.join(' + ')} = ${Utils.formatNumber(val)}`);
        }
        if (A[0].length > 0 && B[0].length > 0) {
          steps.push({ phase: '2. Computation', title: 'Row × column dot products (first row shown)', detail: 'Each entry of the product is the dot product of a row of A with a column of B: c(i,j) = Σₖ a(i,k)·b(k,j).', math: sample.join('\n') });
        }
        const result = MatrixMath.multiply(A, B);
        steps.push({ phase: '3. Result', title: `Product matrix (${result.length}×${result[0].length})`, matrix: result });
        return { result, type: 'matrix', steps, label: 'A × B', dims: `${result.length}×${result[0].length}` };
      }

      case 'scalar': {
        const k = parseFloat(this.dom.scalarValue.value) || 1;
        steps.push({ phase: '1. Setup', title: `Scalar multiplication: ${Utils.formatNumber(k)} × A`, detail: 'Every entry of the matrix is multiplied by the same number k: (k·A)(i,j) = k · a(i,j). The size of the matrix does not change.', matrix: Utils.clone(A), label: 'A' });
        const sample = [];
        let s = 0;
        for (let i = 0; i < A.length && s < 3; i++) {
          for (let j = 0; j < A[0].length && s < 3; j++, s++) {
            sample.push(`(${i + 1},${j + 1}): ${Utils.formatNumber(k)} × ${Utils.formatNumber(A[i][j])} = ${Utils.formatNumber(k * A[i][j])}`);
          }
        }
        steps.push({ phase: '2. Computation', title: 'First few entries', math: sample.join('\n') });
        const result = MatrixMath.scalarMultiply(A, k);
        steps.push({ phase: '3. Result', title: `Result (${Utils.formatNumber(k)} × A)`, matrix: result });
        return { result, type: 'matrix', steps, label: `${Utils.formatNumber(k)} × A`, dims: `${result.length}×${result[0].length}` };
      }

      case 'transpose': {
        steps.push({ phase: '1. Setup', title: `Transpose of a ${A.length}×${A[0].length} matrix`, detail: 'The transpose flips the matrix over its main diagonal: row i becomes column i, so b(i,j) = a(j,i). A matrix of size m×n becomes n×m.', matrix: Utils.clone(A), label: 'A' });
        const result = MatrixMath.transpose(A);
        steps.push({ phase: '2. Result', title: `Transposed matrix (${result.length}×${result[0].length})`, detail: `Entry (1,2) of the result is entry (2,1) of A, and so on for every position.`, matrix: result, label: 'Aᵀ' });
        return { result, type: 'matrix', steps, label: 'Aᵀ', dims: `${result.length}×${result[0].length}` };
      }

      case 'rank': {
        steps.push({ phase: '1. Setup', title: `Rank of the ${A.length}×${A[0].length} matrix`, detail: 'The rank is the number of linearly independent rows (equivalently columns). It is found by counting the pivots after row reduction: each pivot marks a row that adds genuinely new information.', matrix: Utils.clone(A), label: 'A' });
        const red = MatrixMath.rowReduce(A, null, { mode: 'forward', phase: '2. Row reduction' });
        steps.push(...red.steps);
        const result = red.rank;
        steps.push({
          phase: '3. Conclusion',
          title: `rank(A) = ${result}`,
          detail: `There are ${result} pivot(s). Compare with the totals: ${A.length} row(s) and ${A[0].length} column(s). If the rank is smaller than both, the rows (and columns) contain redundant information — the matrix is rank-deficient.`
        });
        return { result, type: 'scalar', steps, label: 'Rank', dims: `${A.length}×${A[0].length}` };
      }

      case 'determinant': {
        steps.push({ phase: '1. Setup', title: `Determinant of the ${A.length}×${A.length} matrix`, detail: 'The determinant is a single number that tells us whether the matrix is invertible: det(A) ≠ 0 means invertible (full rank), det(A) = 0 means singular.', matrix: Utils.clone(A), label: 'A' });
        const detRes = MatrixMath.determinantDetailed(A);
        steps.push(...detRes.steps);
        const result = detRes.det;
        steps.push({
          phase: 'Conclusion',
          title: `det(A) = ${Utils.formatNumber(result)}`,
          detail: Math.abs(result) < 1e-12
            ? 'det(A) = 0: the matrix is singular — its rows/columns are linearly dependent, no inverse exists and Ax = b cannot have a unique solution.'
            : 'det(A) ≠ 0: the matrix is invertible, its rows/columns are linearly independent and Ax = b has exactly one solution for every b.'
        });
        return { result, type: 'scalar', steps, label: 'det(A)', dims: `${A.length}×${A.length}` };
      }

      case 'trace': {
        steps.push({ phase: '1. Setup', title: `Trace of the ${A.length}×${A.length} matrix`, detail: 'The trace is the sum of the main-diagonal entries: tr(A) = a(1,1) + a(2,2) + … + a(n,n). It is only defined for square matrices.', matrix: Utils.clone(A), label: 'A' });
        const diag = A.map((row, i) => row[i]);
        const result = MatrixMath.trace(A);
        steps.push({ phase: '2. Computation', title: 'Add the diagonal entries', math: `tr(A) = ${diag.map(v => Utils.formatNumber(v)).join(' + ')} = ${Utils.formatNumber(result)}` });
        return { result, type: 'scalar', steps, label: 'tr(A)', dims: `${A.length}×${A.length}` };
      }

      case 'norm': {
        steps.push({ phase: '1. Setup', title: `Frobenius norm of the ${A.length}×${A[0].length} matrix`, detail: 'The Frobenius norm treats every entry as if the matrix were one long vector: ‖A‖F = √(sum of all squared entries).', matrix: Utils.clone(A), label: 'A' });
        const squares = [];
        let s = 0;
        for (let i = 0; i < A.length && s < 5; i++) {
          for (let j = 0; j < A[0].length && s < 5; j++, s++) {
            squares.push(`${Utils.formatNumber(A[i][j])}²`);
          }
        }
        const result = MatrixMath.frobeniusNorm(A);
        steps.push({ phase: '2. Computation', title: 'Square every entry, add, then take the square root', math: `‖A‖F = √(${squares.join(' + ')}${A.length * A[0].length > 5 ? ' + …' : ''}) = ${Utils.formatNumber(result)}` });
        return { result, type: 'scalar', steps, label: '‖A‖', dims: `${A.length}×${A[0].length}` };
      }

      case 'size': {
        const rows = A.length, cols = A[0].length;
        steps.push({ phase: '1. Result', title: `Matrix dimensions: ${rows} × ${cols}`, detail: `${rows} row(s) and ${cols} column(s). The size decides which operations are legal — e.g. A + B needs identical sizes, A × B needs the columns of A to match the rows of B, and determinants need a square.`, matrix: Utils.clone(A), label: 'A' });
        return { result: `${rows} × ${cols}`, type: 'text', steps, label: 'Size', dims: `${rows}×${cols}` };
      }

      case 'type': {
        steps.push({ phase: '1. Setup', title: 'Detect the special structure of the matrix', detail: 'Each structural property is tested in turn (identity, diagonal, triangular, symmetric, skew-symmetric, positive definite…). Recognising the type explains which shortcuts apply — e.g. triangular matrices have a determinant that is simply the product of the diagonal.', matrix: Utils.clone(A), label: 'A' });
        const type = MatrixMath.detectType(A);
        steps.push({ phase: '2. Result', title: `Matrix type: ${type}` });
        return { result: type, type: 'text', steps, label: 'Type', dims: `${A.length}×${A[0].length}` };
      }

      case 'inverse': {
        const invRes = MatrixMath.inverseDetailed(A);
        steps.push(...invRes.steps);
        if (!invRes.inverse) throw new Error('This matrix is singular (det = 0). Its inverse does not exist.');
        const result = invRes.inverse;
        return { result, type: 'matrix', steps, label: 'A⁻¹', dims: `${result.length}×${result[0].length}` };
      }

      case 'adjoint': {
        steps.push({ phase: '1. Setup', title: `Adjoint (adjugate) of the ${A.length}×${A.length} matrix`, detail: 'The adjoint is the transpose of the cofactor matrix. Together with the determinant it gives the classic formula A⁻¹ = adj(A) ÷ det(A).', matrix: Utils.clone(A), label: 'A' });
        steps.push({ phase: '2. Cofactors', title: 'Build the cofactor matrix C', detail: `Each entry c(i,j) = (−1)^(i+j) · det(M(i,j)), where M(i,j) is the minor obtained by deleting row i and column j. The factor (−1)^(i+j) creates the chessboard sign pattern + − + − …`, matrix: MatrixMath.cofactorMatrix(A), label: 'C' });
        const result = MatrixMath.adjoint(A);
        steps.push({ phase: '3. Result', title: 'Transpose the cofactor matrix', detail: 'adj(A) = Cᵀ — the cofactor that belonged to position (i,j) moves to position (j,i).', matrix: result, label: 'adj(A)' });
        return { result, type: 'matrix', steps, label: 'adj(A)', dims: `${result.length}×${result[0].length}` };
      }

      case 'cofactor': {
        steps.push({ phase: '1. Setup', title: `Cofactor matrix of the ${A.length}×${A.length} matrix`, detail: 'The cofactor matrix has one entry per position: c(i,j) = (−1)^(i+j) · det(M(i,j)), where M(i,j) is the matrix left after deleting row i and column j.', matrix: Utils.clone(A), label: 'A' });
        const result = MatrixMath.cofactorMatrix(A);
        steps.push({ phase: '2. Result', title: 'Cofactor matrix', detail: 'Note the alternating sign pattern of the cofactors: + − + … on the first row, then − + − … on the second, and so on.', matrix: result, label: 'C' });
        return { result, type: 'matrix', steps, label: 'Cofactor', dims: `${result.length}×${result[0].length}` };
      }

      case 'minor': {
        steps.push({ phase: '1. Setup', title: `Minor determinants of the ${A.length}×${A.length} matrix`, detail: 'The minor M(i,j) is the determinant of the matrix that remains after deleting row i and column j. The list below shows the value of each minor.', matrix: Utils.clone(A), label: 'A' });
        steps.push({ phase: '2. Minors', title: 'Minor determinants (first 4×4 shown)' });
        const minorSteps = MatrixMath.getMinorSteps(A);
        steps.push(...minorSteps);
        return { result: 'See steps for minor determinants', type: 'text', steps, label: 'Minors', dims: `${A.length}×${A.length}` };
      }

      case 'power': {
        const power = parseInt(this.dom.powerValue.value) || 2;
        steps.push({ phase: '1. Setup', title: `Matrix power A^${power}`, detail: power === 0
          ? 'Any square matrix to the power 0 is defined to be the identity matrix I — it is the "do nothing" product.'
          : `A^${power} means A multiplied by itself ${power} times: ${Array.from({ length: Math.min(power, 4) }, () => 'A').join(' × ')}${power > 4 ? ' …' : ''}. Only square matrices can be raised to a power, and matrix multiplication is not commutative, so the order matters.`, matrix: Utils.clone(A), label: 'A' });
        if (power === 0) {
          const result = MatrixMath.matrixPower(A, 0);
          steps.push({ phase: '2. Result', title: 'A⁰ = I (identity matrix)', matrix: result });
          return { result, type: 'matrix', steps, label: 'A^0', dims: `${result.length}×${result[0].length}` };
        }
        let acc = Utils.clone(A);
        for (let k = 2; k <= power; k++) {
          const next = MatrixMath.multiply(acc, A);
          steps.push({
            phase: '2. Computation',
            title: `Multiply the running product by A (step ${k} of ${power})`,
            detail: `Current power: A^${k - 1}; multiplying on the right by A gives A^${k}.`,
            matrix: next,
            label: `A^${k}`
          });
          acc = next;
        }
        const result = acc;
        steps.push({ phase: '3. Result', title: `A^${power}`, matrix: result, label: `A^${power}` });
        return { result, type: 'matrix', steps, label: `A^${power}`, dims: `${result.length}×${result[0].length}` };
      }

      case 'gaussian': {
        const gj = MatrixMath.gaussianElimination(A);
        steps.push(...gj.steps);
        return { result: gj.matrix, type: 'matrix', steps, label: 'Upper Triangular', dims: gj.matrix ? `${gj.matrix.length}×${gj.matrix[0].length}` : '—', error: gj.singular };
      }

      case 'gaussjordan': {
        const gj = MatrixMath.gaussJordan(A);
        steps.push(...gj.steps);
        return { result: gj.matrix, type: 'matrix', steps, label: 'RREF', dims: gj.matrix ? `${gj.matrix.length}×${gj.matrix[0].length}` : '—', error: gj.singular };
      }

      case 'rref': {
        const rr = MatrixMath.rref(A);
        steps.push(...rr.steps);
        return { result: rr.matrix, type: 'matrix', steps, label: 'RREF', dims: rr.matrix ? `${rr.matrix.length}×${rr.matrix[0].length}` : '—' };
      }

      case 'lu': {
        const lu = MatrixMath.luDecomposition(A);
        steps.push(...lu.steps);
        if (lu.L && lu.U) {
          const check = MatrixMath.multiply(lu.L, lu.U);
          steps.push({ phase: 'Verification', title: 'Check: L × U should return A', detail: 'Multiplying the two factors must reproduce the original matrix.', matrices: [{ label: 'L × U', matrix: check }, { label: 'A', matrix: Utils.clone(A) }] });
        }
        return { result: { L: lu.L, U: lu.U }, type: 'lu', steps, label: 'LU Decomposition', dims: `${A.length}×${A.length}`, error: lu.singular, message: lu.singular ? 'LU failed: a zero pivot was reached, so A needs row exchanges (pivoting) before it can be factorised.' : null };
      }

      case 'qr': {
        const qr = MatrixMath.qrDecomposition(A);
        steps.push(...qr.steps);
        const check = MatrixMath.multiply(qr.Q, qr.R);
        steps.push({ phase: 'Verification', title: 'Check: Q × R should return A', detail: 'Multiplying the orthogonal factor by the triangular factor must reproduce the original matrix.', matrices: [{ label: 'Q × R', matrix: check }, { label: 'A', matrix: Utils.clone(A) }] });
        return { result: { Q: qr.Q, R: qr.R }, type: 'qr', steps, label: 'QR Decomposition', dims: `${A.length}×${A[0].length}` };
      }

      case 'cholesky': {
        steps.push({ phase: '1. Setup', title: `Cholesky decomposition of the ${A.length}×${A.length} matrix`, detail: 'A symmetric positive definite matrix can be factored as A = L × Lᵀ with L lower triangular. It exists only if A is symmetric (a(i,j) = a(j,i)) and every leading principal minor is positive.', matrix: Utils.clone(A), label: 'A' });
        const L = MatrixMath.choleskyDecomposition(A);
        if (!L) throw new Error('Matrix is not symmetric positive definite. Cholesky decomposition requires a symmetric positive definite matrix.');
        const Lt = MatrixMath.transpose(L);
        steps.push({ phase: '2. Result', title: 'Lower triangular factor L (and its transpose Lᵀ)', detail: 'The diagonal entries of L are the square roots of the adjusted diagonal of A; each below-diagonal entry divides by the pivot above it.', matrices: [{ label: 'L', matrix: L }, { label: 'Lᵀ', matrix: Lt }] });
        const verify = MatrixMath.multiply(L, Lt);
        steps.push({ phase: 'Verification', title: 'Check: L × Lᵀ should equal A', detail: 'Re-multiplying the factors must give back the original symmetric matrix.', matrix: verify, label: 'L × Lᵀ' });
        return { result: { L, Lt }, type: 'cholesky', steps, label: 'Cholesky', dims: `${A.length}×${A.length}` };
      }

      case 'solve':
      case 'system': {
        const b = B.map(row => row[0]);
        const method = op === 'system' ? (this.dom.systemMethod.value || 'auto') : 'auto';
        const sol = MatrixMath.solveSystem(A, b, method, systemVars || null);
        steps.push(...sol.steps);
        return {
          result: sol,
          type: 'system',
          steps,
          label: 'System Ax = b',
          dims: `${A.length}×${A[0].length}`
        };
      }

      case 'eigenvalues': {
        const ev = MatrixMath.eigenvalues(A);
        steps.push(...ev.steps);
        return { result: ev.values, type: 'vector', steps, label: 'Eigenvalues', dims: `${A.length}×1` };
      }

      case 'eigenvectors': {
        const evRes = MatrixMath.eigenvalues(A);
        const vecRes = MatrixMath.eigenvectors(A, evRes.values);
        steps.push(...evRes.steps, ...vecRes.steps);
        const P = MatrixMath.transpose(vecRes.vectors);
        if (P.some(r => r === null)) {
          return { result: vecRes.vectors, type: 'eigenvectors_text', steps, label: 'Eigenvectors', dims: `${A.length}×${A.length}` };
        }
        return { result: P, type: 'matrix', steps, label: 'Eigenvectors (as columns)', dims: `${P.length}×${P[0].length}` };
      }

      case 'diagonalize': {
        const diag = MatrixMath.diagonalize(A);
        steps.push(...diag.steps);
        if (diag.error) {
          return { result: null, type: 'text', steps, label: 'Diagonalization', error: true, message: diag.error };
        }
        steps.push({ text: 'P (eigenvectors):', matrix: diag.P });
        steps.push({ text: 'D (eigenvalues):', matrix: diag.D });
        return { result: { P: diag.P, D: diag.D }, type: 'diagonalize', steps, label: 'Diagonalization', dims: `${A.length}×${A.length}` };
      }

      case 'identity': {
        const rows = parseInt(this.dom.rowsA.value) || 2;
        const cols = parseInt(this.dom.colsA.value) || 2;
        const result = MatrixMath.generateIdentity(rows, cols);
        steps.push({ text: `Generated ${rows}×${cols} identity matrix` });
        steps.push({ matrix: result });
        return { result, type: 'matrix', steps, label: 'I', dims: `${rows}×${cols}` };
      }

      case 'zero': {
        const rows = parseInt(this.dom.rowsA.value) || 2;
        const cols = parseInt(this.dom.colsA.value) || 2;
        const result = MatrixMath.generateZeros(rows, cols);
        steps.push({ text: `Generated ${rows}×${cols} zero matrix` });
        steps.push({ matrix: result });
        return { result, type: 'matrix', steps, label: '0', dims: `${rows}×${cols}` };
      }

      default:
        throw new Error('Unknown operation: ' + op);
    }
  }

  /* ==========================================
     RESULTS RENDERING
     ========================================== */

  renderResults(result, op, A, B, elapsed) {
    const section = this.dom.resultsSection;
    section.classList.remove('hidden');

    // Operation badge
    this.dom.resultOperation.textContent = this.getOperationLabel(op);

    // Time
    this.dom.resultTime.textContent = Utils.formatTime(elapsed);

    // Input matrices
    this.renderInputMatrices(A, B, op);

    // Result
    this.renderResultMatrix(result);

    // Steps
    if (result.steps && result.steps.length > 0) {
      this.renderSteps(result.steps);
      this.dom.workingSteps.classList.remove('hidden');
      if (this.dom.toggleStepsLabel) this.dom.toggleStepsLabel.textContent = 'Hide Working Steps';
      this.dom.btnToggleSteps.closest('.steps-toggle')?.classList.add('open');
    } else {
      this.dom.workingSteps.classList.add('hidden');
      if (this.dom.toggleStepsLabel) this.dom.toggleStepsLabel.textContent = 'Show Working Steps';
      this.dom.btnToggleSteps.closest('.steps-toggle')?.classList.remove('open');
    }

    // Scroll to results
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Save for copy
    this._lastResult = result;
  }

  getOperationLabel(op) {
    const labels = {
      add: 'Addition (+)', subtract: 'Subtraction (−)', multiply: 'Multiplication (×)',
      scalar: 'Scalar Multiply', transpose: 'Transpose', rank: 'Rank',
      determinant: 'Determinant', trace: 'Trace', norm: 'Norm', size: 'Size',
      type: 'Type Detection', inverse: 'Inverse', adjoint: 'Adjoint',
      cofactor: 'Cofactor', minor: 'Minor', power: 'Power',
      gaussian: 'Gaussian Elimination', gaussjordan: 'Gauss-Jordan Elimination',
      rref: 'RREF', lu: 'LU Decomposition', qr: 'QR Decomposition',
      cholesky: 'Cholesky Decomposition', solve: 'Solve Ax = b',
      system: 'System of Linear Equations',
      eigenvalues: 'Eigenvalues', eigenvectors: 'Eigenvectors',
      diagonalize: 'Diagonalization', identity: 'Identity Matrix',
      zero: 'Zero Matrix'
    };
    return labels[op] || op;
  }

  renderInputMatrices(A, B, op) {
    const container = this.dom.inputMatricesDisplay;
    container.innerHTML = '';
    const opsNeedingBoth = ['add', 'subtract', 'multiply'];
    const opsNeedingB = [...opsNeedingBoth, 'solve', 'system'];
    const opsNeedingAOnly = ['scalar', 'transpose', 'rank', 'determinant', 'trace', 'norm',
      'size', 'type', 'inverse', 'adjoint', 'cofactor', 'minor', 'power',
      'gaussian', 'gaussjordan', 'rref', 'lu', 'qr', 'cholesky',
      'eigenvalues', 'eigenvectors', 'diagonalize'];

    if (opsNeedingAOnly.includes(op) || opsNeedingBoth.includes(op)) {
      container.appendChild(this.createMatrixDisplay(A, 'A'));
    }
    if (opsNeedingB.includes(op)) {
      container.appendChild(this.createMatrixDisplay(B, 'B'));
    }
  }

  createMatrixDisplay(matrix, label) {
    const wrapper = document.createElement('div');
    wrapper.className = 'matrix-display';
    wrapper.innerHTML = `<div class="matrix-label">Matrix ${label} (${matrix.length}×${matrix[0].length})</div>`;
    wrapper.appendChild(this.matrixToTable(matrix));
    return wrapper;
  }

  matrixToTable(matrix, fmt) {
    const format = fmt || (v => Utils.formatNumber(v));
    const table = document.createElement('table');
    table.className = 'matrix-table';
    for (const row of matrix) {
      const tr = document.createElement('tr');
      for (const val of row) {
        const td = document.createElement('td');
        td.textContent = format(val);
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    return table;
  }

  renderResultMatrix(result) {
    const container = this.dom.resultMatrix;
    container.innerHTML = '';

    if (result.type === 'matrix') {
      container.appendChild(this.matrixToTable(result.result));
    } else if (result.type === 'lu') {
      const flex = document.createElement('div');
      flex.style.display = 'flex';
      flex.style.flexWrap = 'wrap';
      flex.style.gap = '30px';
      flex.style.justifyContent = 'center';
      if (result.result.L) {
        const dL = document.createElement('div');
        dL.innerHTML = '<strong style="font-size:0.8rem;color:var(--accent)">L</strong>';
        dL.appendChild(this.matrixToTable(result.result.L));
        flex.appendChild(dL);
      }
      if (result.result.U) {
        const dU = document.createElement('div');
        dU.innerHTML = '<strong style="font-size:0.8rem;color:var(--accent)">U</strong>';
        dU.appendChild(this.matrixToTable(result.result.U));
        flex.appendChild(dU);
      }
      container.appendChild(flex);
    } else if (result.type === 'qr') {
      const flex = document.createElement('div');
      flex.style.display = 'flex';
      flex.style.flexWrap = 'wrap';
      flex.style.gap = '30px';
      flex.style.justifyContent = 'center';
      if (result.result.Q) {
        const dQ = document.createElement('div');
        dQ.innerHTML = '<strong style="font-size:0.8rem;color:var(--accent)">Q</strong>';
        dQ.appendChild(this.matrixToTable(result.result.Q));
        flex.appendChild(dQ);
      }
      if (result.result.R) {
        const dR = document.createElement('div');
        dR.innerHTML = '<strong style="font-size:0.8rem;color:var(--accent)">R</strong>';
        dR.appendChild(this.matrixToTable(result.result.R));
        flex.appendChild(dR);
      }
      container.appendChild(flex);
    } else if (result.type === 'cholesky') {
      const flex = document.createElement('div');
      flex.style.display = 'flex';
      flex.style.flexWrap = 'wrap';
      flex.style.gap = '30px';
      flex.style.justifyContent = 'center';
      if (result.result.L) {
        const dL = document.createElement('div');
        dL.innerHTML = '<strong style="font-size:0.8rem;color:var(--accent)">L</strong>';
        dL.appendChild(this.matrixToTable(result.result.L));
        flex.appendChild(dL);
      }
      if (result.result.Lt) {
        const dLt = document.createElement('div');
        dLt.innerHTML = '<strong style="font-size:0.8rem;color:var(--accent)">Lᵀ</strong>';
        dLt.appendChild(this.matrixToTable(result.result.Lt));
        flex.appendChild(dLt);
      }
      container.appendChild(flex);
    } else if (result.type === 'diagonalize') {
      const flex = document.createElement('div');
      flex.style.display = 'flex';
      flex.style.flexWrap = 'wrap';
      flex.style.gap = '30px';
      flex.style.justifyContent = 'center';
      if (result.result.P) {
        const dP = document.createElement('div');
        dP.innerHTML = '<strong style="font-size:0.8rem;color:var(--accent)">P</strong>';
        dP.appendChild(this.matrixToTable(result.result.P));
        flex.appendChild(dP);
      }
      if (result.result.D) {
        const dD = document.createElement('div');
        dD.innerHTML = '<strong style="font-size:0.8rem;color:var(--accent)">D</strong>';
        dD.appendChild(this.matrixToTable(result.result.D));
        flex.appendChild(dD);
      }
      container.appendChild(flex);
    } else if (result.type === 'system') {
      container.appendChild(this.renderSystemResult(result.result));
    } else if (result.type === 'vector') {
      const vec = result.result;
      if (Array.isArray(vec)) {
        const table = document.createElement('table');
        table.className = 'matrix-table';
        for (const v of vec) {
          const tr = document.createElement('tr');
          const td = document.createElement('td');
          td.textContent = Utils.formatNumber(v);
          tr.appendChild(td);
          table.appendChild(tr);
        }
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.justifyContent = 'center';
        wrapper.appendChild(table);
        container.appendChild(wrapper);
      } else {
        container.innerHTML = `<div class="result-scalar">${Utils.formatNumber(vec)}</div>`;
      }
    } else if (result.type === 'scalar') {
      container.innerHTML = `<div class="result-scalar">${Utils.formatNumber(result.result)}</div>`;
    } else if (result.type === 'text') {
      const p = document.createElement('div');
      p.className = 'result-text';
      p.innerHTML = result.error && result.message
        ? `<strong>Error:</strong> ${result.message}`
        : `<strong>${result.label}:</strong> ${result.result}`;
      container.appendChild(p);
    } else if (result.type === 'eigenvectors_text') {
      const vecs = result.result;
      const flex = document.createElement('div');
      flex.style.display = 'flex';
      flex.style.flexWrap = 'wrap';
      flex.style.gap = '20px';
      flex.style.justifyContent = 'center';
      vecs.forEach((vec, idx) => {
        if (!vec) return;
        const d = document.createElement('div');
        d.innerHTML = `<strong style="font-size:0.75rem;color:var(--accent)">v${idx + 1}</strong>`;
        const table = document.createElement('table');
        table.className = 'matrix-table';
        for (const v of vec) {
          const tr = document.createElement('tr');
          const td = document.createElement('td');
          td.textContent = Utils.formatNumber(v);
          tr.appendChild(td);
          table.appendChild(tr);
        }
        d.appendChild(table);
        flex.appendChild(d);
      });
      container.appendChild(flex);
    }

    if (result.error) {
      const err = document.createElement('div');
      err.className = 'result-text';
      err.style.marginTop = '12px';
      err.style.color = 'var(--danger)';
      err.innerHTML = result.message || 'Matrix may be singular.';
      container.appendChild(err);
    }
  }

  /* Status badge + solution set for the "System of Equations" operation */
  renderSystemResult(s) {
    const wrap = document.createElement('div');
    wrap.className = 'system-result';

    const badge = document.createElement('div');
    if (s.status === 'unique') {
      badge.className = 'system-status status-unique';
      badge.textContent = '✓ Consistent — unique solution';
    } else if (s.status === 'infinite') {
      badge.className = 'system-status status-infinite';
      badge.textContent = `∞ Consistent — infinitely many solutions (${s.freeCount} free parameter${s.freeCount === 1 ? '' : 's'})`;
    } else {
      badge.className = 'system-status status-none';
      badge.textContent = '✗ Inconsistent — no solution';
    }
    wrap.appendChild(badge);

    const meta = document.createElement('div');
    meta.className = 'system-meta';
    let metaText = `${s.m} equation${s.m === 1 ? '' : 's'}, ${s.n} unknown${s.n === 1 ? '' : 's'} · rank(A) = ${s.rankA} · rank([A|b]) = ${s.rankAug}`;
    if (s.det !== null && s.det !== undefined) metaText += ` · det(A) = ${Utils.formatNumber(s.det)}`;
    metaText += ` · solved with ${s.methodLabel}`;
    meta.textContent = metaText;
    wrap.appendChild(meta);

    if (s.status === 'unique' && s.solution) {
      const list = document.createElement('div');
      list.className = 'solution-list';
      s.solution.forEach((v, i) => {
        const row = document.createElement('div');
        row.className = 'solution-row';
        row.innerHTML = `<span class="solution-var">${s.names[i]}</span><span class="solution-eq">=</span><span class="solution-val">${Utils.formatNumber(v)}</span>`;
        list.appendChild(row);
      });
      wrap.appendChild(list);
    } else if (s.status === 'infinite' && s.parametric && s.parametric.length) {
      const note = document.createElement('div');
      note.className = 'system-note';
      note.textContent = `Choose any values for the free variable${s.freeNames.length === 1 ? '' : 's'} (${s.freeNames.join(', ')}) — the remaining unknowns then follow:`;
      wrap.appendChild(note);
      const list = document.createElement('div');
      list.className = 'solution-list';
      s.parametric.forEach(expr => {
        const row = document.createElement('div');
        row.className = 'solution-row solution-row-expr';
        row.textContent = expr;
        list.appendChild(row);
      });
      wrap.appendChild(list);
    } else if (s.status === 'none') {
      const note = document.createElement('div');
      note.className = 'system-note system-note-danger';
      note.textContent = s.contradiction
        ? `Row ${s.contradiction.row + 1} of the reduced system reads  0 = ${Utils.formatNumber(s.contradiction.value)}, which is impossible — the equations contradict each other.`
        : 'The reduced system contains a contradiction, so no set of values can satisfy every equation.';
      wrap.appendChild(note);
    }

    return wrap;
  }

  renderSteps(steps) {
    const container = this.dom.stepsContent;
    container.innerHTML = '';

    let lastPhase = null;
    let stepNumber = 0;

    for (const step of steps) {
      // Phase divider (e.g. "1. Setting up the system")
      if (step.phase && step.phase !== lastPhase) {
        lastPhase = step.phase;
        const phase = document.createElement('div');
        phase.className = 'step-phase';
        phase.textContent = step.phase;
        container.appendChild(phase);
      }

      const isRich = Boolean(step.title || step.detail || step.math);
      if (isRich) stepNumber++;

      const item = document.createElement('div');
      item.className = 'step-item' + (isRich ? ' step-item-rich' : '');

      if (isRich) {
        const head = document.createElement('div');
        head.className = 'step-head';

        const num = document.createElement('span');
        num.className = 'step-num';
        num.textContent = String(stepNumber);
        head.appendChild(num);

        const title = document.createElement('span');
        title.className = 'step-title';
        title.textContent = step.title || '';
        head.appendChild(title);
        item.appendChild(head);

        if (step.detail) {
          const detail = document.createElement('div');
          detail.className = 'step-detail';
          detail.textContent = step.detail;
          item.appendChild(detail);
        }

        if (step.math) {
          const math = document.createElement('div');
          math.className = 'step-math';
          math.textContent = step.math;
          item.appendChild(math);
        }
      } else if (step.text) {
        const text = document.createElement('div');
        text.className = 'step-label';
        text.textContent = step.text;
        item.appendChild(text);
      }

      // The system written out as equations
      if (step.equations && step.equations.length) {
        const eqWrap = document.createElement('div');
        eqWrap.className = 'step-equations';
        step.equations.forEach(eq => {
          const line = document.createElement('div');
          line.className = 'step-equation';
          line.textContent = eq;
          eqWrap.appendChild(line);
        });
        item.appendChild(eqWrap);
      }

      // Single matrix (with optional right-hand side column)
      if (step.matrix) {
        const matrixDiv = document.createElement('div');
        matrixDiv.className = 'step-matrix';
        if (step.label) {
          const label = document.createElement('div');
          label.className = 'step-matrix-label';
          label.textContent = String(step.label).startsWith('[') ? step.label : `Matrix ${step.label}`;
          matrixDiv.appendChild(label);
        }
        const exactFmt = v => Utils.formatFraction(v);
        matrixDiv.appendChild(step.rhs ? this.augmentedToTable(step.matrix, step.rhs, exactFmt) : this.matrixToTable(step.matrix, exactFmt));
        item.appendChild(matrixDiv);
      }

      // Several matrices side by side (e.g. L and U)
      if (step.matrices && step.matrices.length) {
        const row = document.createElement('div');
        row.className = 'step-matrices';
        for (const entry of step.matrices) {
          if (!entry || !entry.matrix) continue;
          const box = document.createElement('div');
          box.className = 'step-matrix';
          if (entry.label) {
            const label = document.createElement('div');
            label.className = 'step-matrix-label';
            label.textContent = entry.label;
            box.appendChild(label);
          }
          box.appendChild(this.matrixToTable(entry.matrix, v => Utils.formatFraction(v)));
          row.appendChild(box);
        }
        item.appendChild(row);
      }

      container.appendChild(item);
    }
  }

  /* Augmented matrix [A|b] rendered as one table with a divider before the constants column */
  augmentedToTable(matrix, rhs, fmt) {
    const format = fmt || (v => Utils.formatNumber(v));
    const table = document.createElement('table');
    table.className = 'matrix-table augmented-table';
    matrix.forEach((row, i) => {
      const tr = document.createElement('tr');
      for (const val of row) {
        const td = document.createElement('td');
        td.textContent = format(val);
        tr.appendChild(td);
      }
      const gutter = document.createElement('td');
      gutter.className = 'aug-gutter';
      gutter.textContent = '';
      tr.appendChild(gutter);
      const tdRhs = document.createElement('td');
      tdRhs.className = 'aug-rhs';
      tdRhs.textContent = rhs && rhs[i] !== undefined ? format(rhs[i]) : '';
      tr.appendChild(tdRhs);
      table.appendChild(tr);
    });
    return table;
  }

  /* ==========================================
     ERROR & TOAST
     ========================================== */

  showError(message) {
    this.dom.errorMessage.textContent = message;
    this.dom.errorArea.classList.remove('hidden');
    this.dom.errorArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  hideError() {
    this.dom.errorArea.classList.add('hidden');
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    this.dom.toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  showLoading() {
    this.dom.loadingOverlay.classList.remove('hidden');
  }

  hideLoading() {
    this.dom.loadingOverlay.classList.add('hidden');
  }

  /* ==========================================
     THEME
     ========================================== */

  loadTheme() {
    if (this.state.darkMode) {
      document.body.classList.add('dark');
      this.dom.iconSun?.classList.add('hidden');
      this.dom.iconMoon?.classList.remove('hidden');
    }
  }

  toggleTheme() {
    this.state.darkMode = !this.state.darkMode;
    document.body.classList.toggle('dark', this.state.darkMode);
    localStorage.setItem('matrixlab_dark', this.state.darkMode);
    this.dom.iconSun?.classList.toggle('hidden', this.state.darkMode);
    this.dom.iconMoon?.classList.toggle('hidden', !this.state.darkMode);
    this.showToast(this.state.darkMode ? 'Dark mode activated' : 'Light mode activated', 'info');
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  /* ==========================================
     UNDO / REDO
     ========================================== */

  saveUndoState() {
    const aVals = this.getMatrixValues('a');
    const bVals = this.getMatrixValues('b');
    this.state.undoStack.push({ a: aVals, b: bVals });
    if (this.state.undoStack.length > 50) this.state.undoStack.shift();
    this.state.redoStack = [];
  }

  getMatrixValues(side) {
    const grid = document.getElementById(`matrix-${side}-grid`);
    return Array.from(grid.querySelectorAll('input')).map(inp => inp.value);
  }

  setMatrixValues(side, values) {
    const grid = document.getElementById(`matrix-${side}-grid`);
    const inputs = grid.querySelectorAll('input');
    inputs.forEach((inp, i) => {
      if (i < values.length) inp.value = values[i];
    });
  }

  handleUndo() {
    if (this.state.undoStack.length === 0) {
      this.showToast('Nothing to undo', 'warning');
      return;
    }
    const curA = this.getMatrixValues('a');
    const curB = this.getMatrixValues('b');
    this.state.redoStack.push({ a: curA, b: curB });

    const prev = this.state.undoStack.pop();
    this.setMatrixValues('a', prev.a);
    this.setMatrixValues('b', prev.b);
    this.showToast('Undone', 'info');
  }

  handleRedo() {
    if (this.state.redoStack.length === 0) {
      this.showToast('Nothing to redo', 'warning');
      return;
    }
    const curA = this.getMatrixValues('a');
    const curB = this.getMatrixValues('b');
    this.state.undoStack.push({ a: curA, b: curB });

    const next = this.state.redoStack.pop();
    this.setMatrixValues('a', next.a);
    this.setMatrixValues('b', next.b);
    this.showToast('Redone', 'info');
  }

  /* ==========================================
     HISTORY
     ========================================== */

  addToHistory(entry) {
    this.state.history.unshift(entry);
    if (this.state.history.length > 100) this.state.history.pop();
    localStorage.setItem('matrixlab_history', JSON.stringify(this.state.history));
    this.renderHistory();
  }

  renderHistory() {
    const list = this.dom.historyList;
    const search = this.dom.historySearch.value.toLowerCase();
    const filtered = this.state.history.filter(h =>
      h.op.toLowerCase().includes(search) ||
      h.dimsA.includes(search) ||
      h.dimsB.includes(search)
    );

    list.innerHTML = '';

    if (filtered.length === 0) {
      list.innerHTML = '<p class="history-empty">No calculations yet.</p>';
      return;
    }

    filtered.forEach((h, idx) => {
      const item = document.createElement('div');
      item.className = 'history-item';
      const realIdx = this.state.history.indexOf(h);
      const isFav = this.state.favorites.includes(realIdx);
      const time = new Date(h.timestamp).toLocaleTimeString();

      item.innerHTML = `
        <div class="history-item-header">
          <span class="history-item-op">${this.getOperationLabel(h.op)}</span>
          <span class="history-item-time">${time}</span>
        </div>
        <div class="history-item-info">A: ${h.dimsA} | B: ${h.dimsB}</div>
        <div class="history-item-actions">
          <button class="history-fav-btn ${isFav ? 'active' : ''}" data-idx="${realIdx}">${isFav ? '★' : '☆'}</button>
        </div>
      `;

      item.querySelector('.history-fav-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFavorite(realIdx);
      });

      item.addEventListener('click', () => {
        // Restore dimensions from history entry
        if (h.dimsA) {
          const parts = h.dimsA.split('×');
          if (parts.length === 2) {
            // Just show info toast for now
          }
        }
        this.showToast(`Restored: ${this.getOperationLabel(h.op)}`, 'info');
      });

      list.appendChild(item);
    });
  }

  toggleFavorite(idx) {
    const pos = this.state.favorites.indexOf(idx);
    if (pos === -1) {
      this.state.favorites.push(idx);
    } else {
      this.state.favorites.splice(pos, 1);
    }
    localStorage.setItem('matrixlab_favorites', JSON.stringify(this.state.favorites));
    this.renderHistory();
  }

  openHistory() {
    this.dom.historySidebar.classList.add('open');
    this.renderHistory();
  }

  closeHistory() {
    this.dom.historySidebar.classList.remove('open');
  }

  clearHistory() {
    this.state.history = [];
    this.state.favorites = [];
    localStorage.setItem('matrixlab_history', '[]');
    localStorage.setItem('matrixlab_favorites', '[]');
    this.renderHistory();
    this.showToast('History cleared', 'info');
  }

  filterHistory() {
    this.renderHistory();
  }

  /* ==========================================
     COPY / DOWNLOAD / PRINT
     ========================================== */

  systemToText(s) {
    let text = '';
    const status = {
      unique: 'Consistent — unique solution',
      infinite: `Consistent — infinitely many solutions (${s.freeCount} free parameter${s.freeCount === 1 ? '' : 's'})`,
      none: 'Inconsistent — no solution'
    }[s.status];
    text += `Status: ${status}\n`;
    text += `Equations: ${s.m}   Unknowns: ${s.n}\n`;
    text += `rank(A) = ${s.rankA}, rank([A|b]) = ${s.rankAug}`;
    if (s.det !== null && s.det !== undefined) text += `, det(A) = ${Utils.formatNumber(s.det)}`;
    text += `\nMethod: ${s.methodLabel}\n\n`;
    if (s.status === 'unique' && s.solution) {
      text += s.solution.map((v, i) => `${s.names[i]} = ${Utils.formatNumber(v)}`).join('\n') + '\n';
    } else if (s.status === 'infinite' && s.parametric) {
      text += s.parametric.join('\n') + '\n';
      text += `Free variable(s): ${s.freeNames.join(', ')}\n`;
    } else if (s.status === 'none' && s.contradiction) {
      text += `Contradiction: row ${s.contradiction.row + 1} reduces to 0 = ${Utils.formatNumber(s.contradiction.value)}\n`;
    }
    return text;
  }

  copyResult() {
    let text = '';
    if (this._lastResult) {
      const r = this._lastResult;
      text = `Kenni Matrix Result — ${r.label}\n`;
      text += `Dimensions: ${r.dims}\n`;
      text += `Operation: ${this.dom.resultOperation.textContent}\n\n`;
      if (r.type === 'matrix') {
        text += this.matrixToText(r.result);
      } else if (r.type === 'scalar') {
        text += `Result: ${Utils.formatNumber(r.result)}\n`;
      } else if (r.type === 'vector') {
        text += r.result.map((v, i) => `x${i + 1} = ${Utils.formatNumber(v)}`).join('\n');
      } else if (r.type === 'text') {
        text += `${r.result}\n`;
      } else if (r.type === 'system') {
        text += this.systemToText(r.result);
      } else if (r.type === 'lu') {
        text += 'L:\n' + this.matrixToText(r.result.L);
        text += '\nU:\n' + this.matrixToText(r.result.U);
      } else if (r.type === 'qr') {
        text += 'Q:\n' + this.matrixToText(r.result.Q);
        text += '\nR:\n' + this.matrixToText(r.result.R);
      } else if (r.type === 'diagonalize') {
        text += 'P:\n' + this.matrixToText(r.result.P);
        text += '\nD:\n' + this.matrixToText(r.result.D);
      }
    }

    if (!text) {
      this.showToast('No result to copy', 'warning');
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      this.showToast('Copied to clipboard!', 'success');
    }).catch(() => {
      this.showToast('Failed to copy', 'error');
    });
  }

  matrixToText(matrix) {
    return matrix.map(row => row.map(v => Utils.formatNumber(v)).join('\t')).join('\n');
  }

  stepsToText(steps) {
    let out = '';
    let lastPhase = null;
    let num = 0;
    for (const step of steps) {
      if (step.phase && step.phase !== lastPhase) {
        lastPhase = step.phase;
        out += `\n--- ${step.phase} ---\n`;
      }
      if (step.title || step.detail || step.math) {
        num++;
        out += `${num}. ${step.title || ''}\n`;
        if (step.detail) out += `   ${step.detail}\n`;
        if (step.math) out += step.math.split('\n').map(l => `   ${l}`).join('\n') + '\n';
      } else if (step.text) {
        out += `   ${step.text}\n`;
      }
      if (step.equations) {
        out += step.equations.map(e => `   ${e}`).join('\n') + '\n';
      }
    }
    return out;
  }

  downloadTxt() {
    let text = 'Kenni Matrix — Calculation Report\n';
    text += '==============================\n\n';
    text += `Operation: ${this.dom.resultOperation.textContent}\n`;
    text += `Time: ${this.dom.resultTime.textContent}\n`;
    text += `Date: ${new Date().toLocaleString()}\n\n`;

    if (this._lastResult) {
      const r = this._lastResult;
      text += `Result — ${r.label}\n`;
      text += `Dimensions: ${r.dims}\n\n`;
      if (r.type === 'matrix') {
        text += this.matrixToText(r.result) + '\n';
      } else if (r.type === 'scalar') {
        text += `Result: ${Utils.formatNumber(r.result)}\n`;
      } else if (r.type === 'system') {
        text += this.systemToText(r.result);
      } else if (r.type === 'vector') {
        text += r.result.map((v, i) => `x${i + 1} = ${Utils.formatNumber(v)}`).join('\n') + '\n';
      } else if (r.type === 'lu') {
        text += 'L:\n' + this.matrixToText(r.result.L) + '\n\nU:\n' + this.matrixToText(r.result.U) + '\n';
      } else if (r.type === 'qr') {
        text += 'Q:\n' + this.matrixToText(r.result.Q) + '\n\nR:\n' + this.matrixToText(r.result.R) + '\n';
      } else {
        text += typeof r.result === 'string' ? r.result + '\n' : JSON.stringify(r.result) + '\n';
      }

      if (r.steps && r.steps.length) {
        text += '\n\nWorking Steps\n-------------\n';
        text += this.stepsToText(r.steps);
      }
    }

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'matrixlab_result.txt';
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Downloaded as TXT', 'success');
  }

  downloadPdf() {
    window.print();
  }

  /* ==========================================
     TOGGLE STEPS
     ========================================== */

  toggleSteps() {
    const steps = this.dom.workingSteps;
    const label = this.dom.toggleStepsLabel;
    const isHidden = steps.classList.contains('hidden');
    steps.classList.toggle('hidden');
    if (label) label.textContent = isHidden ? 'Hide Working Steps' : 'Show Working Steps';
    this.dom.btnToggleSteps.closest('.steps-toggle')?.classList.toggle('open', isHidden);
  }

  /* ==========================================
     GENERATE / RESET / CLEAR
     ========================================== */

  handleGenerate() {
    this.saveUndoState();
    this.generateGrid('a');
    this.generateGrid('b');
    this.hideError();
    this.showToast('Matrices generated', 'success');
  }

  handleReset() {
    this.dom.rowsA.value = '2';
    this.dom.colsA.value = '2';
    this.dom.rowsB.value = '2';
    this.dom.colsB.value = '2';
    this.dom.powerValue.value = '2';
    this.dom.scalarValue.value = '1';
    this.dom.opBtns.forEach(b => b.classList.remove('active'));
    this.state.operation = null;
    this.dom.powerGroup.classList.add('hidden');
    this.dom.scalarGroup.classList.add('hidden');
    this.dom.systemPanel.classList.add('hidden');
    this.dom.systemEquations.value = '';
    this.dom.systemMethod.value = 'auto';
    this.dom.resultsSection.classList.add('hidden');
    this.hideError();
    this.generateGrid('a');
    this.generateGrid('b');
    this.state.undoStack = [];
    this.state.redoStack = [];
    this.showToast('Calculator reset', 'info');
  }

  handleClear() {
    const gridA = this.dom.gridA;
    const gridB = this.dom.gridB;
    this.saveUndoState();
    gridA.querySelectorAll('input').forEach(inp => inp.value = '0');
    gridB.querySelectorAll('input').forEach(inp => inp.value = '0');
    this.dom.systemEquations.value = '';
    this.dom.resultsSection.classList.add('hidden');
    this.hideError();
    this.showToast('Matrices cleared', 'info');
  }

  /* ==========================================
     FILL OPERATIONS
     ========================================== */

  fillRandom(side) {
    this.saveUndoState();
    const rows = parseInt(document.getElementById(`rows-${side}`).value) || 2;
    const cols = parseInt(document.getElementById(`cols-${side}`).value) || 2;
    const matrix = MatrixMath.random(rows, cols);
    this.writeMatrix(side, matrix);
    this.showToast(`Random ${rows}×${cols} matrix generated`, 'success');
  }

  fillIdentity(side) {
    const rows = parseInt(document.getElementById(`rows-${side}`).value) || 2;
    const cols = parseInt(document.getElementById(`cols-${side}`).value) || 2;
    if (rows !== cols) {
      this.showToast('Identity matrix requires square dimensions', 'warning');
      return;
    }
    this.saveUndoState();
    const matrix = MatrixMath.identity(rows);
    this.writeMatrix(side, matrix);
    this.showToast(`Identity matrix (${rows}×${rows}) loaded`, 'success');
  }

  fillZeros(side) {
    this.saveUndoState();
    const rows = parseInt(document.getElementById(`rows-${side}`).value) || 2;
    const cols = parseInt(document.getElementById(`cols-${side}`).value) || 2;
    const matrix = MatrixMath.zeros(rows, cols);
    this.writeMatrix(side, matrix);
    this.showToast(`Zero matrix (${rows}×${cols}) loaded`, 'info');
  }

  fillAll(side) {
    const val = prompt(`Enter a value to fill Matrix ${side.toUpperCase()}:`);
    if (val === null) return;
    const num = parseFloat(val);
    if (isNaN(num)) {
      this.showToast('Please enter a valid number', 'warning');
      return;
    }
    this.saveUndoState();
    const grid = document.getElementById(`matrix-${side}-grid`);
    grid.querySelectorAll('input').forEach(inp => inp.value = Utils.formatNumber(num));
    this.showToast(`All cells filled with ${Utils.formatNumber(num)}`, 'info');
  }

  /* ==========================================
     KEYBOARD SHORTCUTS
     ========================================== */

  handleKeyboard(e) {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      this.handleCalculate();
    }
    if (e.ctrlKey && e.key === 'r') {
      e.preventDefault();
      this.handleReset();
    }
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      this.handleClear();
    }
    if (e.ctrlKey && e.key === 'd') {
      e.preventDefault();
      this.toggleTheme();
    }
    if (e.ctrlKey && e.key === 'h') {
      e.preventDefault();
      if (this.dom.historySidebar.classList.contains('open')) {
        this.closeHistory();
      } else {
        this.openHistory();
      }
    }
    if (e.key === 'F11') {
      e.preventDefault();
      this.toggleFullscreen();
    }
  }
}

/* ============================================
   INITIALIZATION
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  new MatrixApp();
});
