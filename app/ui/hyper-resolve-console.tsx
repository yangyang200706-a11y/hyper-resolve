"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type EngineState = "idle" | "computing" | "resolved" | "blocked";
type AnimationMode = "montecarlo" | "linear" | "surface" | "laplace";
type Point = { x: number; y: number };
type MonteCarloPoint = { x: number; y: number; inside: boolean };

type WorkerMessage = {
  type: "heartbeat" | "done";
  progress?: number;
  cycles?: number;
  estimate?: number;
  sampleCount?: number;
  brownianSigma?: number;
  equationLine?: string;
  functionPoints?: Point[];
  taylorPoints?: Point[];
  brownianPoints?: Point[];
  monteCarloPoints?: MonteCarloPoint[];
};

const STATIC_REASONING_LINES = [
  "[INIT] Parsing query through nonlinear causality pipeline",
  "[CALC] d/dt(confidence) = entropy + coffee^2",
  "[FIELD] div(E) = rho/epsilon0 and curl(B) = mu0 J + mu0 epsilon0 dE/dt",
  "[ANALYZE] Performing unnecessary contour integration around pole cloud",
  "[MATRIX] Refactor the adjugate of the Jacobian Matrix to {} by block LU heuristic",
  "[POLY] Solving polynomial surrogate via quintic truncation",
  "[SIM] Integrating Brownian bridge over unstable decision manifold",
  "[PROOF] Complex analysis says maybe is a stable fixed point",
];

const MODE_LABELS: Record<AnimationMode, string> = {
  montecarlo: "Monte Carlo Integration",
  linear: "Linear Transform Plane",
  surface: "Surface Integration Sweep",
  laplace: "Laplace-Domain Surface",
};

const MODE_EQUATIONS: Record<AnimationMode, string> = {
  montecarlo: "[MODE] I = Integral_-2^2 f(x)dx approximated by Monte Carlo area ratio",
  linear: "[MODE] A(t) = [[a,b],[c,d]] maps basis vectors e1,e2 -> A e1, A e2",
  surface: "[MODE] Integral_S F . dS over parameterized surface z = sin(x)+cos(y)",
  laplace: "[MODE] F(s) = 1 / (s^2 + 0.8s + 1.2), visualizing |F(s)| in complex plane",
};

