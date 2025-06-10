"use client";

import { Renderer, Program, Mesh, Color, Triangle, Geometry } from "ogl";
import { useEffect, useRef } from "react";

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;

out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v) {
  const vec4 C = vec4(
      0.211324865405187, 0.366025403784439,
      -0.577350269189626, 0.024390243902439
  );
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);

  vec3 p = permute(
      permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
      0.5 - vec3(
          dot(x0, x0),
          dot(x12.xy, x12.xy),
          dot(x12.zw, x12.zw)
      ),
      0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

struct ColorStop {
  vec3 color;
  float position;
};

// Smoother interpolation using cosine
#define COLOR_RAMP(colors, factor, finalColor) {              \
  int index = 0;                                            \
  for (int i = 0; i < 2; i++) {                             \
    ColorStop currentColor = colors[i];                     \
    bool isInBetween = currentColor.position <= factor;     \
    index = int(mix(float(index), float(i), float(isInBetween))); \
  }                                                         \
  ColorStop currentColor = colors[index];                   \
  ColorStop nextColor = colors[index + 1];                  \
  float range = nextColor.position - currentColor.position; \
  float lerpFactor = (factor - currentColor.position) / range; \
  lerpFactor = (1.0 - cos(lerpFactor * 3.141592653589793)) * 0.5; \
  finalColor = mix(currentColor.color, nextColor.color, lerpFactor); \
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  
  ColorStop colors[3];
  colors[0] = ColorStop(uColorStops[0], 0.0);
  colors[1] = ColorStop(uColorStops[1], 0.5);
  colors[2] = ColorStop(uColorStops[2], 1.0);
  
  vec3 rampColor;
  COLOR_RAMP(colors, uv.x, rampColor);
  
  // Soften noise for smoother bands
  float height = snoise(vec2(uv.x * 1.5 + uTime * 0.05, uTime * 0.2)) * 0.4 * uAmplitude;
  height = exp(height * 0.8);
  height = uv.y * 2.0 - height + 0.3;
  float intensity = 0.7 * height;
  
  float midPoint = 0.25;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.7, midPoint + uBlend * 0.7, intensity);
  
  vec3 auroraColor = intensity * rampColor;
  
  fragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);
}
`;

interface AuroraProps {
  colorStops?: string[];
  amplitude?: number;
  blend?: number;
  time?: number;
  speed?: number;
}

interface ColorState {
  current: number[][];
  target: number[][];
  lerpFactor: number;
  lastUpdate: number;
}

const colorPalette = [
  ["#6B7280", "#8B5CF6", "#EC4899"], // Gray, Purple, Pink
  ["#3B82F6", "#10B981", "#F472B6"], // Blue, Green, Soft Pink
  ["#8B5CF6", "#4ADE80", "#3B82F6"], // Purple, Lime, Blue
  ["#EC4899", "#6B7280", "#10B981"], // Pink, Gray, Green
];

function generateRandomColorSet(): number[][] {
  const randomSet =
    colorPalette[Math.floor(Math.random() * colorPalette.length)];
  return randomSet.map((hex) => {
    const c = new Color(hex);
    return [c.r, c.g, c.b];
  });
}

function lerpColors(
  current: number[][],
  target: number[][],
  factor: number,
): number[][] {
  return current.map((color, i) =>
    color.map((channel, j) => channel + (target[i][j] - channel) * factor),
  );
}

export default function Aurora({
  colorStops = ["#6B7280", "#8B5CF6", "#EC4899"],
  amplitude = 1.0,
  blend = 0.7,
  time,
  speed,
}: AuroraProps) {
  const propsRef = useRef<AuroraProps>({
    colorStops,
    amplitude,
    blend,
    time,
    speed,
  });
  propsRef.current = { colorStops, amplitude, blend, time, speed };

  const ctnDom = useRef<HTMLDivElement>(null);
  const colorState = useRef<ColorState>({
    current: generateRandomColorSet(),
    target: generateRandomColorSet(),
    lerpFactor: 0,
    lastUpdate: 0,
  });

  useEffect(() => {
    const ctn = ctnDom.current;
    if (!ctn) return;

    const renderer = new Renderer({
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
    });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.canvas.style.backgroundColor = "transparent";

    let program: Program;

    function resize() {
      if (!ctn) return;
      const width = ctn.offsetWidth;
      const height = ctn.offsetHeight;
      renderer.setSize(width, height);
      if (program) {
        program.uniforms.uResolution.value = [width, height];
      }
    }
    window.addEventListener("resize", resize);

    const geometry: Geometry = new Triangle(gl);
    if (geometry.attributes.uv) {
      delete geometry.attributes.uv;
    }

    const initialColors = colorStops.map((hex: string) => {
      const c = new Color(hex);
      return [c.r, c.g, c.b];
    });

    colorState.current.current = initialColors;
    colorState.current.target = generateRandomColorSet();

    program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: amplitude },
        uColorStops: { value: initialColors },
        uResolution: { value: [ctn.offsetWidth, ctn.offsetHeight] },
        uBlend: { value: blend },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });
    ctn.appendChild(gl.canvas);

    let animateId: number = 0;
    const update = (t: number) => {
      animateId = requestAnimationFrame(update);
      const {
        time = t * 0.01,
        speed = 1.0,
        amplitude = 1.0,
        blend = 0.7,
      } = propsRef.current;

      const transitionDuration = 2000 + Math.random() * 1000;
      const deltaTime = t - colorState.current.lastUpdate;
      if (deltaTime >= transitionDuration) {
        colorState.current.current = colorState.current.target;
        colorState.current.target = generateRandomColorSet();
        colorState.current.lerpFactor = 0;
        colorState.current.lastUpdate = t;
      } else {
        colorState.current.lerpFactor = Math.min(
          deltaTime / transitionDuration,
          1,
        );
      }

      const interpolatedColors = lerpColors(
        colorState.current.current,
        colorState.current.target,
        colorState.current.lerpFactor,
      );

      program.uniforms.uTime.value = time * speed * 0.1;
      program.uniforms.uAmplitude.value = amplitude;
      program.uniforms.uBlend.value = blend;
      program.uniforms.uColorStops.value = interpolatedColors;
      renderer.render({ scene: mesh });
    };
    animateId = requestAnimationFrame(update);

    resize();

    return () => {
      cancelAnimationFrame(animateId);
      window.removeEventListener("resize", resize);
      if (ctn && gl.canvas.parentNode === ctn) {
        ctn.removeChild(gl.canvas);
      }
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [amplitude, blend, speed]);

  return <div ref={ctnDom} className="absolute inset-0 z-[2] h-full w-full" />;
}
