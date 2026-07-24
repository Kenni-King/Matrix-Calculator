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

  formatTime(ms) {
    if (ms < 0.001) return '< 0.001 ms';
    if (ms < 1) return ms.toFixed(3) + ' ms';
    if (ms < 1000) return ms.toFixed(2) + ' ms';
    return (ms / 1000).toFixed(2) + ' s';
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

  /* Gaussian Elimination (forward elimination) */
  gaussianElimination(A, b) {
    const m = Utils.clone(A);
    const rhs = b ? [...b] : null;
    const n = m.length;
    const steps = [];

    steps.push({ text: 'Starting Gaussian Elimination', matrix: Utils.clone(m), rhs: rhs ? [...rhs] : null });

    for (let i = 0; i < n; i++) {
      let pivot = i;
      while (pivot < n && Math.abs(m[pivot][i]) < 1e-12) pivot++;
      if (pivot === n) {
        steps.push({ text: `No pivot found in column ${i + 1} — matrix may be singular` });
        return { matrix: null, steps, singular: true };
      }
      if (pivot !== i) {
        [m[i], m[pivot]] = [m[pivot], m[i]];
        if (rhs) [rhs[i], rhs[pivot]] = [rhs[pivot], rhs[i]];
        steps.push({ text: `Swap row ${i + 1} with row ${pivot + 1}`, matrix: Utils.clone(m), rhs: rhs ? [...rhs] : null });
      }
      for (let j = i + 1; j < n; j++) {
        const factor = m[j][i] / m[i][i];
        if (Math.abs(factor) < 1e-12) continue;
        for (let k = i; k < n; k++) {
          m[j][k] -= factor * m[i][k];
        }
        if (rhs) rhs[j] -= factor * rhs[i];
        steps.push({ text: `R${j + 1} → R${j + 1} − (${Utils.formatNumber(factor)}) × R${i + 1}`, matrix: Utils.clone(m), rhs: rhs ? [...rhs] : null });
      }
    }

    steps.push({ text: 'Forward elimination complete (upper triangular form)', matrix: Utils.clone(m), rhs: rhs ? [...rhs] : null });
    return { matrix: m, rhs, steps, singular: false };
  },

  /* Gauss-Jordan Elimination */
  gaussJordan(A, b) {
    const m = Utils.clone(A);
    const rhs = b ? [...b] : null;
    const n = m.length;
    const steps = [];

    steps.push({ text: 'Starting Gauss-Jordan Elimination', matrix: Utils.clone(m), rhs: rhs ? [...rhs] : null });

    for (let i = 0; i < n; i++) {
      let pivot = i;
      while (pivot < n && Math.abs(m[pivot][i]) < 1e-12) pivot++;
      if (pivot === n) {
        steps.push({ text: `No pivot in column ${i + 1} — system may be singular` });
        return { matrix: null, steps, singular: true };
      }
      if (pivot !== i) {
        [m[i], m[pivot]] = [m[pivot], m[i]];
        if (rhs) [rhs[i], rhs[pivot]] = [rhs[pivot], rhs[i]];
        steps.push({ text: `Swap row ${i + 1} ↔ row ${pivot + 1}`, matrix: Utils.clone(m), rhs: rhs ? [...rhs] : null });
      }
      const pivotVal = m[i][i];
      for (let j = i; j < n; j++) m[i][j] /= pivotVal;
      if (rhs) rhs[i] /= pivotVal;
      steps.push({ text: `R${i + 1} → R${i + 1} ÷ ${Utils.formatNumber(pivotVal)}`, matrix: Utils.clone(m), rhs: rhs ? [...rhs] : null });

      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const factor = m[j][i];
        if (Math.abs(factor) < 1e-12) continue;
        for (let k = i; k < n; k++) {
          m[j][k] -= factor * m[i][k];
        }
        if (rhs) rhs[j] -= factor * rhs[i];
        steps.push({ text: `R${j + 1} → R${j + 1} − (${Utils.formatNumber(factor)}) × R${i + 1}`, matrix: Utils.clone(m), rhs: rhs ? [...rhs] : null });
      }
    }

    steps.push({ text: 'Gauss-Jordan complete (reduced row echelon form)', matrix: Utils.clone(m), rhs: rhs ? [...rhs] : null });
    return { matrix: m, rhs, steps, singular: false };
  },

  /* RREF (Reduced Row Echelon Form) */
  rref(A) {
    const m = Utils.clone(A);
    let rows = m.length, cols = m[0].length;
    let lead = 0;
    const steps = [];

    steps.push({ text: 'Computing Reduced Row Echelon Form', matrix: Utils.clone(m) });

    for (let r = 0; r < rows; r++) {
      if (lead >= cols) break;
      let i = r;
      while (Math.abs(m[i][lead]) < 1e-12) {
        i++;
        if (i === rows) { i = r; lead++; if (lead === cols) break; }
      }
      if (lead >= cols) break;
      if (i !== r) {
        [m[r], m[i]] = [m[i], m[r]];
        steps.push({ text: `Swap row ${r + 1} with row ${i + 1}`, matrix: Utils.clone(m) });
      }
      const div = m[r][lead];
      for (let j = 0; j < cols; j++) m[r][j] /= div;
      steps.push({ text: `R${r + 1} → R${r + 1} ÷ ${Utils.formatNumber(div)}`, matrix: Utils.clone(m) });
      for (let j = 0; j < rows; j++) {
        if (j === r) continue;
        const factor = m[j][lead];
        if (Math.abs(factor) < 1e-12) continue;
        for (let k = 0; k < cols; k++) {
          m[j][k] -= factor * m[r][k];
        }
        steps.push({ text: `R${j + 1} → R${j + 1} − (${Utils.formatNumber(factor)}) × R${r + 1}`, matrix: Utils.clone(m) });
      }
      lead++;
    }

    steps.push({ text: 'RREF complete', matrix: Utils.clone(m) });
    return { matrix: m, steps };
  },

  /* LU Decomposition (Doolittle) */
  luDecomposition(A) {
    const n = A.length;
    const L = this.zeros(n, n);
    const U = this.zeros(n, n);
    const steps = [];

    steps.push({ text: 'Starting LU Decomposition (Doolittle method)' });

    for (let i = 0; i < n; i++) {
      L[i][i] = 1;
      for (let j = i; j < n; j++) {
        U[i][j] = A[i][j];
        for (let k = 0; k < i; k++) {
          U[i][j] -= L[i][k] * U[k][j];
        }
      }
      for (let j = i + 1; j < n; j++) {
        L[j][i] = A[j][i];
        for (let k = 0; k < i; k++) {
          L[j][i] -= L[j][k] * U[k][i];
        }
        if (Math.abs(U[i][i]) < 1e-12) {
          steps.push({ text: `Division by zero at step ${i + 1} — matrix is singular` });
          return { L: null, U: null, steps, singular: true };
        }
        L[j][i] /= U[i][i];
      }
      steps.push({ text: `Step ${i + 1}: computed column ${i + 1} of L and row ${i + 1} of U` });
    }

    steps.push({ text: 'LU Decomposition complete. A = L × U' });
    return { L, U, steps, singular: false };
  },

  /* QR Decomposition (Gram-Schmidt) */
  qrDecomposition(A) {
    const m = A.length, n = A[0].length;
    const Q = this.zeros(m, n);
    const R = this.zeros(n, n);
    const steps = [];

    steps.push({ text: 'Starting QR Decomposition (Gram-Schmidt)' });

    for (let j = 0; j < n; j++) {
      let v = A.map(row => row[j]);
      for (let i = 0; i < j; i++) {
        let dot = 0;
        for (let k = 0; k < m; k++) dot += v[k] * Q[k][i];
        R[i][j] = dot;
        for (let k = 0; k < m; k++) v[k] -= dot * Q[k][i];
      }
      let norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
      if (norm < 1e-12) {
        steps.push({ text: `Column ${j + 1} is linearly dependent — QR may be incomplete` });
        norm = 1;
      }
      R[j][j] = norm;
      for (let k = 0; k < m; k++) Q[k][j] = v[k] / norm;
      steps.push({ text: `Computed column ${j + 1} of Q and row ${j + 1} of R` });
    }

    steps.push({ text: 'QR Decomposition complete. A = Q × R' });
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

  /* Solve linear system Ax = b */
  solveLinearSystem(A, b) {
    const gj = this.gaussJordan(A, b);
    if (gj.singular) return { solution: null, steps: gj.steps, singular: true };
    const x = gj.rhs.map(v => {
      if (Math.abs(v) < 1e-12) return 0;
      return v;
    });
    return { solution: x, steps: gj.steps, singular: false };
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
    this.dom.btnTogz

    // Matrix B action buttons
    this.dom.randomB.addEventListener('click', () => this.fillRandom('b'));
    this.dom.identityB.addEventListener('click', () => this.fillIdentity('b'));
    this.dom.zerosB.addEventListener('click', () => this.fillZeros('b'));
    this.dom.fillB.addEventListener('click', () => this.fillAll('b'));

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
        if (rowsA !== colsA) return 'Solve Linear System requires a square coefficient matrix.';
        if (!B || rowsB !== rowsA || colsB !== 1) return 'Matrix B must be a column vector with same number of rows as Matrix A.';
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

    const A = this.readMatrix('a');
    const B = this.readMatrix('b');
    const startTime = performance.now();

    setTimeout(() => {
      try {
        const result = this.executeOperation(op, A, B);
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

  executeOperation(op, A, B) {
    const validationError = this.validateOperation(op, A, B);
    if (validationError) {
      throw new Error(validationError);
    }

    let steps = [];

    switch (op) {
      case 'add': {
        steps.push({ text: `A + B (${A.length}×${A[0].length})` });
        steps.push({ text: 'Adding corresponding elements:', matrix: A, label: 'A' });
        steps.push({ matrix: B, label: 'B' });
        const result = MatrixMath.add(A, B);
        steps.push({ text: 'Result:', matrix: result });
        return { result, type: 'matrix', steps, label: 'A + B', dims: `${A.length}×${A[0].length}` };
      }

      case 'subtract': {
        steps.push({ text: `A − B (${A.length}×${A[0].length})` });
        steps.push({ text: 'Subtracting corresponding elements:', matrix: A, label: 'A' });
        steps.push({ matrix: B, label: 'B' });
        const result = MatrixMath.subtract(A, B);
        steps.push({ text: 'Result:', matrix: result });
        return { result, type: 'matrix', steps, label: 'A − B', dims: `${A.length}×${A[0].length}` };
      }

      case 'multiply': {
        steps.push({ text: `A × B (${A.length}×${A[0].length} × ${B.length}×${B[0].length})` });
        steps.push({ text: 'Multiplying matrices (row × column):', matrix: A, label: 'A' });
        steps.push({ matrix: B, label: 'B' });
        const result = MatrixMath.multiply(A, B);
        steps.push({ text: 'Result:', matrix: result });
        return { result, type: 'matrix', steps, label: 'A × B', dims: `${result.length}×${result[0].length}` };
      }

      case 'scalar': {
        const k = parseFloat(this.dom.scalarValue.value) || 1;
        steps.push({ text: `k = ${Utils.formatNumber(k)}` });
        steps.push({ text: 'Scalar multiplication: k × A', matrix: A, label: 'A' });
        const result = MatrixMath.scalarMultiply(A, k);
        steps.push({ text: 'Result:', matrix: result });
        return { result, type: 'matrix', steps, label: `${Utils.formatNumber(k)} × A`, dims: `${result.length}×${result[0].length}` };
      }

      case 'transpose': {
        steps.push({ text: `Transpose of ${A.length}×${A[0].length} matrix` });
        steps.push({ matrix: A, label: 'A' });
        const result = MatrixMath.transpose(A);
        steps.push({ text: 'Result:', matrix: result });
        return { result, type: 'matrix', steps, label: 'Aᵀ', dims: `${result.length}×${result[0].length}` };
      }

      case 'rank': {
        const result = MatrixMath.rank(A);
        steps.push({ text: `Computing rank of ${A.length}×${A[0].length} matrix` });
        steps.push({ matrix: A, label: 'A' });
        steps.push({ text: `Rank = ${result} (number of linearly independent rows/columns)` });
        return { result, type: 'scalar', steps, label: 'Rank', dims: `${A.length}×${A[0].length}` };
      }

      case 'determinant': {
        steps.push({ text: `Computing determinant of ${A.length}×${A.length} matrix` });
        steps.push({ matrix: A, label: 'A' });
        const result = MatrixMath.determinant(A);
        steps.push({ text: `det(A) = ${Utils.formatNumber(result)}` });
        return { result, type: 'scalar', steps, label: 'det(A)', dims: `${A.length}×${A.length}` };
      }

      case 'trace': {
        steps.push({ text: `Computing trace of ${A.length}×${A.length} matrix` });
        steps.push({ matrix: A, label: 'A' });
        const result = MatrixMath.trace(A);
        steps.push({ text: `tr(A) = ${Utils.formatNumber(result)} = sum of diagonal elements` });
        return { result, type: 'scalar', steps, label: 'tr(A)', dims: `${A.length}×${A.length}` };
      }

      case 'norm': {
        steps.push({ text: `Computing Frobenius norm of ${A.length}×${A[0].length} matrix` });
        steps.push({ matrix: A, label: 'A' });
        const result = MatrixMath.frobeniusNorm(A);
        steps.push({ text: `‖A‖F = ${Utils.formatNumber(result)}` });
        return { result, type: 'scalar', steps, label: '‖A‖', dims: `${A.length}×${A[0].length}` };
      }

      case 'size': {
        const rows = A.length, cols = A[0].length;
        steps.push({ text: `Matrix dimensions: ${rows} rows × ${cols} columns` });
        steps.push({ matrix: A, label: 'A' });
        return { result: `${rows} × ${cols}`, type: 'text', steps, label: 'Size', dims: `${rows}×${cols}` };
      }

      case 'type': {
        const type = MatrixMath.detectType(A);
        steps.push({ text: `Analyzing matrix type...` });
        steps.push({ matrix: A, label: 'A' });
        steps.push({ text: `Matrix type: ${type}` });
        return { result: type, type: 'text', steps, label: 'Type', dims: `${A.length}×${A[0].length}` };
      }

      case 'inverse': {
        steps.push({ text: `Computing inverse of ${A.length}×${A.length} matrix` });
        steps.push({ matrix: A, label: 'A' });
        steps.push({ text: 'Augmenting with identity matrix and applying Gauss-Jordan elimination' });
        const result = MatrixMath.inverse(A);
        if (!result) throw new Error('This matrix is singular. Its inverse does not exist.');
        steps.push({ text: 'Result:', matrix: result });
        const verify = MatrixMath.multiply(A, result);
        steps.push({ text: 'Verification: A × A⁻¹ should equal identity', matrix: verify });
        return { result, type: 'matrix', steps, label: 'A⁻¹', dims: `${result.length}×${result[0].length}` };
      }

      case 'adjoint': {
        steps.push({ text: `Computing adjoint of ${A.length}×${A.length} matrix` });
        steps.push({ matrix: A, label: 'A' });
        const cof = MatrixMath.cofactorMatrix(A);
        steps.push({ text: 'Step 1: Cofactor matrix', matrix: cof });
        const result = MatrixMath.adjoint(A);
        steps.push({ text: 'Step 2: Transpose of cofactor matrix (Adjoint)', matrix: result });
        return { result, type: 'matrix', steps, label: 'adj(A)', dims: `${result.length}×${result[0].length}` };
      }

      case 'cofactor': {
        steps.push({ text: `Computing cofactor matrix of ${A.length}×${A.length} matrix` });
        steps.push({ matrix: A, label: 'A' });
        const result = MatrixMath.cofactorMatrix(A);
        steps.push({ text: 'Cofactor matrix:', matrix: result });
        return { result, type: 'matrix', steps, label: 'Cofactor', dims: `${result.length}×${result[0].length}` };
      }

      case 'minor': {
        steps.push({ text: `Computing minor matrix for each element of ${A.length}×${A.length} matrix` });
        steps.push({ matrix: A, label: 'A' });
        const minorSteps = MatrixMath.getMinorSteps(A);
        steps.push(...minorSteps);
        return { result: 'See steps for minor determinants', type: 'text', steps, label: 'Minors', dims: `${A.length}×${A.length}` };
      }

      case 'power': {
        const power = parseInt(this.dom.powerValue.value) || 2;
        steps.push({ text: `Computing A^${power} for ${A.length}×${A.length} matrix` });
        steps.push({ matrix: A, label: 'A' });
        steps.push({ text: `Applying matrix power with exponent ${power}` });
        const result = MatrixMath.matrixPower(A, power);
        steps.push({ text: `Result: A^${power}`, matrix: result });
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
        if (lu.L) {
          steps.push({ text: 'L (lower triangular):', matrix: lu.L });
          steps.push({ text: 'U (upper triangular):', matrix: lu.U });
        }
        return { result: { L: lu.L, U: lu.U }, type: 'lu', steps, label: 'LU Decomposition', dims: `${A.length}×${A.length}`, error: lu.singular };
      }

      case 'qr': {
        const qr = MatrixMath.qrDecomposition(A);
        steps.push(...qr.steps);
        steps.push({ text: 'Q (orthogonal):', matrix: qr.Q });
        steps.push({ text: 'R (upper triangular):', matrix: qr.R });
        return { result: { Q: qr.Q, R: qr.R }, type: 'qr', steps, label: 'QR Decomposition', dims: `${A.length}×${A[0].length}` };
      }

      case 'cholesky': {
        steps.push({ text: `Computing Cholesky decomposition of ${A.length}×${A.length} matrix` });
        steps.push({ matrix: A, label: 'A' });
        const L = MatrixMath.choleskyDecomposition(A);
        if (!L) throw new Error('Matrix is not symmetric positive definite. Cholesky decomposition requires a symmetric positive definite matrix.');
        const Lt = MatrixMath.transpose(L);
        steps.push({ text: 'L (lower triangular):', matrix: L });
        steps.push({ text: 'Lᵀ (transpose):', matrix: Lt });
        const verify = MatrixMath.multiply(L, Lt);
        steps.push({ text: 'Verification: L × Lᵀ should equal A', matrix: verify });
        return { result: { L, Lt }, type: 'cholesky', steps, label: 'Cholesky', dims: `${A.length}×${A.length}` };
      }

      case 'solve': {
        const b = B.map(row => row[0]);
        const sol = MatrixMath.solveLinearSystem(A, b);
        steps.push(...sol.steps);
        if (sol.singular) {
          return { result: null, type: 'text', steps, label: 'Solve', dims: `${A.length}×${A.length}`, error: true, message: 'System is singular — no unique solution.' };
        }
        steps.push({ text: 'Solution vector x:', matrix: sol.solution.map(v => [v]) });
        return { result: sol.solution, type: 'vector', steps, label: 'Solution x', dims: `${A.length}×1` };
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
      this.dom.btnToggleSteps.textContent = 'Hide Working Steps';
      this.dom.btnToggleSteps.closest('.steps-toggle')?.classList.add('open');
    } else {
      this.dom.workingSteps.classList.add('hidden');
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
      cholesky: 'Cholesky Decomposition', solve: 'Solve System',
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
    const opsNeedingB = [...opsNeedingBoth, 'solve'];
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

  matrixToTable(matrix) {
    const table = document.createElement('table');
    table.className = 'matrix-table';
    for (const row of matrix) {
      const tr = document.createElement('tr');
      for (const val of row) {
        const td = document.createElement('td');
        td.textContent = Utils.formatNumber(val);
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

  renderSteps(steps) {
    const container = this.dom.stepsContent;
    container.innerHTML = '';

    for (const step of steps) {
      const item = document.createElement('div');
      item.className = 'step-item';

      const text = document.createElement('div');
      text.className = 'step-label';
      text.textContent = step.text || '';
      item.appendChild(text);

      if (step.matrix) {
        const matrixDiv = document.createElement('div');
        matrixDiv.className = 'step-matrix';
        if (step.label) {
          const label = document.createElement('div');
          label.style.cssText = 'font-size:0.7rem;color:var(--text-muted);margin-bottom:2px;';
          label.textContent = `Matrix ${step.label}`;
          matrixDiv.appendChild(label);
        }
        matrixDiv.appendChild(this.matrixToTable(step.matrix));
        item.appendChild(matrixDiv);
      }

      container.appendChild(item);
    }
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
        text += this.matrixToText(r.result);
      } else if (r.type === 'scalar') {
        text += `Result: ${Utils.formatNumber(r.result)}\n`;
      } else {
        text += typeof r.result === 'string' ? r.result : JSON.stringify(r.result);
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
    const btn = this.dom.btnToggleSteps;
    const isHidden = steps.classList.contains('hidden');
    steps.classList.toggle('hidden');
    btn.textContent = isHidden ? 'Hide Working Steps' : 'Show Working Steps';
    btn.closest('.steps-toggle')?.classList.toggle('open', isHidden);
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