function buildWorker() {
  const workerScript = `
let isRunning = false;
let startTime = 0;
let endTime = 0;
let heartbeat = 0;
let cycles = 0;

const vectorLength = 90000;
const values = new Float64Array(vectorLength);

let mcTotal = 0;
let mcInside = 0;
let mcPoints = [];
let fnPoints = [];
let taylorPoints = [];
let brownianPoints = [];
let brownianSigma = 0;

const bounds = {
  minX: -3,
  maxX: 3,
  minY: -2.8,
  maxY: 2.8,
};

const mcDomain = {
  minX: -2,
  maxX: 2,
  minY: 0,
  maxY: 2.6,
};

function targetFunction(x) {
  return Math.sin(1.4 * x) + 0.24 * x * x * x - 0.6 * x;
}

function taylorApprox(x) {
  const c1 = 1.4;
  const c3 = -(Math.pow(1.4, 3) / 6) + 0.24;
  const c5 = Math.pow(1.4, 5) / 120;
  return (c1 - 0.6) * x + c3 * Math.pow(x, 3) + c5 * Math.pow(x, 5);
}

function integrand(x) {
  return Math.exp(-x * x) * Math.cos(2.2 * x) + 0.35 * x * x + 0.2;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function gaussian() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function buildFunctionSeries() {
  fnPoints = [];
  taylorPoints = [];
  const count = 220;
  for (let i = 0; i <= count; i += 1) {
    const x = bounds.minX + ((bounds.maxX - bounds.minX) * i) / count;
    fnPoints.push({ x, y: targetFunction(x) });
    taylorPoints.push({ x, y: taylorApprox(x) });
  }
}

function buildBrownianSeries() {
  brownianPoints = [];
  let w = 0;
  const steps = 190;
  const dt = 1 / steps;
  const amplitudes = [];

  for (let i = 0; i <= steps; i += 1) {
    if (i > 0) {
      w += Math.sqrt(dt) * gaussian() * 1.2;
    }
    const x = bounds.minX + ((bounds.maxX - bounds.minX) * i) / steps;
    brownianPoints.push({ x, y: w * 1.03 });
    amplitudes.push(w);
  }

  const mean = amplitudes.reduce((acc, value) => acc + value, 0) / amplitudes.length;
  brownianSigma = Math.sqrt(
    amplitudes.reduce((acc, value) => acc + (value - mean) * (value - mean), 0) / amplitudes.length,
  );
}

function seedCpuBuffer() {
  for (let i = 0; i < values.length; i += 1) {
    values[i] = (Math.sin(i * 0.113) + Math.cos(i * 0.071)) * 0.5;
  }
}

function matrixDescriptor() {
  const a = (Math.sin(cycles * 0.13) * 0.7 + 1.2).toFixed(3);
  const b = (Math.cos(cycles * 0.17) * 0.4 - 0.25).toFixed(3);
  const c = (Math.sin(cycles * 0.21) * 0.55 + 0.15).toFixed(3);
  const d = (Math.cos(cycles * 0.09) * 0.6 + 1.05).toFixed(3);
  return "[MATRIX] Refactor the adjugate of the Jacobian Matrix to {{" + a + ", " + b + "}, {" + c + ", " + d + "}} by pseudo-symplectic pivoting";
}

function reasoningLine() {
  if (cycles % 11 === 0) {
    return matrixDescriptor();
  }
  if (cycles % 7 === 0) {
    const r = (mcInside / Math.max(1, mcTotal)).toFixed(5);
    return "[PROB] Reweighing contour residues by " + r + " under complex-plane drift";
  }
  if (cycles % 5 === 0) {
    return "[TAYLOR] Updating quintic truncation around x0 = 0 with stochastic correction";
  }
  return "[STEP] Orthogonalizing polynomial basis in redundant Hilbert subspace";
}

function crunchChunk() {
  if (!isRunning) {
    return;
  }

  for (let outer = 0; outer < 8; outer += 1) {
    for (let i = 1; i < values.length - 1; i += 1) {
      const left = values[i - 1];
      const center = values[i];
      const right = values[i + 1];
      values[i] = Math.sin(left * 1.0017 + right * 0.9981) * 0.61 + Math.cos(center * 1.73) * 0.39;
    }

    for (let j = 0; j < 430; j += 1) {
      const x = rand(mcDomain.minX, mcDomain.maxX);
      const y = rand(mcDomain.minY, mcDomain.maxY);
      const inside = y <= integrand(x);
      mcTotal += 1;
      if (inside) {
        mcInside += 1;
      }
      if (mcPoints.length < 360 || j % 8 === 0) {
        mcPoints.push({ x, y, inside });
      }
      if (mcPoints.length > 360) {
        mcPoints.shift();
      }
    }

    cycles += 1;
  }

  const now = performance.now();
  if (now - heartbeat > 230) {
    heartbeat = now;
    const elapsed = now - startTime;
    const total = endTime - startTime;
    const progress = Math.min(1, elapsed / total);
    const area = (mcDomain.maxX - mcDomain.minX) * (mcDomain.maxY - mcDomain.minY);
    const estimate = area * (mcInside / Math.max(1, mcTotal));

    postMessage({
      type: "heartbeat",
      progress,
      cycles,
      estimate,
      sampleCount: mcTotal,
      brownianSigma,
      equationLine: reasoningLine(),
      functionPoints: fnPoints,
      taylorPoints,
      brownianPoints,
      monteCarloPoints: mcPoints,
    });
  }

  if (now >= endTime) {
    const area = (mcDomain.maxX - mcDomain.minX) * (mcDomain.maxY - mcDomain.minY);
    const estimate = area * (mcInside / Math.max(1, mcTotal));
    isRunning = false;

    postMessage({
      type: "done",
      progress: 1,
      cycles,
      estimate,
      sampleCount: mcTotal,
      brownianSigma,
      equationLine: "[DONE] Stationary phase reached after unnecessary over-analysis",
      functionPoints: fnPoints,
      taylorPoints,
      brownianPoints,
      monteCarloPoints: mcPoints,
    });
    return;
  }

  setTimeout(crunchChunk, 0);
}

self.onmessage = (event) => {
  const message = event.data;

  if (message.type === "start") {
    isRunning = true;
    cycles = 0;
    mcTotal = 0;
    mcInside = 0;
    mcPoints = [];

    seedCpuBuffer();
    buildFunctionSeries();
    buildBrownianSeries();

    startTime = performance.now();
    endTime = startTime + message.durationMs;
    heartbeat = startTime;

    postMessage({
      type: "heartbeat",
      progress: 0,
      cycles: 0,
      estimate: 0,
      sampleCount: 0,
      brownianSigma,
      equationLine: "[BOOT] Building polynomial basis and stochastic trajectories",
      functionPoints: fnPoints,
      taylorPoints,
      brownianPoints,
      monteCarloPoints: mcPoints,
    });

    crunchChunk();
  }

  if (message.type === "stop") {
    isRunning = false;
  }
};`;

  const url = URL.createObjectURL(new Blob([workerScript], { type: "application/javascript" }));
  const worker = new Worker(url);
  URL.revokeObjectURL(url);
  return worker;
}

function shaderSource() {
  return {
    vertex: `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`,
    fragment: `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_energy;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.52;
  float energy = 0.7 + u_energy * 1.85;

  float field = 0.0;
  vec2 p = uv;

  for (int i = 1; i < 68; i++) {
    float fi = float(i);
    p += 0.06 * vec2(cos(fi * 0.2 + t), sin(fi * 0.27 - t));
    float wave = sin((p.x * fi * 0.53 + t) * energy) * cos((p.y * fi * 0.47 - t) * energy);
    field += wave / (0.45 + fi * 0.045);
  }

  float glow = exp(-length(uv) * 2.6) * (0.7 + u_energy * 0.7);
  float scan = 0.08 * sin(gl_FragCoord.y * 0.8 + t * 14.0);
  float noise = (hash(gl_FragCoord.xy * 0.02 + t) - 0.5) * 0.06;

  vec3 deep = vec3(0.03, 0.06, 0.12);
  vec3 cyan = vec3(0.00, 0.95, 0.95);
  vec3 amber = vec3(1.0, 0.58, 0.0);

  float blendA = smoothstep(-0.4, 0.65, field);
  float blendB = smoothstep(0.2, 1.1, field + glow);

  vec3 color = mix(deep, cyan, blendA);
  color = mix(color, amber, blendB * 0.42);
  color += glow * vec3(0.08, 0.16, 0.24);
  color += scan + noise;

  gl_FragColor = vec4(color, 1.0);
}
`,
  };
}

function shuffleModes(seed: number): AnimationMode[] {
  const source: AnimationMode[] = ["montecarlo", "linear", "surface", "laplace"];
  const out = [...source];
  let s = Math.max(1, Math.floor(seed * 1000));

  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (s * 48271) % 2147483647;
    const j = s % (i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

export function HyperResolveConsole() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const frameRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const feedIntervalRef = useRef<number | null>(null);
  const modeIntervalRef = useRef<number | null>(null);
  const finalizeTimeoutRef = useRef<number | null>(null);
  const computeActiveRef = useRef(false);
  const seedRef = useRef(Math.random());

  const [question, setQuestion] = useState("");
  const [askedQuestion, setAskedQuestion] = useState("");
  const [state, setState] = useState<EngineState>("idle");
  const [progress, setProgress] = useState(0);
  const [cycles, setCycles] = useState(0);
  const [sampleCount, setSampleCount] = useState(0);
  const [mcEstimate, setMcEstimate] = useState(0);
  const [brownianSigma, setBrownianSigma] = useState(0);
  const [equations, setEquations] = useState<string[]>(["[READY] Awaiting impossible question..."]);
  const [isWebGLReady, setIsWebGLReady] = useState(false);
  const [functionPoints, setFunctionPoints] = useState<Point[]>([]);
  const [taylorPoints, setTaylorPoints] = useState<Point[]>([]);
  const [brownianPoints, setBrownianPoints] = useState<Point[]>([]);
  const [monteCarloPoints, setMonteCarloPoints] = useState<MonteCarloPoint[]>([]);
  const [activeModes, setActiveModes] = useState<AnimationMode[]>(["montecarlo"]);
  const reduceMotion = useReducedMotion();

  const trimmedQuestion = question.trim();
  const hasRuntime = state !== "idle";
  const canStart = isWebGLReady && state !== "computing" && state !== "blocked";

  useEffect(() => {
    computeActiveRef.current = state === "computing";
  }, [state]);

  const pushEquation = useCallback((line: string) => {
    setEquations((prev) => {
      const next = [...prev, line];
      if (next.length > 44) {
        return next.slice(next.length - 44);
      }
      return next;
    });
  }, []);

  const clearTimers = useCallback(() => {
    if (feedIntervalRef.current) {
      window.clearInterval(feedIntervalRef.current);
      feedIntervalRef.current = null;
    }
    if (modeIntervalRef.current) {
      window.clearInterval(modeIntervalRef.current);
      modeIntervalRef.current = null;
    }
    if (finalizeTimeoutRef.current) {
      window.clearTimeout(finalizeTimeoutRef.current);
      finalizeTimeoutRef.current = null;
    }
  }, []);

  const stopComputing = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: "stop" });
    }
    clearTimers();
  }, [clearTimers]);

  const registerMode = useCallback(
    (mode: AnimationMode) => {
      setActiveModes((prev) => (prev.includes(mode) ? prev : [...prev, mode]));
      pushEquation(MODE_EQUATIONS[mode]);
    },
    [pushEquation],
  );

  useEffect(() => {
    if (!terminalRef.current) {
      return;
    }
    window.requestAnimationFrame(() => {
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      }
    });
  }, [equations]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      setState("blocked");
      setEquations([
        "[ERROR] WebGL context unavailable.",
        "[BLOCKED] Required GPU mode cannot initialize on this device.",
      ]);
      return;
    }

    const source = shaderSource();

    const compile = (type: number, src: string) => {
      const shader = gl.createShader(type);
      if (!shader) {
        return null;
      }
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        return null;
      }
      return shader;
    };

    const vertexShader = compile(gl.VERTEX_SHADER, source.vertex);
    const fragmentShader = compile(gl.FRAGMENT_SHADER, source.fragment);

    if (!vertexShader || !fragmentShader) {
      setState("blocked");
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      setState("blocked");
      return;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setState("blocked");
      return;
    }

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const timeLocation = gl.getUniformLocation(program, "u_time");
    const energyLocation = gl.getUniformLocation(program, "u_energy");

    const buffer = gl.createBuffer();
    if (!buffer) {
      setState("blocked");
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const onResize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.55);
      const width = Math.floor(window.innerWidth * ratio);
      const height = Math.floor(window.innerHeight * ratio);
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    };

    onResize();
    window.addEventListener("resize", onResize);
    setIsWebGLReady(true);

    const render = (now: number) => {
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      if (resolutionLocation) {
        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      }
      if (timeLocation) {
        gl.uniform1f(timeLocation, now * 0.001);
      }
      if (energyLocation) {
        gl.uniform1f(energyLocation, computeActiveRef.current ? 1 : 0.25);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frameRef.current = window.requestAnimationFrame(render);
    };

    frameRef.current = window.requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", onResize);
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
      }
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  useEffect(() => {
    const worker = buildWorker();
    workerRef.current = worker;

    const onMessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === "heartbeat" || message.type === "done") {
        setProgress(message.progress ?? 0);
        setCycles(message.cycles ?? 0);
        setMcEstimate(message.estimate ?? 0);
        setSampleCount(message.sampleCount ?? 0);
        setBrownianSigma(message.brownianSigma ?? 0);

        if (message.functionPoints) {
          setFunctionPoints(message.functionPoints);
        }
        if (message.taylorPoints) {
          setTaylorPoints(message.taylorPoints);
        }
        if (message.brownianPoints) {
          setBrownianPoints(message.brownianPoints);
        }
        if (message.monteCarloPoints) {
          setMonteCarloPoints(message.monteCarloPoints);
        }

        if (message.equationLine) {
          pushEquation(message.equationLine);
        }
      }
    };

    worker.addEventListener("message", onMessage);

    return () => {
      stopComputing();
      worker.removeEventListener("message", onMessage);
      worker.terminate();
      workerRef.current = null;
    };
  }, [pushEquation, stopComputing]);

  useEffect(() => {
    if (!hasRuntime) {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const canvas = animationCanvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 1.6);
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = (now: number) => {
      const t = now * 0.001;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(1, 8, 18, 0.92)";
      ctx.fillRect(0, 0, width, height);

      const gridX = 12;
      const gridY = 10;
      ctx.strokeStyle = "rgba(126, 225, 241, 0.13)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= gridX; i += 1) {
        const x = (width / gridX) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let i = 0; i <= gridY; i += 1) {
        const y = (height / gridY) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const drawMonteCarlo = (x0: number, y0: number, w: number, h: number) => {
        const mapX = (x: number) => x0 + ((x + 3) / 6) * w;
        const mapY = (y: number) => y0 + h - ((y + 2.8) / 5.6) * h;

        ctx.strokeStyle = "rgba(102, 243, 247, 0.95)";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        functionPoints.forEach((point, index) => {
          const px = mapX(point.x);
          const py = mapY(point.y);
          if (index === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        });
        ctx.stroke();

        ctx.strokeStyle = "rgba(255, 177, 95, 0.95)";
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        taylorPoints.forEach((point, index) => {
          const px = mapX(point.x);
          const py = mapY(point.y);
          if (index === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        });
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = "rgba(216, 115, 255, 0.9)";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        brownianPoints.forEach((point, index) => {
          const px = mapX(point.x);
          const py = mapY(point.y);
          if (index === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        });
        ctx.stroke();

        monteCarloPoints.forEach((point) => {
          const px = mapX(point.x);
          const py = mapY(point.y);
          ctx.fillStyle = point.inside ? "rgba(97, 252, 141, 0.7)" : "rgba(255, 108, 108, 0.6)";
          ctx.beginPath();
          ctx.arc(px, py, 1.3, 0, Math.PI * 2);
          ctx.fill();
        });
      };

      const drawLinear = (x0: number, y0: number, w: number, h: number) => {
        const cx = x0 + w * 0.5;
        const cy = y0 + h * 0.53;
        const scale = Math.min(w, h) * 0.24;
        const seedShift = seedRef.current * 2;

        const a = 1 + Math.sin(t * 0.9 + seedShift) * 0.25;
        const b = Math.cos(t * 0.7 + seedShift * 0.5) * 0.42;
        const c = Math.sin(t * 0.45 + seedShift * 0.8) * 0.45;
        const d = 1 + Math.cos(t * 0.8 + seedShift * 0.3) * 0.23;

        const tp = (x: number, y: number) => ({ x: a * x + b * y, y: c * x + d * y });

        ctx.strokeStyle = "rgba(180, 246, 255, 0.35)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(cx, y0);
        ctx.lineTo(cx, y0 + h);
        ctx.moveTo(x0, cy);
        ctx.lineTo(x0 + w, cy);
        ctx.stroke();

        const drawVector = (x: number, y: number, color: string) => {
          const p = tp(x, y);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + p.x * scale, cy - p.y * scale);
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.6;
          ctx.stroke();
        };

        drawVector(1, 0, "rgba(87, 251, 224, 0.95)");
        drawVector(0, 1, "rgba(255, 160, 74, 0.95)");

        const corners = [tp(-1, -1), tp(1, -1), tp(1, 1), tp(-1, 1)];
        ctx.beginPath();
        corners.forEach((corner, i) => {
          const x = cx + corner.x * scale;
          const y = cy - corner.y * scale;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.strokeStyle = "rgba(214, 122, 255, 0.92)";
        ctx.lineWidth = 2;
        ctx.stroke();
      };

      const drawSurface = (mode: AnimationMode, x0: number, y0: number, w: number, h: number) => {
        const project = (x: number, y: number, z: number) => {
          const yaw = 0.78 + Math.sin(t * 0.23 + seedRef.current) * 0.09;
          const pitch = 0.58;
          const cy = Math.cos(yaw);
          const sy = Math.sin(yaw);
          const cp = Math.cos(pitch);
          const sp = Math.sin(pitch);

          const x1 = x * cy - z * sy;
          const z1 = x * sy + z * cy;
          const y1 = y * cp - z1 * sp;
          const z2 = y * sp + z1 * cp;
          const depth = 1 / (4.7 + z2);
          const s = Math.min(w, h) * 0.46;

          return {
            x: x0 + w * 0.5 + x1 * s * depth,
            y: y0 + h * 0.56 - y1 * (s * 0.92) * depth,
          };
        };

        for (let i = -7; i <= 7; i += 1) {
          ctx.beginPath();
          for (let j = -7; j <= 7; j += 1) {
            const x = i / 2.3;
            const z = j / 2.3;
            let y = 0;
            if (mode === "surface") {
              y = Math.sin(x * 1.15 + t + seedRef.current) * 0.46 + Math.cos(z * 1.3 - t * 0.6) * 0.42;
            } else {
              const re = x;
              const im = z;
              const den = Math.pow(re * re - im * im + 1.2, 2) + Math.pow(2 * re * im + 0.8 * im, 2);
              y = 1.85 / Math.sqrt(den + 0.06);
            }
            const p = project(x, y, z);
            if (j === -7) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          }
          ctx.strokeStyle = mode === "surface" ? "rgba(0, 247, 229, 0.28)" : "rgba(212, 124, 255, 0.30)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        const sweep = ((Math.sin(t * 1.05 + seedRef.current) + 1) / 2) * 14 - 7;
        ctx.beginPath();
        for (let j = -7; j <= 7; j += 1) {
          const x = sweep / 2.3;
          const z = j / 2.3;
          let y = 0;
          if (mode === "surface") {
            y = Math.sin(x * 1.15 + t + seedRef.current) * 0.46 + Math.cos(z * 1.3 - t * 0.6) * 0.42;
          } else {
            const re = x;
            const im = z;
            const den = Math.pow(re * re - im * im + 1.2, 2) + Math.pow(2 * re * im + 0.8 * im, 2);
            y = 1.85 / Math.sqrt(den + 0.06);
          }
          const p = project(x, y, z);
          if (j === -7) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = "rgba(255, 165, 78, 0.88)";
        ctx.lineWidth = 2.2;
        ctx.stroke();
      };

      const drawLaplace3D = (x0: number, y0: number, w: number, h: number) => {
        const leftW = w * 0.64;
        const rightW = w - leftW - 6;
        const topH = h * 0.5 - 4;
        const bottomH = h - topH - 6;

        const project = (x: number, y: number, z: number) => {
          const yaw = 0.85 + Math.sin(t * 0.18 + seedRef.current) * 0.08;
          const pitch = 0.62;
          const cy = Math.cos(yaw);
          const sy = Math.sin(yaw);
          const cp = Math.cos(pitch);
          const sp = Math.sin(pitch);

          const x1 = x * cy - z * sy;
          const z1 = x * sy + z * cy;
          const y1 = y * cp - z1 * sp;
          const z2 = y * sp + z1 * cp;
          const depth = 1 / (4.5 + z2);
          const s = Math.min(leftW, h) * 0.56;

          return {
            x: x0 + leftW * 0.5 + x1 * s * depth,
            y: y0 + h * 0.58 - y1 * s * 0.85 * depth,
          };
        };

        for (let i = -7; i <= 7; i += 1) {
          ctx.beginPath();
          for (let j = -7; j <= 7; j += 1) {
            const re = i / 2.6;
            const im = j / 2.6;
            const den = Math.pow(re * re - im * im + 1.15, 2) + Math.pow(2 * re * im + 0.55 * im, 2);
            const mag = 2.1 / Math.sqrt(den + 0.05);
            const p = project(re, mag, im);
            if (j === -7) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          }
          ctx.strokeStyle = "rgba(223, 120, 255, 0.32)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        const sweep = ((Math.sin(t * 1.02 + seedRef.current) + 1) / 2) * 14 - 7;
        ctx.beginPath();
        for (let j = -7; j <= 7; j += 1) {
          const re = sweep / 2.6;
          const im = j / 2.6;
          const den = Math.pow(re * re - im * im + 1.15, 2) + Math.pow(2 * re * im + 0.55 * im, 2);
          const mag = 2.1 / Math.sqrt(den + 0.05);
          const p = project(re, mag, im);
          if (j === -7) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = "rgba(255, 165, 78, 0.9)";
        ctx.lineWidth = 2;
        ctx.stroke();

        const rtX = x0 + leftW + 6;
        const rtY = y0;
        const rbX = x0 + leftW + 6;
        const rbY = y0 + topH + 6;

        ctx.strokeStyle = "rgba(126, 225, 241, 0.24)";
        ctx.lineWidth = 1;
        ctx.strokeRect(rtX, rtY, rightW, topH);
        ctx.strokeRect(rbX, rbY, rightW, bottomH);

        const centerX = rtX + rightW * 0.5;
        const centerY = rtY + topH * 0.5;
        const spiralScale = Math.min(rightW, topH) * 0.36;
        ctx.beginPath();
        for (let i = 0; i <= 180; i += 1) {
          const tau = i / 24;
          const decay = Math.exp(-0.09 * tau);
          const x = decay * Math.cos(3.6 * tau + t * 1.3);
          const y = decay * Math.sin(3.6 * tau + t * 1.3);
          const px = centerX + x * spiralScale;
          const py = centerY + y * spiralScale;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = "rgba(255, 143, 167, 0.95)";
        ctx.lineWidth = 1.8;
        ctx.stroke();

        const gx = rbX + 8;
        const gy = rbY + bottomH * 0.52;
        const gw = rightW - 16;
        const gh = bottomH - 14;
        ctx.strokeStyle = "rgba(180, 246, 255, 0.32)";
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + gw, gy);
        ctx.moveTo(gx, gy - gh * 0.45);
        ctx.lineTo(gx, gy + gh * 0.45);
        ctx.stroke();

        ctx.beginPath();
        for (let i = 0; i <= 140; i += 1) {
          const tau = (i / 140) * 5.4;
          const v = Math.cos(4.2 * tau) * Math.exp(-0.58 * tau);
          const px = gx + (tau / 5.4) * gw;
          const py = gy - v * gh * 0.42;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = "rgba(255, 146, 164, 0.95)";
        ctx.lineWidth = 1.8;
        ctx.stroke();
      };

      const count = Math.max(1, activeModes.length);
      const cols = count === 1 ? 1 : 2;
      const rows = Math.ceil(count / 2);
      const gap = 8;
      const tileW = (width - gap * (cols + 1)) / cols;
      const tileH = (height - gap * (rows + 1)) / rows;

      activeModes.forEach((mode, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x0 = gap + col * (tileW + gap);
        const y0 = gap + row * (tileH + gap);
        const innerPad = 2;
        const clipX = x0 + innerPad;
        const clipY = y0 + innerPad;
        const clipW = tileW - innerPad * 2;
        const clipH = tileH - innerPad * 2;

        ctx.fillStyle = "rgba(1, 8, 18, 0.86)";
        ctx.fillRect(x0, y0, tileW, tileH);
        ctx.strokeStyle = "rgba(126, 225, 241, 0.26)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x0, y0, tileW, tileH);

        const gridX = 8;
        const gridY = 6;
        ctx.strokeStyle = "rgba(126, 225, 241, 0.09)";
        ctx.lineWidth = 1;
        for (let i = 0; i <= gridX; i += 1) {
          const x = x0 + (tileW / gridX) * i;
          ctx.beginPath();
          ctx.moveTo(x, y0);
          ctx.lineTo(x, y0 + tileH);
          ctx.stroke();
        }
        for (let i = 0; i <= gridY; i += 1) {
          const y = y0 + (tileH / gridY) * i;
          ctx.beginPath();
          ctx.moveTo(x0, y);
          ctx.lineTo(x0 + tileW, y);
          ctx.stroke();
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(clipX, clipY + 18, clipW, clipH - 20);
        ctx.clip();

        if (mode === "montecarlo") {
          drawMonteCarlo(clipX, clipY + 18, clipW, clipH - 20);
        }
        if (mode === "linear") {
          drawLinear(clipX, clipY + 18, clipW, clipH - 20);
        }
        if (mode === "surface") {
          drawSurface(mode, clipX, clipY + 18, clipW, clipH - 20);
        }
        if (mode === "laplace") {
          drawLaplace3D(clipX, clipY + 18, clipW, clipH - 20);
        }
        ctx.restore();

        ctx.fillStyle = "rgba(218, 252, 255, 0.95)";
        ctx.font = "11px var(--font-share-tech-mono), monospace";
        ctx.fillText(MODE_LABELS[mode], x0 + 8, y0 + 16);
      });

      animationFrameRef.current = window.requestAnimationFrame(draw);
    };

    animationFrameRef.current = window.requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [hasRuntime, activeModes, functionPoints, taylorPoints, brownianPoints, monteCarloPoints]);

  const resetToIdle = useCallback(() => {
    stopComputing();
    setQuestion("");
    setAskedQuestion("");
    setState("idle");
    setProgress(0);
    setCycles(0);
    setSampleCount(0);
    setMcEstimate(0);
    setBrownianSigma(0);
    setFunctionPoints([]);
    setTaylorPoints([]);
    setBrownianPoints([]);
    setMonteCarloPoints([]);
    setActiveModes(["montecarlo"]);
    setEquations(["[READY] Awaiting impossible question..."]);
  }, [stopComputing]);

  const startCompute = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      if (!canStart || !workerRef.current) {
        return;
      }

      seedRef.current = Math.random();
      const modeOrder = shuffleModes(seedRef.current);
      let modeIndex = 0;
      setActiveModes([modeOrder[modeIndex]]);
      pushEquation(MODE_EQUATIONS[modeOrder[modeIndex]]);

      const durationMs = 30000;
      const query = trimmedQuestion || "Will this work?";

      setAskedQuestion(query);
      setState("computing");
      setProgress(0);
      setCycles(0);
      setSampleCount(0);
      setMcEstimate(0);
      setBrownianSigma(0);
      setEquations([
        `[QUERY] ${query}`,
        "[ANALYSIS] Engaging compute-intensive edition...",
      ]);

      clearTimers();

      feedIntervalRef.current = window.setInterval(() => {
        const timestamp = new Date().toLocaleTimeString("en-US", {
          hour12: false,
          minute: "2-digit",
          second: "2-digit",
        });
        const line = STATIC_REASONING_LINES[Math.floor(Math.random() * STATIC_REASONING_LINES.length)];
        pushEquation(`[${timestamp}] ${line}`);
      }, 380);

      modeIntervalRef.current = window.setInterval(() => {
        if (modeIndex >= modeOrder.length - 1) {
          return;
        }
        modeIndex += 1;
        registerMode(modeOrder[modeIndex]);
      }, 6000);

      workerRef.current.postMessage({ type: "start", durationMs });

      finalizeTimeoutRef.current = window.setTimeout(() => {
        stopComputing();
        setState("resolved");
        setProgress(1);
        pushEquation("[RESOLVE] Complex-plane consensus still converges to maybe.");
      }, durationMs);
    },
    [canStart, clearTimers, pushEquation, registerMode, stopComputing, trimmedQuestion],
  );

  return (
    <div className={`hr-shell ${!hasRuntime ? "hr-shell-idle" : ""}`}>
      <canvas ref={canvasRef} className="hr-canvas" aria-hidden="true" />
      <div className="hr-overlay" aria-hidden="true" />

      <motion.main
        className={`hr-panel ${!hasRuntime ? "hr-panel-idle" : ""}`}
        initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        {!hasRuntime && (
          <section className="hr-top">
            <p className="hr-chip">Overengineered Decision Engine v2</p>
            <div className="hr-hero">
              <h1 className="hr-title">HyperResolve</h1>
              <p className="hr-subtitle">Predict the Future</p>
            </div>

            <form className="hr-form" onSubmit={startCompute}>
              <label htmlFor="question" className="hr-label">
                Ask any question
              </label>
              <div className="hr-inputRow">
                <input
                  id="question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className="hr-input"
                  placeholder="Will it rain today?"
                  autoComplete="off"
                  maxLength={180}
                />
                <button type="submit" className="hr-button" disabled={!canStart}>
                  Compute
                </button>
              </div>
            </form>
          </section>
        )}

        <AnimatePresence>
          {hasRuntime && (
            <motion.section
              className="hr-runtime"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <div className="hr-runtimeHeader">
                <p className="hr-questionLine">Question: {askedQuestion}</p>
                <p className="hr-analysisLine">Analysis...</p>
              </div>

              <section className="hr-graphWrap" aria-label="Animation Window">
                <div className="hr-graphHeader">
                  <span>Animation Window: {activeModes.length} active stream{activeModes.length > 1 ? "s" : ""}</span>
                  <span>
                    load {Math.round(progress * 100)}% | cycles {cycles.toLocaleString()} | samples {sampleCount.toLocaleString()} | sigma_B {brownianSigma.toFixed(3)}
                  </span>
                  <span>I ≈ {mcEstimate.toFixed(6)}</span>
                </div>
                <canvas ref={animationCanvasRef} className="hr-animCanvas" aria-label="Mathematical animation window" />
              </section>

              <section className="hr-feed" aria-label="Equation stream">
                <h2 className="hr-feedTitle">Terminal</h2>
                <div ref={terminalRef} className="hr-feedScroll">
                  {equations.map((line, index) => (
                    <motion.p
                      key={`${line}-${index}`}
                      initial={reduceMotion ? false : { opacity: 0, y: 7 }}
                      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    >
                      {line}
                    </motion.p>
                  ))}
                </div>
              </section>

              {state === "resolved" && (
                <div className="hr-resultRow">
                  <p className="hr-answerBar">Answer: Maybe</p>
                  <button type="button" className="hr-againButton" onClick={resetToIdle}>
                    Ask another question
                  </button>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {state === "blocked" && (
          <p className="hr-error">WebGL is required for this edition. Enable hardware acceleration and retry.</p>
        )}
      </motion.main>
    </div>
  );
}
